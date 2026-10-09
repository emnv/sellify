import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderForStore } from "@/core/api-orders";
import { addressLines, fulfilmentLabel } from "@/lib/fulfilment";
import { formatMoney } from "@/lib/money";
import { BasketView, ClearBasket, PendingRefresher } from "./basket-page";
import { storeHref, type StoreCtx } from "./context";
import { Section, StoreCard, StoreLinkButton, StoreNotice } from "./ui";

// Basket and order confirmation pages, shared by the public store and (for
// the basket) the editor preview.

export function BasketPage({ ctx }: { ctx: StoreCtx }) {
  if (!ctx.config.content.tabs.shop) notFound();
  return (
    <Section title="Your basket">
      <BasketView storeKey={ctx.storeKey} base={ctx.base} preview={ctx.preview} />
    </Section>
  );
}

export async function OrderPage({ ctx, saleId, sessionId }: { ctx: StoreCtx; saleId: string; sessionId?: string | null }) {
  if (ctx.preview) notFound();
  const order = await getOrderForStore(ctx.storeKey, saleId, sessionId);
  if (!order) notFound();
  const money = (c: number) => formatMoney(c, order.currency);
  // The delivery address is personal: only shown to the customer who paid (matching session).
  const address = addressLines(order.customer?.shippingAddress ?? null);
  const nextStep =
    order.fulfilment === "delivery"
      ? "The shop will let you know when your order is on its way."
      : order.fulfilment === "collection"
        ? "The shop will let you know when your order is ready to collect."
        : "The shop will be in touch about collection or delivery.";

  const heading =
    order.status === "paid"
      ? "Thanks, your order is confirmed"
      : order.status === "pending"
        ? "Payment is being confirmed…"
        : order.status === "refunded"
          ? "Order refunded: an item sold out"
          : "Order cancelled";

  return (
    <Section>
      {order.status === "paid" && order.customer ? <ClearBasket storeKey={ctx.storeKey} /> : null}
      {order.status === "pending" && order.customer ? <PendingRefresher /> : null}
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div className="flex flex-col gap-2">
          <p className="text-store-sm font-semibold text-store-muted">Order #{order.number}</p>
          <h1 className="font-store-heading text-store-3xl font-bold tracking-tight">{heading}</h1>
        </div>

        {order.status === "paid" ? (
          <StoreNotice>
            {order.customer?.email ? `A confirmation is on its way to ${order.customer.email}. If it doesn't arrive, keep your order number. ` : "Keep your order number. "}
            {nextStep}
          </StoreNotice>
        ) : order.status === "pending" ? (
          <StoreNotice>
            Your payment went through to our payment provider and we are confirming it now. This page updates by itself, or{" "}
            <Link href={`${storeHref(ctx, `/order/${order.id}`)}${sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : ""}`} className="font-semibold underline">
              check again
            </Link>
            .
          </StoreNotice>
        ) : order.status === "refunded" ? (
          <StoreNotice tone="error">
            Sorry: an item sold out just before your payment went through, so we could not complete this order. We have refunded the full amount. It can
            take 5 to 10 days to show on your statement.
          </StoreNotice>
        ) : (
          <StoreNotice tone="error">This order was not paid and has been cancelled. Nothing was charged.</StoreNotice>
        )}

        <StoreCard className="divide-y divide-store-border">
          {order.items.map((item, i) => (
            <div key={`${item.name}-${i}`} className="flex items-baseline justify-between gap-4 p-4">
              <span>
                {item.qty} × {item.name}
              </span>
              <span className="font-semibold">{money(item.unitPriceCents * item.qty)}</span>
            </div>
          ))}
          {order.fulfilment === "delivery" ? (
            <div className="flex items-baseline justify-between gap-4 p-4">
              <span>Delivery</span>
              <span className="font-semibold">{order.deliveryFeeCents > 0 ? money(order.deliveryFeeCents) : "Free"}</span>
            </div>
          ) : null}
          <div className="flex items-baseline justify-between gap-4 p-4">
            <span className="font-semibold">Total</span>
            <span className="text-store-xl font-bold">{money(order.totalCents)}</span>
          </div>
        </StoreCard>

        {order.fulfilment ? (
          <StoreCard className="flex flex-col gap-1 p-4">
            <p className="text-store-sm font-semibold text-store-muted">{order.fulfilment === "delivery" ? "Delivery to" : "Collection"}</p>
            {order.fulfilment === "delivery" ? (
              address.length ? (
                address.map((line, i) => <span key={`${line}-${i}`}>{line}</span>)
              ) : (
                <span>The address given when paying.</span>
              )
            ) : (
              <span>{fulfilmentLabel(order.fulfilment)}</span>
            )}
          </StoreCard>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <StoreLinkButton href={storeHref(ctx, "/shop")} variant="outline">
            Continue shopping
          </StoreLinkButton>
          {order.status !== "paid" && order.status !== "pending" ? <StoreLinkButton href={storeHref(ctx, "/basket")}>Back to basket</StoreLinkButton> : null}
        </div>
      </div>
    </Section>
  );
}
