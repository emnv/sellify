// Integration test: online checkout against the linked Supabase project.
// Creates a throwaway shop (with a fake connected Stripe account id, charges
// enabled, collection and delivery on) with a published store and products
// through the service role, runs the order lifecycle (quote → pending sale
// with stock hold → completion, release, refund path, cron backstop,
// delivery fee and address) and the signed webhook, then deletes everything.
// Stripe's API is never called: refunds are injected, and webhook events are
// signed locally with generateTestHeaderString. Skips without Supabase env.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultStoreConfig } from "@/lib/store/config";
import type { Database } from "@/lib/supabase/database.types";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: async () => {} }));
const { sendEmails } = vi.hoisted(() => ({ sendEmails: vi.fn(async (messages: unknown[]) => messages.length) }));
vi.mock("@/lib/email/send", () => ({ sendEmails, sendEmail: vi.fn() }));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const enabled = Boolean(url && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && serviceKey);

const WEBHOOK_SECRET = "whsec_test_checkout_suite";
const CONNECT_WEBHOOK_SECRET = "whsec_test_checkout_suite_connect";
const DELIVERY_FEE = 495;

type Email = { to: string; subject: string; text: string };

describe.skipIf(!enabled)("online checkout", () => {
  const run = Math.random().toString(36).slice(2, 8);
  const slug = `checkout-test-${run}`;
  const account = `acct_test${run}`;
  let admin: SupabaseClient<Database>;
  let shopId: string;
  let caseId: string; // 10 in stock, 15.00
  let phoneId: string; // 1 in stock, 250.00
  let hiddenId: string; // not visible online
  let orders: typeof import("@/core/api-orders");
  const savedEnv = {
    secret: process.env.STRIPE_WEBHOOK_SECRET,
    connect: process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
    key: process.env.STRIPE_SECRET_KEY,
  };

  beforeAll(async () => {
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET = CONNECT_WEBHOOK_SECRET;
    process.env.STRIPE_SECRET_KEY ||= "sk_test_placeholder_for_signature_checks";
    admin = createClient<Database>(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });
    const shop = await admin
      .from("shops")
      .insert({
        name: `Checkout ${run}`,
        notification_email: `shop-${run}@sellify.test`,
        currency: "EUR",
        collection_enabled: true,
        delivery_enabled: true,
        delivery_fee_cents: DELIVERY_FEE,
        stripe_account_id: account,
        stripe_charges_enabled: true,
        stripe_details_submitted: true,
      })
      .select("id")
      .single();
    if (shop.error) throw shop.error;
    shopId = shop.data.id;
    const config = defaultStoreConfig({ name: `Checkout ${run}` });
    const store = await admin
      .from("stores")
      .insert({ shop_id: shopId, slug, draft_config: config, published_config: config, is_published: true, published_at: new Date().toISOString() });
    if (store.error) throw store.error;
    const products = await admin
      .from("products")
      .insert([
        { shop_id: shopId, name: "Clear case", price_cents: 1500, stock_qty: 10, visible_online: true },
        { shop_id: shopId, name: "Refurbished phone", price_cents: 25000, stock_qty: 1, visible_online: true },
        { shop_id: shopId, name: "Hidden", price_cents: 100, stock_qty: 5, visible_online: false },
      ])
      .select("id, name");
    if (products.error) throw products.error;
    const byName = (n: string) => products.data.find((p) => p.name === n)!.id;
    caseId = byName("Clear case");
    phoneId = byName("Refurbished phone");
    hiddenId = byName("Hidden");
    orders = await import("@/core/api-orders");
  });

  afterAll(async () => {
    const restore = (name: string, value: string | undefined) => (value === undefined ? delete process.env[name] : (process.env[name] = value));
    restore("STRIPE_WEBHOOK_SECRET", savedEnv.secret);
    restore("STRIPE_CONNECT_WEBHOOK_SECRET", savedEnv.connect);
    restore("STRIPE_SECRET_KEY", savedEnv.key);
    if (admin && shopId) await admin.from("shops").delete().eq("id", shopId); // cascades store, products, sales
  });

  beforeEach(() => {
    sendEmails.mockClear();
  });

  const stock = async (id: string) => (await admin.from("products").select("stock_qty").eq("id", id).single()).data!.stock_qty;
  const sale = async (id: string) => (await admin.from("sales").select("*").eq("id", id).single()).data!;
  const setStock = async (id: string, qty: number) => {
    const { error } = await admin.from("products").update({ stock_qty: qty }).eq("id", id);
    if (error) throw error;
  };
  const updateShop = async (values: Database["public"]["Tables"]["shops"]["Update"]) => {
    const { error } = await admin.from("shops").update(values).eq("id", shopId);
    if (error) throw error;
  };
  const sentEmails = () => sendEmails.mock.calls.flatMap((c) => c[0] as Email[]);

  const ADDRESS = { name: "Aoife Test", address: { line1: "1 Quay Street", line2: null, city: "Galway", postal_code: "H91 ABC1", state: null, country: "IE" } };

  function fakeSession(saleId: string, sessionId: string, amount: number, over: Partial<Stripe.Checkout.Session> = {}) {
    return {
      id: sessionId,
      object: "checkout.session",
      payment_status: "paid",
      status: "complete",
      amount_total: amount,
      currency: "eur",
      metadata: { sale_id: saleId, store_key: slug },
      payment_intent: `pi_test_${run}_${saleId.slice(0, 8)}`,
      customer_details: { name: "Aoife Test", email: `buyer-${run}@sellify.test`, phone: "+353 1 234 5678" },
      collected_information: { shipping_details: ADDRESS },
      ...over,
    } as unknown as Stripe.Checkout.Session;
  }

  async function pendingSale(lines: { productId: string; qty: number }[], fulfilment: "collection" | "delivery" = "collection") {
    const res = await orders.createPendingOnlineSale(slug, lines, { fulfilment });
    if (!res.ok) throw new Error(res.error);
    const sessionId = `cs_test_${run}_${res.saleId.slice(0, 8)}`;
    await orders.markSaleSession(res.saleId, sessionId);
    return { saleId: res.saleId, sessionId, total: res.totalCents, res };
  }

  it("quotes from database prices and ignores anything else the client sends", async () => {
    const tampered = [{ productId: caseId, qty: 2, price_cents: 1, name: "Free" }] as unknown as { productId: string; qty: number }[];
    const quote = await orders.quoteBasket(slug, tampered);
    expect(quote?.totalCents).toBe(3000);
    expect(quote?.lines[0]).toMatchObject({ name: "Clear case", unitPriceCents: 1500, qty: 2, status: "ok" });
    expect(quote).toMatchObject({ paymentsReady: true, fulfilment: { collection: true, delivery: true, deliveryFeeCents: DELIVERY_FEE } });
  });

  it("flags hidden, unknown and over-stock lines", async () => {
    const quote = await orders.quoteBasket(slug, [
      { productId: hiddenId, qty: 1 },
      { productId: phoneId, qty: 4 },
      { productId: "00000000-0000-4000-8000-000000000000", qty: 1 },
    ]);
    expect(quote?.lines.map((l) => l.status)).toEqual(["missing", "reduced", "missing"]);
    expect(quote?.totalCents).toBe(25000);
  });

  it("refuses an unknown store and a basket that changed", async () => {
    expect(await orders.quoteBasket(`nope-${run}`, [{ productId: caseId, qty: 1 }])).toBeNull();
    const res = await orders.createPendingOnlineSale(slug, [{ productId: phoneId, qty: 2 }], { fulfilment: "collection" });
    expect(res.ok).toBe(false);
  });

  it("refuses a fulfilment the shop doesn't offer, and checkout while payments aren't set up", async () => {
    await updateShop({ delivery_enabled: false });
    const noDelivery = await orders.createPendingOnlineSale(slug, [{ productId: caseId, qty: 1 }], { fulfilment: "delivery" });
    expect(noDelivery).toMatchObject({ ok: false, error: expect.stringContaining("doesn't deliver") });
    await updateShop({ delivery_enabled: true, stripe_charges_enabled: false });
    const previous = process.env.PLATFORM_CHARGES_FALLBACK;
    try {
      // Fallback off: a shop without a connected Stripe account can't take payments.
      process.env.PLATFORM_CHARGES_FALLBACK = "false";
      expect((await orders.quoteBasket(slug, [{ productId: caseId, qty: 1 }]))?.paymentsReady).toBe(false);
      const notReady = await orders.createPendingOnlineSale(slug, [{ productId: caseId, qty: 1 }], { fulfilment: "collection" });
      expect(notReady).toMatchObject({ ok: false, error: orders.PAYMENTS_OFF_MESSAGE });
      expect(await stock(caseId)).toBe(10); // nothing was held

      // Fallback on (default): payments are ready, charged on the platform account.
      process.env.PLATFORM_CHARGES_FALLBACK = "true";
      const quote = await orders.quoteBasket(slug, [{ productId: caseId, qty: 1 }]);
      expect(quote?.paymentsReady).toBe(true);
    } finally {
      if (previous === undefined) delete process.env.PLATFORM_CHARGES_FALLBACK;
      else process.env.PLATFORM_CHARGES_FALLBACK = previous;
      await updateShop({ stripe_charges_enabled: true });
    }
  });

  it("holds stock at checkout; completing a reserved sale doesn't take it twice", async () => {
    const { saleId, sessionId, total } = await pendingSale([{ productId: caseId, qty: 2 }]);
    const before = await sale(saleId);
    expect(before).toMatchObject({ status: "pending", channel: "online", total_cents: 3000, fulfilment: "collection", delivery_fee_cents: 0, stripe_session_id: sessionId });
    expect(before.reserved_until).not.toBeNull();
    expect(await stock(caseId)).toBe(8); // held

    const session = fakeSession(saleId, sessionId, total);
    expect(await orders.completeOnlineSale(saleId, session, {}, account)).toBe("paid");
    expect(await stock(caseId)).toBe(8);
    const after = await sale(saleId);
    expect(after).toMatchObject({
      status: "paid",
      payment_method: "stripe",
      reserved_until: null,
      customer_name: "Aoife Test",
      customer_email: `buyer-${run}@sellify.test`,
      customer_phone: "+353 1 234 5678",
      shipping_address: null, // collection: no address kept
    });
    expect(sendEmails).toHaveBeenCalledTimes(1);
    expect(sendEmails.mock.calls[0][0]).toHaveLength(2); // customer + shop
    expect(sentEmails()[0].text).toContain("Fulfilment: Collection in the shop");

    // Second delivery (webhook retry, or the order page racing the webhook).
    expect(await orders.completeOnlineSale(saleId, session, {}, account)).toBe("paid");
    expect(await stock(caseId)).toBe(8);
    expect(sendEmails).toHaveBeenCalledTimes(1);
  });

  it("a held unit can't be bought by a second customer", async () => {
    const first = await pendingSale([{ productId: phoneId, qty: 1 }]);
    expect(await stock(phoneId)).toBe(0);
    const second = await orders.createPendingOnlineSale(slug, [{ productId: phoneId, qty: 1 }], { fulfilment: "collection" });
    expect(second.ok).toBe(false);
    await orders.expireOnlineSale(first.saleId, first.sessionId);
    expect(await stock(phoneId)).toBe(1);
  });

  it("ignores a session that does not belong to the sale; expiry releases the hold", async () => {
    const { saleId, sessionId, total } = await pendingSale([{ productId: caseId, qty: 1 }]);
    expect(await stock(caseId)).toBe(7);
    expect(await orders.completeOnlineSale(saleId, fakeSession(saleId, "cs_test_other", total))).toBe("ignored");
    expect(await orders.completeOnlineSale(saleId, fakeSession(saleId, sessionId, total - 1))).toBe("ignored");
    expect(await orders.completeOnlineSale(saleId, fakeSession(saleId, sessionId, total, { payment_status: "unpaid" }))).toBe("pending");
    expect((await sale(saleId)).status).toBe("pending");
    await orders.expireOnlineSale(saleId, "cs_test_wrong_session");
    expect((await sale(saleId)).status).toBe("pending");
    await orders.expireOnlineSale(saleId, sessionId);
    expect(await sale(saleId)).toMatchObject({ status: "cancelled", reserved_until: null });
    expect(await stock(caseId)).toBe(8); // released
    await orders.expireOnlineSale(saleId, sessionId); // idempotent
    expect(await stock(caseId)).toBe(8);
  });

  it("a checkout that never started gives its hold back", async () => {
    const res = await orders.createPendingOnlineSale(slug, [{ productId: caseId, qty: 3 }], { fulfilment: "collection" });
    if (!res.ok) throw new Error(res.error);
    expect(await stock(caseId)).toBe(5);
    await orders.cancelUnstartedSale(res.saleId);
    expect(await sale(res.saleId)).toMatchObject({ status: "cancelled" });
    expect(await stock(caseId)).toBe(8);
  });

  it("paid after the hold expired, with stock still there: takes it and marks paid", async () => {
    const { saleId, sessionId, total } = await pendingSale([{ productId: caseId, qty: 1 }]);
    await orders.expireOnlineSale(saleId, sessionId);
    expect(await stock(caseId)).toBe(8);
    expect(await orders.completeOnlineSale(saleId, fakeSession(saleId, sessionId, total), { emails: false }, account)).toBe("paid");
    expect(await sale(saleId)).toMatchObject({ status: "paid", payment_method: "stripe" });
    expect(await stock(caseId)).toBe(7);
  });

  it("paid after the hold expired and the item sold in the shop: refunds on the shop's account", async () => {
    const { saleId, sessionId, total } = await pendingSale([{ productId: phoneId, qty: 1 }]);
    expect(await stock(phoneId)).toBe(0);
    await orders.expireOnlineSale(saleId, sessionId);
    expect(await stock(phoneId)).toBe(1);
    await setStock(phoneId, 0); // sold at the POS meanwhile
    const refund = vi.fn(async () => {});
    const session = fakeSession(saleId, sessionId, total);
    expect(await orders.completeOnlineSale(saleId, session, { refund }, account)).toBe("refunded");
    expect(refund).toHaveBeenCalledWith(session.payment_intent, saleId, account);
    expect(await stock(phoneId)).toBe(0);
    expect(await sale(saleId)).toMatchObject({ status: "refunded", payment_method: "stripe" });
    expect(sendEmails).toHaveBeenCalledTimes(1);

    expect(await orders.completeOnlineSale(saleId, session, { refund }, account)).toBe("refunded");
    expect(refund).toHaveBeenCalledTimes(1);
    expect(sendEmails).toHaveBeenCalledTimes(1);
    await setStock(phoneId, 1);
  });

  it("delivery adds the shop's fee to the total and keeps the address from Stripe", async () => {
    const startStock = await stock(caseId);
    const { saleId, sessionId, total, res } = await pendingSale([{ productId: caseId, qty: 2 }], "delivery");
    expect(res.ok && res.deliveryFeeCents).toBe(DELIVERY_FEE);
    expect(total).toBe(3000 + DELIVERY_FEE);
    expect(await sale(saleId)).toMatchObject({ fulfilment: "delivery", delivery_fee_cents: DELIVERY_FEE, total_cents: 3000 + DELIVERY_FEE });

    // Stripe must have charged items + delivery.
    expect(await orders.completeOnlineSale(saleId, fakeSession(saleId, sessionId, 3000), {}, account)).toBe("ignored");
    expect(await orders.completeOnlineSale(saleId, fakeSession(saleId, sessionId, total), {}, account)).toBe("paid");
    expect(await stock(caseId)).toBe(startStock - 2);
    expect((await sale(saleId)).shipping_address).toMatchObject({ line1: "1 Quay Street", city: "Galway", postal_code: "H91 ABC1", country: "IE" });
    const [customerEmail, shopEmail] = sentEmails();
    for (const m of [customerEmail, shopEmail]) {
      expect(m.text).toContain("Fulfilment: Delivery");
      expect(m.text).toContain("1 Quay Street");
      expect(m.text).toContain("€4.95");
    }

    const owner = await orders.getOrderForStore(slug, saleId, sessionId);
    expect(owner).toMatchObject({ fulfilment: "delivery", deliveryFeeCents: DELIVERY_FEE, totalCents: 3000 + DELIVERY_FEE });
    expect(owner?.customer?.shippingAddress).toMatchObject({ line1: "1 Quay Street", city: "Galway" });
    const anonymous = await orders.getOrderForStore(slug, saleId);
    expect(anonymous?.customer).toBeNull(); // no address for strangers
  });

  it("collection is free even when delivery has a fee", async () => {
    const { saleId, total } = await pendingSale([{ productId: caseId, qty: 1 }], "collection");
    expect(total).toBe(1500);
    expect(await sale(saleId)).toMatchObject({ fulfilment: "collection", delivery_fee_cents: 0, total_cents: 1500 });
    await orders.cancelUnstartedSale(saleId); // has a session: no-op
    expect((await sale(saleId)).status).toBe("pending");
    await orders.expireOnlineSale(saleId, (await sale(saleId)).stripe_session_id!);
  });

  it("the cron backstop releases holds past their time", async () => {
    const startStock = await stock(caseId);
    const { saleId } = await pendingSale([{ productId: caseId, qty: 2 }]);
    expect(await stock(caseId)).toBe(startStock - 2);
    const { error } = await admin
      .from("sales")
      .update({ reserved_until: new Date(Date.now() - 10 * 60_000).toISOString() })
      .eq("id", saleId);
    if (error) throw error;
    expect(await orders.releaseExpiredReservations()).toBeGreaterThanOrEqual(1);
    expect(await sale(saleId)).toMatchObject({ status: "cancelled", reserved_until: null });
    expect(await stock(caseId)).toBe(startStock);
  });

  it("the order page shows only this shop's orders, without customer details unless the session matches", async () => {
    const { saleId, sessionId, total } = await pendingSale([{ productId: caseId, qty: 1 }]);
    await orders.completeOnlineSale(saleId, fakeSession(saleId, sessionId, total), { emails: false }, account);
    const anonymous = await orders.getOrderForStore(slug, saleId);
    expect(anonymous).toMatchObject({ status: "paid", totalCents: 1500, fulfilment: "collection", customer: null });
    expect(anonymous?.items).toEqual([{ name: "Clear case", qty: 1, unitPriceCents: 1500 }]);
    const owner = await orders.getOrderForStore(slug, saleId, sessionId);
    expect(owner?.customer?.email).toBe(`buyer-${run}@sellify.test`);
    expect(await orders.getOrderForStore(`nope-${run}`, saleId)).toBeNull();
  });

  describe("webhook", () => {
    const signer = new Stripe("sk_test_signer_only");

    async function post(payload: object, secret = WEBHOOK_SECRET) {
      const { POST } = await import("@/app/api/stripe/webhook/route");
      const body = JSON.stringify(payload);
      const header = signer.webhooks.generateTestHeaderString({ payload: body, secret });
      return POST(new Request("http://localhost/api/stripe/webhook", { method: "POST", body, headers: { "stripe-signature": header } }));
    }

    const event = (type: string, object: unknown, acct?: string) => ({
      id: `evt_test_${Math.random().toString(36).slice(2)}`,
      object: "event",
      type,
      ...(acct ? { account: acct } : {}),
      data: { object },
    });

    it("rejects unsigned and wrongly signed requests", async () => {
      const { POST } = await import("@/app/api/stripe/webhook/route");
      const unsigned = await POST(new Request("http://localhost/api/stripe/webhook", { method: "POST", body: "{}" }));
      expect(unsigned.status).toBe(400);
      const forged = await post(event("checkout.session.completed", {}), "whsec_wrong");
      expect(forged.status).toBe(400);
    });

    it("completes the sale on a Connect checkout.session.completed, idempotently", async () => {
      const startStock = await stock(caseId);
      const { saleId, sessionId, total } = await pendingSale([{ productId: caseId, qty: 1 }]);
      expect(await stock(caseId)).toBe(startStock - 1);
      const evt = event("checkout.session.completed", fakeSession(saleId, sessionId, total), account);
      expect((await post(evt, CONNECT_WEBHOOK_SECRET)).status).toBe(200);
      expect((await post(evt, CONNECT_WEBHOOK_SECRET)).status).toBe(200);
      expect((await sale(saleId)).status).toBe("paid");
      expect(await stock(caseId)).toBe(startStock - 1);
    });

    it("releases the hold on checkout.session.expired and ignores other events", async () => {
      const startStock = await stock(caseId);
      const { saleId, sessionId, total } = await pendingSale([{ productId: caseId, qty: 1 }]);
      expect((await post(event("payment_intent.created", { id: "pi_x" }))).status).toBe(200);
      expect((await sale(saleId)).status).toBe("pending");
      const expired = event("checkout.session.expired", fakeSession(saleId, sessionId, total, { payment_status: "unpaid", status: "expired" }), account);
      expect((await post(expired, CONNECT_WEBHOOK_SECRET)).status).toBe(200);
      expect((await sale(saleId)).status).toBe("cancelled");
      expect(await stock(caseId)).toBe(startStock);
    });

    it("keeps the shop's payment status in sync on account.updated", async () => {
      const evt = (charges: boolean) =>
        event("account.updated", { id: account, object: "account", charges_enabled: charges, details_submitted: true }, account);
      expect((await post(evt(false), CONNECT_WEBHOOK_SECRET)).status).toBe(200);
      let shop = (await admin.from("shops").select("stripe_charges_enabled, stripe_details_submitted").eq("id", shopId).single()).data!;
      expect(shop).toEqual({ stripe_charges_enabled: false, stripe_details_submitted: true });
      expect((await post(evt(true), CONNECT_WEBHOOK_SECRET)).status).toBe(200);
      shop = (await admin.from("shops").select("stripe_charges_enabled, stripe_details_submitted").eq("id", shopId).single()).data!;
      expect(shop.stripe_charges_enabled).toBe(true);
    });
  });
});
