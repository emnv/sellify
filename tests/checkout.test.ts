// Integration test: online checkout against the linked Supabase project.
// Creates a throwaway shop with a published store and products through the
// service role, runs the order lifecycle (quote → pending sale → completion,
// refund path, expiry) and the signed webhook, then deletes everything.
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

describe.skipIf(!enabled)("online checkout", () => {
  const run = Math.random().toString(36).slice(2, 8);
  const slug = `checkout-test-${run}`;
  let admin: SupabaseClient<Database>;
  let shopId: string;
  let caseId: string; // 10 in stock, 15.00
  let phoneId: string; // 1 in stock, 250.00
  let hiddenId: string; // not visible online
  let orders: typeof import("@/core/api-orders");
  const savedEnv = { secret: process.env.STRIPE_WEBHOOK_SECRET, key: process.env.STRIPE_SECRET_KEY };

  beforeAll(async () => {
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.STRIPE_SECRET_KEY ||= "sk_test_placeholder_for_signature_checks";
    admin = createClient<Database>(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });
    const shop = await admin
      .from("shops")
      .insert({ name: `Checkout ${run}`, notification_email: `shop-${run}@sellify.test`, currency: "EUR" })
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
    process.env.STRIPE_WEBHOOK_SECRET = savedEnv.secret;
    process.env.STRIPE_SECRET_KEY = savedEnv.key;
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
      ...over,
    } as unknown as Stripe.Checkout.Session;
  }

  async function pendingSale(lines: { productId: string; qty: number }[]) {
    const res = await orders.createPendingOnlineSale(slug, lines);
    if (!res.ok) throw new Error(res.error);
    const sessionId = `cs_test_${run}_${res.saleId.slice(0, 8)}`;
    await orders.markSaleSession(res.saleId, sessionId);
    return { saleId: res.saleId, sessionId, total: res.quote.totalCents };
  }

  it("quotes from database prices and ignores anything else the client sends", async () => {
    const tampered = [{ productId: caseId, qty: 2, price_cents: 1, name: "Free" }] as unknown as { productId: string; qty: number }[];
    const quote = await orders.quoteBasket(slug, tampered);
    expect(quote?.totalCents).toBe(3000);
    expect(quote?.lines[0]).toMatchObject({ name: "Clear case", unitPriceCents: 1500, qty: 2, status: "ok" });
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
    const res = await orders.createPendingOnlineSale(slug, [{ productId: phoneId, qty: 2 }]);
    expect(res.ok).toBe(false);
  });

  it("completing a paid session reduces stock once and marks the sale paid", async () => {
    const { saleId, sessionId, total } = await pendingSale([{ productId: caseId, qty: 2 }]);
    const before = await sale(saleId);
    expect(before).toMatchObject({ status: "pending", channel: "online", total_cents: 3000, stripe_session_id: sessionId });
    expect(await stock(caseId)).toBe(10);

    const session = fakeSession(saleId, sessionId, total);
    expect(await orders.completeOnlineSale(saleId, session)).toBe("paid");
    expect(await stock(caseId)).toBe(8);
    const after = await sale(saleId);
    expect(after).toMatchObject({ status: "paid", payment_method: "stripe", customer_name: "Aoife Test", customer_email: `buyer-${run}@sellify.test` });
    expect(sendEmails).toHaveBeenCalledTimes(1);
    expect(sendEmails.mock.calls[0][0]).toHaveLength(2); // customer + shop

    // Second delivery (webhook retry, or the order page racing the webhook).
    expect(await orders.completeOnlineSale(saleId, session)).toBe("paid");
    expect(await stock(caseId)).toBe(8);
    expect(sendEmails).toHaveBeenCalledTimes(1);
  });

  it("ignores a session that does not belong to the sale", async () => {
    const { saleId, sessionId, total } = await pendingSale([{ productId: caseId, qty: 1 }]);
    expect(await orders.completeOnlineSale(saleId, fakeSession(saleId, "cs_test_other", total))).toBe("ignored");
    expect(await orders.completeOnlineSale(saleId, fakeSession(saleId, sessionId, total - 1))).toBe("ignored");
    expect(await orders.completeOnlineSale(saleId, fakeSession(saleId, sessionId, total, { payment_status: "unpaid" }))).toBe("pending");
    expect((await sale(saleId)).status).toBe("pending");
    expect(await stock(caseId)).toBe(8);
    await orders.expireOnlineSale(saleId, sessionId);
    expect((await sale(saleId)).status).toBe("cancelled");
  });

  it("refunds when stock ran out before payment completed", async () => {
    const { saleId, sessionId, total } = await pendingSale([{ productId: phoneId, qty: 1 }]);
    await setStock(phoneId, 0); // sold in the shop meanwhile
    const refund = vi.fn(async () => {});
    const session = fakeSession(saleId, sessionId, total);
    expect(await orders.completeOnlineSale(saleId, session, { refund })).toBe("refunded");
    expect(refund).toHaveBeenCalledWith(session.payment_intent, saleId);
    expect(await stock(phoneId)).toBe(0);
    expect(await sale(saleId)).toMatchObject({ status: "refunded", payment_method: "stripe" });
    expect(sendEmails).toHaveBeenCalledTimes(1);

    expect(await orders.completeOnlineSale(saleId, session, { refund })).toBe("refunded");
    expect(refund).toHaveBeenCalledTimes(1);
    expect(sendEmails).toHaveBeenCalledTimes(1);
    await setStock(phoneId, 1);
  });

  it("the order page shows only this shop's orders, without customer details unless the session matches", async () => {
    const { saleId, sessionId, total } = await pendingSale([{ productId: caseId, qty: 1 }]);
    await orders.completeOnlineSale(saleId, fakeSession(saleId, sessionId, total), { emails: false });
    const anonymous = await orders.getOrderForStore(slug, saleId);
    expect(anonymous).toMatchObject({ status: "paid", totalCents: 1500, customer: null });
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

    const event = (type: string, object: unknown) => ({ id: `evt_test_${Math.random().toString(36).slice(2)}`, object: "event", type, data: { object } });

    it("rejects unsigned and wrongly signed requests", async () => {
      const { POST } = await import("@/app/api/stripe/webhook/route");
      const unsigned = await POST(new Request("http://localhost/api/stripe/webhook", { method: "POST", body: "{}" }));
      expect(unsigned.status).toBe(400);
      const forged = await post(event("checkout.session.completed", {}), "whsec_wrong");
      expect(forged.status).toBe(400);
    });

    it("completes the sale on checkout.session.completed, idempotently", async () => {
      const startStock = await stock(caseId);
      const { saleId, sessionId, total } = await pendingSale([{ productId: caseId, qty: 1 }]);
      const evt = event("checkout.session.completed", fakeSession(saleId, sessionId, total));
      expect((await post(evt)).status).toBe(200);
      expect((await post(evt)).status).toBe(200);
      expect((await sale(saleId)).status).toBe("paid");
      expect(await stock(caseId)).toBe(startStock - 1);
    });

    it("cancels the pending sale on checkout.session.expired and ignores other events", async () => {
      const { saleId, sessionId, total } = await pendingSale([{ productId: caseId, qty: 1 }]);
      expect((await post(event("payment_intent.created", { id: "pi_x" }))).status).toBe(200);
      expect((await sale(saleId)).status).toBe("pending");
      expect((await post(event("checkout.session.expired", fakeSession(saleId, sessionId, total, { payment_status: "unpaid", status: "expired" })))).status).toBe(200);
      expect((await sale(saleId)).status).toBe("cancelled");
    });
  });
});
