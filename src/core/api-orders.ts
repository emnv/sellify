import "server-only";
import { getPublicStore, getShopForPublishedStore, type ShopForStore } from "@/core/api";
import { quoteLines, type BasketQuote, type RequestedLine } from "@/lib/basket-total";
import { sendEmails, type EmailMessage } from "@/lib/email/send";
import { serverEnv } from "@/lib/env.server";
import {
  addressLines,
  deliveryFeeFor,
  fulfilmentLabel,
  PAYMENTS_OFF_MESSAGE,
  shippingAddressJson,
  toShippingAddress,
  type Fulfilment,
  type FulfilmentOptions,
  type ShippingAddress,
} from "@/lib/fulfilment";
import { formatMoney } from "@/lib/money";
import { stripe, type Stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

// =============================================================================
// THE SEAM, online orders (part of @/core/api). Store checkout reaches Core
// sales and stock ONLY through these functions.
//
// Every step re-resolves the published store from its key and re-reads names,
// prices, stock, fulfilment options and the delivery fee from the database
// with the service role. The client sends product ids, quantities and
// "collection" or "delivery", nothing else.
//
// Order lifecycle:
//   createPendingOnlineSale → sale 'pending' with item snapshots, then
//                             reserve_online_sale(): stock is held (decremented)
//                             for RESERVATION_MINUTES so a POS sale can't take
//                             the same unit while the customer pays
//   markSaleSession         → links the Stripe Checkout Session
//   completeOnlineSale      → finalize_online_sale(): reserved → 'paid'; hold
//                             already released → takes stock now, or (sold out
//                             meanwhile) refund → 'refunded'
//   expireOnlineSale        → session expired unpaid → release_online_sale():
//                             stock back, 'cancelled'
//   releaseExpiredReservations → cron backstop for holds whose expiry event
//                             never arrived
//
// Payments are Stripe Connect direct charges on the shop's own account
// (shops.stripe_account_id), so session retrieval and refunds pass that
// account as `stripeAccount`.
//
// "Exactly once" side effects (emails) hang off an atomic claim: the single
// UPDATE that records payment_method = 'stripe' (paid) or flips 'cancelled' to
// 'refunded'. Only the caller whose UPDATE matched a row sends emails, so the
// webhook and the order page can race safely.
// =============================================================================

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** How long stock is held for a checkout. Stripe sessions live at least 30 minutes. */
export const RESERVATION_MINUTES = 31;

export { PAYMENTS_OFF_MESSAGE };

/**
 * Until Stripe Connect is enabled and a shop finishes onboarding, its online
 * payments can be taken on the platform account (on by default; set
 * PLATFORM_CHARGES_FALLBACK=false once every live shop is connected).
 */
export function platformChargesFallback() {
  return (process.env.PLATFORM_CHARGES_FALLBACK ?? "true").toLowerCase() !== "false";
}

export type OrderQuote = BasketQuote & {
  currency: string;
  /** What the shop offers and what delivery costs (from shops, never the client). */
  fulfilment: FulfilmentOptions;
  /** False until the shop's Stripe account can take payments. */
  paymentsReady: boolean;
};

type CheckoutShop = ShopForStore & {
  storeName: string;
  fulfilment: FulfilmentOptions;
  stripeAccountId: string | null;
  paymentsReady: boolean;
};

/** The shop behind a published store whose Shop tab is on, or null. */
async function shopForCheckout(storeKey: string): Promise<CheckoutShop | null> {
  const store = await getPublicStore(storeKey);
  if (!store || !store.config.content.tabs.shop) return null;
  const shop = await getShopForPublishedStore(storeKey);
  if (!shop) return null;
  const { data, error } = await createAdminClient()
    .from("shops")
    .select("collection_enabled, delivery_enabled, delivery_fee_cents, stripe_account_id, stripe_charges_enabled")
    .eq("id", shop.shopId)
    .single();
  if (error) throw new Error(`Could not load the shop: ${error.message}`);
  const connected = Boolean(data.stripe_account_id && data.stripe_charges_enabled);
  return {
    ...shop,
    storeName: store.config.content.storeName,
    fulfilment: { collection: data.collection_enabled, delivery: data.delivery_enabled, deliveryFeeCents: data.delivery_fee_cents },
    // Only a fully connected account takes the charge; otherwise the platform
    // account does, while PLATFORM_CHARGES_FALLBACK allows it.
    stripeAccountId: connected ? data.stripe_account_id : null,
    paymentsReady: connected || platformChargesFallback(),
  };
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

const orderQuote = (shop: CheckoutShop, quote: BasketQuote): OrderQuote => ({
  ...quote,
  currency: shop.currency,
  fulfilment: shop.fulfilment,
  paymentsReady: shop.paymentsReady,
});

/** Current names, prices and stock for a basket. Null when the store has no shop. */
export async function quoteBasket(storeKey: string, lines: RequestedLine[]): Promise<OrderQuote | null> {
  const shop = await shopForCheckout(storeKey);
  if (!shop) return null;
  return orderQuote(shop, await quoteForShop(shop.shopId, lines));
}

export type PendingSale =
  | {
      ok: true;
      saleId: string;
      quote: OrderQuote;
      shop: CheckoutShop;
      fulfilment: Fulfilment;
      deliveryFeeCents: number;
      /** Items plus delivery: what the customer pays. */
      totalCents: number;
    }
  | { ok: false; error: string; quote?: OrderQuote };

/**
 * Validates the basket and fulfilment choice again, records a pending online
 * sale with name and price snapshots, and holds its stock. Refuses when
 * anything changed since the customer last saw the basket (sold out, less
 * stock), so they never pay for a surprise.
 */
export async function createPendingOnlineSale(
  storeKey: string,
  lines: RequestedLine[],
  options: { fulfilment: Fulfilment; email?: string | null },
): Promise<PendingSale> {
  const shop = await shopForCheckout(storeKey);
  if (!shop) return { ok: false, error: "This shop is not taking online orders right now." };
  const quote = orderQuote(shop, await quoteForShop(shop.shopId, lines));
  if (!shop.paymentsReady) return { ok: false, error: PAYMENTS_OFF_MESSAGE, quote };
  if (quote.itemCount === 0) return { ok: false, error: "Your basket is empty.", quote };
  if (quote.changed) return { ok: false, error: "Some items changed since you added them. Check your basket and try again.", quote };
  if (!shop.fulfilment[options.fulfilment]) {
    return {
      ok: false,
      error: options.fulfilment === "delivery" ? "This shop doesn't deliver. Choose collection in the shop." : "This shop doesn't offer collection. Choose delivery.",
      quote,
    };
  }

  const deliveryFeeCents = deliveryFeeFor(options.fulfilment, shop.fulfilment);
  const totalCents = quote.totalCents + deliveryFeeCents;
  const admin = createAdminClient();
  const { data: sale, error } = await admin
    .from("sales")
    .insert({
      shop_id: shop.shopId,
      channel: "online",
      status: "pending",
      total_cents: totalCents,
      fulfilment: options.fulfilment,
      delivery_fee_cents: deliveryFeeCents,
      customer_email: options.email?.slice(0, 254) || null,
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

  // Hold the stock while the customer pays.
  const { data: reserved, error: reserveError } = await admin.rpc("reserve_online_sale", { p_sale_id: sale.id, p_minutes: RESERVATION_MINUTES });
  if (reserveError || !reserved) {
    await admin.from("sales").update({ status: "cancelled" }).eq("id", sale.id).eq("status", "pending");
    if (reserveError) throw new Error(`Could not reserve the stock: ${reserveError.message}`);
    // Someone bought the last unit between the quote and now.
    const fresh = orderQuote(shop, await quoteForShop(shop.shopId, lines));
    return { ok: false, error: "Some items just sold out. Check your basket and try again.", quote: fresh };
  }

  return { ok: true, saleId: sale.id, quote, shop, fulfilment: options.fulfilment, deliveryFeeCents, totalCents };
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
  /** Refunds the payment. Defaults to a Stripe refund on the account that took it (idempotent per sale). */
  refund?: (paymentIntentId: string, saleId: string, stripeAccount: string | null) => Promise<void>;
  /** Send emails (default true). Tests turn this off. */
  emails?: boolean;
};

type SessionLike = Pick<
  Stripe.Checkout.Session,
  "id" | "payment_status" | "amount_total" | "currency" | "metadata" | "payment_intent" | "customer_details"
> & { collected_information?: Stripe.Checkout.Session["collected_information"] };

async function stripeRefund(paymentIntentId: string, saleId: string, stripeAccount: string | null) {
  await stripe().refunds.create(
    {
      payment_intent: paymentIntentId,
      reason: "requested_by_customer",
      metadata: { sale_id: saleId, reason: "out_of_stock" },
      // Direct charge: give the platform fee back too, so the shop isn't out of pocket.
      ...(stripeAccount ? { refund_application_fee: true } : {}),
    },
    { idempotencyKey: `sellify-refund-${saleId}`, ...(stripeAccount ? { stripeAccount } : {}) },
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
 * Completes a paid Checkout Session: marks the reserved sale paid (or takes
 * the stock now if the hold was released), or refunds when stock ran out.
 * Safe to call any number of times, from the webhook and from the order page
 * at once. `stripeAccount` is the connected account the session lives on
 * (null for a platform session); refunds are made there.
 */
export async function completeOnlineSale(
  saleId: string,
  session: SessionLike,
  deps: CompletionDeps = {},
  stripeAccount: string | null = null,
): Promise<CompletionResult> {
  if (!UUID.test(saleId)) return "ignored";
  const admin = createAdminClient();
  const { data: sale, error } = await admin
    .from("sales")
    .select("id, shop_id, channel, status, total_cents, fulfilment, stripe_session_id, shops(currency)")
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
  // collected_information.shipping_details since API 2025-03-31; top-level shipping_details before
  // (webhook payloads follow the endpoint's API version, which may be older than the SDK's).
  const shipping =
    sale.fulfilment === "delivery"
      ? toShippingAddress(session.collected_information?.shipping_details ?? (session as { shipping_details?: unknown }).shipping_details)
      : null;
  const details = { ...customerFrom(session), ...(shipping ? { shipping_address: shippingAddressJson(shipping) } : {}) };

  if (ok) {
    // Claim: the first caller to record the payment method sends the emails.
    const { data: claimed, error: claimError } = await admin
      .from("sales")
      .update({ payment_method: "stripe", ...details })
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
  await (deps.refund ?? stripeRefund)(paymentIntent, saleId, stripeAccount);
  const { data: claimed, error: refundError } = await admin
    .from("sales")
    .update({ status: "refunded", payment_method: "stripe", ...details })
    .eq("id", saleId)
    .eq("status", "cancelled")
    .select("id");
  if (refundError) throw new Error(`Could not update the order: ${refundError.message}`);
  if (claimed.length && deps.emails !== false) await sendOrderEmails(saleId, "refunded");
  return "refunded";
}

/** Gives held stock back and cancels a pending sale. Falls back to a plain cancel for a sale that holds nothing. */
async function releaseOrCancel(saleId: string, guard: { sessionId: string } | { noSession: true }) {
  const admin = createAdminClient();
  let query = admin.from("sales").select("id").eq("id", saleId).eq("status", "pending");
  query = "sessionId" in guard ? query.eq("stripe_session_id", guard.sessionId) : query.is("stripe_session_id", null);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Could not load the order: ${error.message}`);
  if (!data) return;

  const { data: released, error: releaseError } = await admin.rpc("release_online_sale", { p_sale_id: saleId });
  if (releaseError) throw new Error(`Could not release the stock: ${releaseError.message}`);
  if (released) return;
  const { error: cancelError } = await admin.from("sales").update({ status: "cancelled" }).eq("id", saleId).eq("status", "pending");
  if (cancelError) throw new Error(`Could not cancel the order: ${cancelError.message}`);
}

/** An unpaid session expired: stock goes back and the pending sale is cancelled. */
export async function expireOnlineSale(saleId: string, sessionId: string): Promise<void> {
  if (!UUID.test(saleId)) return;
  await releaseOrCancel(saleId, { sessionId });
}

/** Checkout could not start (Stripe error): release the hold of the pending sale that has no session. */
export async function cancelUnstartedSale(saleId: string): Promise<void> {
  if (!UUID.test(saleId)) return;
  await releaseOrCancel(saleId, { noSession: true });
}

/** Cron backstop: releases holds that ran past their time plus a grace period. Returns how many. */
export async function releaseExpiredReservations(graceMinutes = 5): Promise<number> {
  const { data, error } = await createAdminClient().rpc("release_expired_reservations", { p_grace_minutes: graceMinutes });
  if (error) throw new Error(`Could not release expired reservations: ${error.message}`);
  return data ?? 0;
}

// ---------------------------------------------------------------------------
// Order page
// ---------------------------------------------------------------------------

export type PublicOrder = {
  id: string;
  number: string;
  status: "pending" | "paid" | "cancelled" | "refunded";
  totalCents: number;
  deliveryFeeCents: number;
  fulfilment: Fulfilment | null;
  currency: string;
  createdAt: string;
  items: { name: string; qty: number; unitPriceCents: number }[];
  /** Only when the visitor proved they own the order (matching session id). */
  customer: { name: string | null; email: string | null; shippingAddress: ShippingAddress | null } | null;
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
      .select(
        "id, status, total_cents, delivery_fee_cents, fulfilment, shipping_address, created_at, stripe_session_id, customer_name, customer_email, shops(stripe_account_id), sale_items(name, qty, unit_price_cents)",
      )
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
      const account = sale.shops?.stripe_account_id ?? null;
      const session = await stripe().checkout.sessions.retrieve(sale.stripe_session_id!, {}, account ? { stripeAccount: account } : {});
      if (session.payment_status === "paid") {
        await completeOnlineSale(sale.id, session, deps, account);
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
    deliveryFeeCents: sale.delivery_fee_cents,
    fulfilment: sale.fulfilment === "collection" || sale.fulfilment === "delivery" ? sale.fulfilment : null,
    currency: shop.currency,
    createdAt: sale.created_at,
    items: sale.sale_items.map((i) => ({ name: i.name, qty: i.qty, unitPriceCents: i.unit_price_cents })),
    customer: owner ? { name: sale.customer_name, email: sale.customer_email, shippingAddress: toShippingAddress(sale.shipping_address) } : null,
  };
}

// ---------------------------------------------------------------------------
// Emails (sent once per order, by whoever won the claim above)
// ---------------------------------------------------------------------------

async function sendOrderEmails(saleId: string, outcome: "paid" | "refunded") {
  try {
    const { data: sale } = await createAdminClient()
      .from("sales")
      .select(
        "id, total_cents, delivery_fee_cents, fulfilment, shipping_address, customer_name, customer_email, customer_phone, shops(name, email, phone, address, notification_email, currency), sale_items(name, qty, unit_price_cents)",
      )
      .eq("id", saleId)
      .single();
    if (!sale?.shops) return;
    const shop = sale.shops;
    const money = (c: number) => formatMoney(c, shop.currency);
    const number = orderNumber(sale.id);
    const itemLines = [
      ...sale.sale_items.map((i) => `${i.qty} × ${i.name}  ${money(i.unit_price_cents * i.qty)}`),
      ...(sale.fulfilment === "delivery" ? [`Delivery  ${money(sale.delivery_fee_cents)}`] : []),
    ].join("\n");
    const address = addressLines(toShippingAddress(sale.shipping_address));
    const fulfilment = fulfilmentLabel(sale.fulfilment);
    const deliveryBlock = sale.fulfilment === "delivery" ? `Deliver to:\n${address.length ? address.map((l) => `  ${l}`).join("\n") : "  Not given"}` : null;
    const shopEmail = shop.notification_email ?? shop.email;
    const messages: EmailMessage[] = [];

    if (outcome === "paid") {
      const nextStep =
        sale.fulfilment === "delivery"
          ? "We will let you know when your order is on its way."
          : sale.fulfilment === "collection"
            ? `We will let you know when your order is ready to collect${shop.address ? ` from ${shop.address.replace(/\s*\n\s*/g, ", ")}` : ""}. Bring your order number.`
            : "We will be in touch about collection or delivery.";
      if (sale.customer_email)
        messages.push({
          to: sale.customer_email,
          subject: `Your order from ${shop.name} (#${number})`,
          text: [
            `Hi${sale.customer_name ? ` ${sale.customer_name}` : ""},`,
            "",
            "Thanks for your order. Your payment is confirmed.",
            "",
            `Order #${number}`,
            itemLines,
            "",
            `Total: ${money(sale.total_cents)}`,
            fulfilment ? `Fulfilment: ${fulfilment}` : null,
            deliveryBlock,
            "",
            `${nextStep} Reply to this email if you have any questions.`,
            "",
            shop.name,
            shop.phone ? `Phone: ${shop.phone}` : null,
          ]
            .filter((l) => l !== null)
            .join("\n"),
          replyTo: shopEmail,
        });
      if (shopEmail)
        messages.push({
          to: shopEmail,
          subject: `New online order #${number} (${money(sale.total_cents)}${sale.fulfilment === "delivery" ? ", delivery" : sale.fulfilment === "collection" ? ", collection" : ""})`,
          text: [
            "You have a new online order. Stock has already been reduced.",
            "",
            `Order #${number}`,
            itemLines,
            "",
            `Total: ${money(sale.total_cents)}`,
            fulfilment ? `Fulfilment: ${fulfilment}` : null,
            deliveryBlock,
            "",
            `Customer: ${sale.customer_name ?? "Not given"}`,
            `Email: ${sale.customer_email ?? "Not given"}`,
            `Phone: ${sale.customer_phone ?? "Not given"}`,
            "",
            `See it in Sales: ${serverEnv().APP_URL.replace(/\/$/, "")}/core/sales/${sale.id}`,
          ]
            .filter((l) => l !== null)
            .join("\n"),
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
          text: `An online order was paid after an item had sold out, so it was refunded automatically. No stock was changed.\n\nOrder #${number}\n${itemLines}\n\nTotal refunded: ${money(sale.total_cents)}${fulfilment ? `\nFulfilment: ${fulfilment}` : ""}`,
          replyTo: sale.customer_email,
        });
    }
    await sendEmails(messages);
  } catch (e) {
    console.error("[orders] could not send order emails", { saleId, error: (e as Error).message });
  }
}
