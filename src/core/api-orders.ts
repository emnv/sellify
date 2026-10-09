import "server-only";
import { getPublicStore, getShopForPublishedStore, type ShopForStore } from "@/core/api";
import { quoteLines, type BasketQuote, type RequestedLine } from "@/lib/basket-total";
import { sendEmails, type EmailMessage } from "@/lib/email/send";
import { serverEnv } from "@/lib/env.server";
import { formatMoney } from "@/lib/money";
import { stripe, type Stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

// =============================================================================
// THE SEAM, online orders (part of @/core/api). Store checkout reaches Core
// sales and stock ONLY through these functions.
//
// Every step re-resolves the published store from its key and re-reads names,
// prices and stock from the database with the service role. The client sends
// product ids and quantities, nothing else.
//
// Order lifecycle:
//   createPendingOnlineSale → sale 'pending' with item snapshots
//   markSaleSession         → links the Stripe Checkout Session
//   completeOnlineSale      → finalize_online_sale(): stock decremented, 'paid'
//                             or, when stock ran out meanwhile, refund → 'refunded'
//   expireOnlineSale        → session expired unpaid → 'cancelled'
//
// "Exactly once" side effects (emails) hang off an atomic claim: the single
// UPDATE that records payment_method = 'stripe' (paid) or flips 'cancelled' to
// 'refunded'. Only the caller whose UPDATE matched a row sends emails, so the
// webhook and the order page can race safely.
// =============================================================================

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type OrderQuote = BasketQuote & { currency: string };

type StoreShop = ShopForStore & { storeName: string };

/** The shop behind a published store whose Shop tab is on, or null. */
async function shopForCheckout(storeKey: string): Promise<StoreShop | null> {
  const store = await getPublicStore(storeKey);
  if (!store || !store.config.content.tabs.shop) return null;
  const shop = await getShopForPublishedStore(storeKey);
  if (!shop) return null;
  return { ...shop, storeName: store.config.content.storeName };
}

async function quoteForShop(shopId: string, lines: RequestedLine[]): Promise<BasketQuote> {
  const ids = [...new Set(lines.map((l) => l.productId).filter((id) => UUID.test(id)))];
  if (ids.length === 0) return quoteLines([], []);
  const { data, error } = await createAdminClient()
    .from("products")
    .select("id, name, price_cents, stock_qty")
    .eq("shop_id", shopId)
    .eq("visible_online", true)
    .eq("is_part", false)
    .in("id", ids);
  if (error) throw new Error(`Could not load products: ${error.message}`);
  return quoteLines(
    lines.filter((l) => UUID.test(l.productId)),
    data,
  );
}

/** Current names, prices and stock for a basket. Null when the store has no shop. */
export async function quoteBasket(storeKey: string, lines: RequestedLine[]): Promise<OrderQuote | null> {
  const shop = await shopForCheckout(storeKey);
  if (!shop) return null;
  return { ...(await quoteForShop(shop.shopId, lines)), currency: shop.currency };
}

export type PendingSale =
  | { ok: true; saleId: string; quote: OrderQuote; shop: StoreShop }
  | { ok: false; error: string; quote?: OrderQuote };

/**
 * Validates the basket again and records a pending online sale with name and
 * price snapshots. Refuses when anything changed since the customer last saw
 * the basket (sold out, less stock), so they never pay for a surprise.
 */
export async function createPendingOnlineSale(
  storeKey: string,
  lines: RequestedLine[],
  customer?: { email?: string | null },
): Promise<PendingSale> {
  const shop = await shopForCheckout(storeKey);
  if (!shop) return { ok: false, error: "This shop is not taking online orders right now." };
  const quote: OrderQuote = { ...(await quoteForShop(shop.shopId, lines)), currency: shop.currency };
  if (quote.itemCount === 0) return { ok: false, error: "Your basket is empty.", quote };
  if (quote.changed) return { ok: false, error: "Some items changed since you added them. Check your basket and try again.", quote };

  const admin = createAdminClient();
  const { data: sale, error } = await admin
    .from("sales")
    .insert({
      shop_id: shop.shopId,
      channel: "online",
      status: "pending",
      total_cents: quote.totalCents,
      customer_email: customer?.email?.slice(0, 254) || null,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Could not create the order: ${error.message}`);

  const items = quote.lines
    .filter((l) => l.qty > 0)
    .map((l) => ({ sale_id: sale.id, product_id: l.productId, name: l.name ?? "Item", unit_price_cents: l.unitPriceCents, qty: l.qty }));
  const { error: itemsError } = await admin.from("sale_items").insert(items);
  if (itemsError) {
    await admin.from("sales").delete().eq("id", sale.id);
    throw new Error(`Could not create the order: ${itemsError.message}`);
  }
  return { ok: true, saleId: sale.id, quote, shop };
}

/** Links the Checkout Session to the pending sale (once). */
export async function markSaleSession(saleId: string, sessionId: string): Promise<void> {
  const { data, error } = await createAdminClient()
    .from("sales")
    .update({ stripe_session_id: sessionId })
    .eq("id", saleId)
    .eq("status", "pending")
    .is("stripe_session_id", null)
    .select("id");
  if (error) throw new Error(`Could not save the payment session: ${error.message}`);
  if (!data.length) throw new Error("Could not save the payment session: the order is no longer pending.");
}

export type CompletionResult = "paid" | "refunded" | "pending" | "ignored";

export type CompletionDeps = {
  /** Refunds the payment. Defaults to a Stripe refund (idempotent per sale). */
  refund?: (paymentIntentId: string, saleId: string) => Promise<void>;
  /** Send emails (default true). Tests turn this off. */
  emails?: boolean;
};

type SessionLike = Pick<Stripe.Checkout.Session, "id" | "payment_status" | "amount_total" | "currency" | "metadata" | "payment_intent" | "customer_details">;

async function stripeRefund(paymentIntentId: string, saleId: string) {
  await stripe().refunds.create(
    { payment_intent: paymentIntentId, reason: "requested_by_customer", metadata: { sale_id: saleId, reason: "out_of_stock" } },
    { idempotencyKey: `sellify-refund-${saleId}` },
  );
}

function customerFrom(session: SessionLike) {
  const d = session.customer_details;
  return {
    customer_name: d?.name?.trim().slice(0, 120) || null,
    customer_email: d?.email?.trim().slice(0, 254) || null,
    customer_phone: d?.phone?.trim().slice(0, 40) || null,
  };
}

/**
 * Completes a paid Checkout Session: decrements stock and marks the sale paid,
 * or refunds when stock ran out. Safe to call any number of times, from the
 * webhook and from the order page at once.
 */
export async function completeOnlineSale(saleId: string, session: SessionLike, deps: CompletionDeps = {}): Promise<CompletionResult> {
  if (!UUID.test(saleId)) return "ignored";
  const admin = createAdminClient();
  const { data: sale, error } = await admin
    .from("sales")
    .select("id, shop_id, channel, status, total_cents, stripe_session_id, shops(currency)")
    .eq("id", saleId)
    .maybeSingle();
  if (error) throw new Error(`Could not load the order: ${error.message}`);
  if (!sale || sale.channel !== "online") return "ignored";

  // The session must be the one this sale created, for the amount we charged.
  const mismatch =
    sale.stripe_session_id !== session.id ||
    session.metadata?.sale_id !== saleId ||
    session.amount_total !== sale.total_cents ||
    (session.currency ?? "").toUpperCase() !== (sale.shops?.currency ?? "").toUpperCase();
  if (mismatch) {
    console.error("[orders] session does not match sale", { saleId, sessionId: session.id });
    return "ignored";
  }
  if (session.payment_status !== "paid") return "pending";
  if (sale.status === "refunded") return "refunded";

  const { data: ok, error: rpcError } = await admin.rpc("finalize_online_sale", { p_sale_id: saleId });
  if (rpcError) throw new Error(`Could not complete the order: ${rpcError.message}`);
  const customer = customerFrom(session);

  if (ok) {
    // Claim: the first caller to record the payment method sends the emails.
    const { data: claimed, error: claimError } = await admin
      .from("sales")
      .update({ payment_method: "stripe", ...customer })
      .eq("id", saleId)
      .eq("status", "paid")
      .is("payment_method", null)
      .select("id");
    if (claimError) throw new Error(`Could not update the order: ${claimError.message}`);
    if (claimed.length && deps.emails !== false) await sendOrderEmails(saleId, "paid");
    return "paid";
  }

  // Stock ran out between checkout and payment: refund, then mark refunded.
  const paymentIntent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  if (!paymentIntent) throw new Error("Paid session has no payment intent to refund.");
  await (deps.refund ?? stripeRefund)(paymentIntent, saleId);
  const { data: claimed, error: refundError } = await admin
    .from("sales")
    .update({ status: "refunded", payment_method: "stripe", ...customer })
    .eq("id", saleId)
    .eq("status", "cancelled")
    .select("id");
  if (refundError) throw new Error(`Could not update the order: ${refundError.message}`);
  if (claimed.length && deps.emails !== false) await sendOrderEmails(saleId, "refunded");
  return "refunded";
}

/** An unpaid session expired: the pending sale is cancelled. Stock was never touched. */
export async function expireOnlineSale(saleId: string, sessionId: string): Promise<void> {
  if (!UUID.test(saleId)) return;
  const { error } = await createAdminClient()
    .from("sales")
    .update({ status: "cancelled" })
    .eq("id", saleId)
    .eq("status", "pending")
    .eq("stripe_session_id", sessionId);
  if (error) throw new Error(`Could not cancel the order: ${error.message}`);
}

/** Checkout could not start (Stripe error): cancel the pending sale that has no session. */
export async function cancelUnstartedSale(saleId: string): Promise<void> {
  if (!UUID.test(saleId)) return;
  await createAdminClient().from("sales").update({ status: "cancelled" }).eq("id", saleId).eq("status", "pending").is("stripe_session_id", null);
}

// ---------------------------------------------------------------------------
// Order page
// ---------------------------------------------------------------------------

export type PublicOrder = {
  id: string;
  number: string;
  status: "pending" | "paid" | "cancelled" | "refunded";
  totalCents: number;
  currency: string;
  createdAt: string;
  items: { name: string; qty: number; unitPriceCents: number }[];
  /** Only when the visitor proved they own the order (matching session id). */
  customer: { name: string | null; email: string | null } | null;
};

export function orderNumber(saleId: string) {
  return saleId.slice(0, 8).toUpperCase();
}

/**
 * An online order of the resolved store's shop. If it is still pending and the
 * visitor holds its Checkout Session id (the success redirect), ask Stripe and
 * complete it now, so the page does not depend on the webhook arriving first.
 */
export async function getOrderForStore(storeKey: string, saleId: string, sessionId?: string | null, deps?: CompletionDeps): Promise<PublicOrder | null> {
  if (!UUID.test(saleId)) return null;
  const shop = await getShopForPublishedStore(storeKey);
  if (!shop) return null;
  const admin = createAdminClient();

  const load = async () => {
    const { data, error } = await admin
      .from("sales")
      .select("id, status, total_cents, created_at, stripe_session_id, customer_name, customer_email, sale_items(name, qty, unit_price_cents)")
      .eq("id", saleId)
      .eq("shop_id", shop.shopId)
      .eq("channel", "online")
      .maybeSingle();
    if (error) throw new Error(`Could not load the order: ${error.message}`);
    return data;
  };

  let sale = await load();
  if (!sale) return null;
  const owner = Boolean(sessionId && sale.stripe_session_id && sessionId === sale.stripe_session_id);

  if (owner && sale.status === "pending") {
    try {
      const session = await stripe().checkout.sessions.retrieve(sale.stripe_session_id!);
      if (session.payment_status === "paid") {
        await completeOnlineSale(sale.id, session, deps);
        sale = (await load()) ?? sale;
      }
    } catch (e) {
      // The webhook will complete it; the page shows "being confirmed".
      console.error("[orders] could not check the payment", { saleId, error: (e as Error).message });
    }
  }

  return {
    id: sale.id,
    number: orderNumber(sale.id),
    status: sale.status as PublicOrder["status"],
    totalCents: sale.total_cents,
    currency: shop.currency,
    createdAt: sale.created_at,
    items: sale.sale_items.map((i) => ({ name: i.name, qty: i.qty, unitPriceCents: i.unit_price_cents })),
    customer: owner ? { name: sale.customer_name, email: sale.customer_email } : null,
  };
}

// ---------------------------------------------------------------------------
// Emails (sent once per order, by whoever won the claim above)
// ---------------------------------------------------------------------------

async function sendOrderEmails(saleId: string, outcome: "paid" | "refunded") {
  try {
    const { data: sale } = await createAdminClient()
      .from("sales")
      .select("id, total_cents, customer_name, customer_email, customer_phone, shops(name, email, notification_email, currency), sale_items(name, qty, unit_price_cents)")
      .eq("id", saleId)
      .single();
    if (!sale?.shops) return;
    const shop = sale.shops;
    const money = (c: number) => formatMoney(c, shop.currency);
    const number = orderNumber(sale.id);
    const itemLines = sale.sale_items.map((i) => `${i.qty} × ${i.name}  ${money(i.unit_price_cents * i.qty)}`).join("\n");
    const shopEmail = shop.notification_email ?? shop.email;
    const messages: EmailMessage[] = [];

    if (outcome === "paid") {
      if (sale.customer_email)
        messages.push({
          to: sale.customer_email,
          subject: `Your order from ${shop.name} (#${number})`,
          text: `Hi${sale.customer_name ? ` ${sale.customer_name}` : ""},\n\nThanks for your order. Your payment is confirmed.\n\nOrder #${number}\n${itemLines}\n\nTotal: ${money(sale.total_cents)}\n\nWe will be in touch about collection or delivery. Reply to this email if you have any questions.\n\n${shop.name}`,
          replyTo: shopEmail,
        });
      if (shopEmail)
        messages.push({
          to: shopEmail,
          subject: `New online order #${number} (${money(sale.total_cents)})`,
          text: `You have a new online order. Stock has already been reduced.\n\nOrder #${number}\n${itemLines}\n\nTotal: ${money(sale.total_cents)}\n\nCustomer: ${sale.customer_name ?? "Not given"}\nEmail: ${sale.customer_email ?? "Not given"}\nPhone: ${sale.customer_phone ?? "Not given"}\n\nSee it in Sales: ${serverEnv().APP_URL.replace(/\/$/, "")}/core/sales/${sale.id}`,
          replyTo: sale.customer_email,
        });
    } else {
      if (sale.customer_email)
        messages.push({
          to: sale.customer_email,
          subject: `Your order from ${shop.name} was refunded (#${number})`,
          text: `Hi${sale.customer_name ? ` ${sale.customer_name}` : ""},\n\nSorry: an item in your order sold out just before your payment went through, so we could not complete it. We have refunded the full amount of ${money(sale.total_cents)}. It can take 5 to 10 days to show on your statement.\n\nOrder #${number}\n${itemLines}\n\n${shop.name}`,
          replyTo: shopEmail,
        });
      if (shopEmail)
        messages.push({
          to: shopEmail,
          subject: `Online order #${number} refunded: item sold out`,
          text: `An online order was paid after an item had sold out, so it was refunded automatically. No stock was changed.\n\nOrder #${number}\n${itemLines}\n\nTotal refunded: ${money(sale.total_cents)}`,
          replyTo: sale.customer_email,
        });
    }
    await sendEmails(messages);
  } catch (e) {
    console.error("[orders] could not send order emails", { saleId, error: (e as Error).message });
  }
}
