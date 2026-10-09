"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { cancelUnstartedSale, createPendingOnlineSale, markSaleSession, quoteBasket, RESERVATION_MINUTES, type OrderQuote } from "@/core/api-orders";
import { requireShop } from "@/core/shop";
import { BASKET_MAX_LINES, BASKET_MAX_QTY, quoteLines } from "@/lib/basket-total";
import { clientHash } from "@/lib/client-hash";
import { DELIVERY_COUNTRIES, FULFILMENTS } from "@/lib/fulfilment";
import { platformFeeCents, stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { loadPublicCtx } from "@/stores/data";

// Basket and checkout for the public store. The client sends product ids,
// quantities and "collection" or "delivery"; every name, price, stock figure
// and the delivery fee is re-read on the server.

const linesSchema = z
  .array(z.object({ productId: z.uuid(), qty: z.number().int().min(1).max(BASKET_MAX_QTY) }))
  .max(BASKET_MAX_LINES);
const keySchema = z.string().min(1).max(253);
const fulfilmentSchema = z.enum(FULFILMENTS);

export type QuoteResult = { quote: OrderQuote | null; error?: string };

/** Live quote for the basket page. In the editor preview, quotes the owner's own products. */
export async function quoteBasketAction(storeKey: string, lines: unknown, preview = false): Promise<QuoteResult> {
  const parsed = linesSchema.safeParse(lines);
  if (!parsed.success || !keySchema.safeParse(storeKey).success) return { quote: null, error: "Your basket could not be read. Remove the items and add them again." };

  if (preview) {
    const { shop } = await requireShop();
    const ids = parsed.data.map((l) => l.productId);
    const supabase = await createClient();
    const { data, error } = ids.length
      ? await supabase.from("products").select("id, name, price_cents, stock_qty").eq("shop_id", shop.id).eq("visible_online", true).eq("is_part", false).in("id", ids)
      : { data: [], error: null };
    if (error) return { quote: null, error: "Could not load prices. Try again." };
    return {
      quote: {
        ...quoteLines(parsed.data, data),
        currency: shop.currency,
        fulfilment: { collection: shop.collection_enabled, delivery: shop.delivery_enabled, deliveryFeeCents: shop.delivery_fee_cents },
        paymentsReady: Boolean(shop.stripe_account_id && shop.stripe_charges_enabled),
      },
    };
  }

  const quote = await quoteBasket(storeKey, parsed.data);
  if (!quote) return { quote: null, error: "This shop is not taking online orders right now." };
  return { quote };
}

/** The origin the customer is on: /s/<slug> on the app host, a subdomain or a custom domain. */
async function requestOrigin() {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0].trim();
  if (!/^[a-z0-9.-]+(:\d{1,5})?$/i.test(host)) throw new Error("Bad host");
  const forwarded = h.get("x-forwarded-proto")?.split(",")[0].trim();
  const proto = forwarded === "http" || forwarded === "https" ? forwarded : /^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https";
  return `${proto}://${host}`;
}

export type CheckoutResult = { error: string; quote?: OrderQuote };

export async function checkoutAction(storeKey: string, lines: unknown, fulfilment: unknown): Promise<CheckoutResult> {
  const parsedKey = keySchema.safeParse(storeKey);
  const parsed = linesSchema.min(1).safeParse(lines);
  if (!parsedKey.success || !parsed.success) return { error: "Your basket could not be read. Remove the items and add them again." };
  const parsedFulfilment = fulfilmentSchema.safeParse(fulfilment);
  if (!parsedFulfilment.success) return { error: "Choose collection or delivery." };

  const ctx = await loadPublicCtx(parsedKey.data);
  if (!ctx || !ctx.config.content.tabs.shop) return { error: "This shop is not taking online orders right now." };

  // Validates basket, fulfilment and payments set-up, then holds the stock.
  const pending = await createPendingOnlineSale(ctx.storeKey, parsed.data, { fulfilment: parsedFulfilment.data, clientHash: await clientHash() });
  if (!pending.ok) return { error: pending.error, quote: pending.quote };

  const origin = await requestOrigin();
  const orderPath = `${ctx.base}/order/${pending.saleId}`;
  const currency = pending.shop.currency.toLowerCase();
  // Application fees only exist on connected-account (direct) charges.
  const connected = Boolean(pending.shop.stripeAccountId);
  const applicationFee = connected ? platformFeeCents(pending.totalCents) : 0;
  const delivery = pending.fulfilment === "delivery";
  let url: string | null;
  try {
    const session = await stripe().checkout.sessions.create(
      {
        mode: "payment",
        currency,
        line_items: [
          ...pending.quote.lines
            .filter((l) => l.qty > 0)
            .map((l) => ({
              quantity: l.qty,
              price_data: { currency, unit_amount: l.unitPriceCents, product_data: { name: (l.name ?? "Item").slice(0, 250) } },
            })),
          // Priced from shops.delivery_fee_cents (via the pending sale), never from the client.
          ...(delivery && pending.deliveryFeeCents > 0
            ? [{ quantity: 1, price_data: { currency, unit_amount: pending.deliveryFeeCents, product_data: { name: "Delivery" } } }]
            : []),
        ],
        phone_number_collection: { enabled: true },
        ...(delivery ? { shipping_address_collection: { allowed_countries: [...DELIVERY_COUNTRIES] } } : {}),
        metadata: { sale_id: pending.saleId, store_key: ctx.storeKey },
        payment_intent_data: {
          metadata: { sale_id: pending.saleId, store_key: ctx.storeKey },
          description: `${pending.shop.storeName} order`,
          ...(applicationFee > 0 ? { application_fee_amount: applicationFee } : {}),
        },
        client_reference_id: pending.saleId,
        success_url: `${origin}${orderPath}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}${ctx.base}/basket`,
        // Matches the stock hold. Stripe needs at least 30 minutes.
        expires_at: Math.floor(Date.now() / 1000) + RESERVATION_MINUTES * 60,
      },
      // Direct charge on the shop's own Stripe account; platform account only
      // while the shop isn't connected and PLATFORM_CHARGES_FALLBACK is on.
      { idempotencyKey: `sellify-checkout-${pending.saleId}`, ...(connected ? { stripeAccount: pending.shop.stripeAccountId! } : {}) },
    );
    await markSaleSession(pending.saleId, session.id);
    url = session.url;
  } catch (e) {
    console.error("[checkout] could not start payment", { saleId: pending.saleId, error: (e as Error).message });
    await cancelUnstartedSale(pending.saleId).catch(() => undefined); // gives the held stock back
    return { error: "We could not start the payment. Try again in a moment." };
  }
  if (!url) return { error: "We could not start the payment. Try again in a moment." };
  redirect(url);
}
