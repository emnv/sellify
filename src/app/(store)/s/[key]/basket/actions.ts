"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { cancelUnstartedSale, createPendingOnlineSale, markSaleSession, quoteBasket, type OrderQuote } from "@/core/api-orders";
import { requireShop } from "@/core/shop";
import { BASKET_MAX_LINES, BASKET_MAX_QTY, quoteLines } from "@/lib/basket-total";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { loadPublicCtx } from "@/stores/data";

// Basket and checkout for the public store. The client sends product ids and
// quantities only; every name, price and stock figure is re-read on the server.

const linesSchema = z
  .array(z.object({ productId: z.uuid(), qty: z.number().int().min(1).max(BASKET_MAX_QTY) }))
  .max(BASKET_MAX_LINES);
const keySchema = z.string().min(1).max(253);

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
    return { quote: { ...quoteLines(parsed.data, data), currency: shop.currency } };
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

export async function checkoutAction(storeKey: string, lines: unknown): Promise<CheckoutResult> {
  const parsedKey = keySchema.safeParse(storeKey);
  const parsed = linesSchema.min(1).safeParse(lines);
  if (!parsedKey.success || !parsed.success) return { error: "Your basket could not be read. Remove the items and add them again." };

  const ctx = await loadPublicCtx(parsedKey.data);
  if (!ctx || !ctx.config.content.tabs.shop) return { error: "This shop is not taking online orders right now." };

  const pending = await createPendingOnlineSale(ctx.storeKey, parsed.data);
  if (!pending.ok) return { error: pending.error, quote: pending.quote };

  const origin = await requestOrigin();
  const orderPath = `${ctx.base}/order/${pending.saleId}`;
  let url: string | null;
  try {
    const session = await stripe().checkout.sessions.create(
      {
        mode: "payment",
        currency: pending.shop.currency.toLowerCase(),
        line_items: pending.quote.lines
          .filter((l) => l.qty > 0)
          .map((l) => ({
            quantity: l.qty,
            price_data: {
              currency: pending.shop.currency.toLowerCase(),
              unit_amount: l.unitPriceCents,
              product_data: { name: (l.name ?? "Item").slice(0, 250) },
            },
          })),
        metadata: { sale_id: pending.saleId, store_key: ctx.storeKey },
        payment_intent_data: { metadata: { sale_id: pending.saleId, store_key: ctx.storeKey }, description: `${pending.shop.storeName} order` },
        client_reference_id: pending.saleId,
        success_url: `${origin}${orderPath}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}${ctx.base}/basket`,
        // Stripe needs at least 30 minutes; one extra minute absorbs clock skew.
        expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
      },
      { idempotencyKey: `sellify-checkout-${pending.saleId}` },
    );
    await markSaleSession(pending.saleId, session.id);
    url = session.url;
  } catch (e) {
    console.error("[checkout] could not start payment", { saleId: pending.saleId, error: (e as Error).message });
    await cancelUnstartedSale(pending.saleId).catch(() => undefined);
    return { error: "We could not start the payment. Try again in a moment." };
  }
  if (!url) return { error: "We could not start the payment. Try again in a moment." };
  redirect(url);
}
