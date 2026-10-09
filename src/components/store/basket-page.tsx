"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { checkoutAction, quoteBasketAction } from "@/app/(store)/s/[key]/basket/actions";
import type { OrderQuote } from "@/core/api-orders";
import { BASKET_MAX_QTY, type QuotedLine } from "@/lib/basket-total";
import { formatMoney } from "@/lib/money";
import { useBasket, type BasketLine } from "@/stores/basket";
import { StoreButton, StoreCard, StoreLinkButton, StoreNotice } from "./ui";

// Basket UI. The basket in localStorage holds ids and quantities only; what is
// shown (names, prices, stock, total) is the server's live quote.

const noopSubscribe = () => () => {};
const useHydrated = () => useSyncExternalStore(noopSubscribe, () => true, () => false);

function noticeFor(line: QuotedLine): string | null {
  const name = line.name ?? "An item";
  if (line.status === "missing") return `${name} is no longer for sale and was removed.`;
  if (line.status === "sold_out") return `${name} sold out and was removed.`;
  if (line.status === "reduced") return `Only ${line.stock} of ${name} left, so we changed your quantity to ${line.stock}.`;
  return null;
}

/** Bring the stored basket in line with what the server says can be bought. */
function syncedLines(lines: BasketLine[], quote: OrderQuote): BasketLine[] | null {
  let changed = false;
  const next: BasketLine[] = [];
  for (const l of lines) {
    const q = quote.lines.find((x) => x.productId === l.productId);
    if (!q) continue;
    if (q.qty !== l.qty) changed = true;
    if (q.qty > 0) next.push({ productId: l.productId, qty: q.qty });
  }
  return changed ? next : null;
}

export function BasketView({ storeKey, base, preview }: { storeKey: string; base: string; preview: boolean }) {
  const hydrated = useHydrated();
  const basket = useBasket(storeKey);
  const { lines } = basket;
  const [quote, setQuote] = useState<OrderQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notices, setNotices] = useState<string[]>([]);
  const [checkingOut, startCheckout] = useTransition();
  const request = useRef(0);
  const linesKey = JSON.stringify(lines);

  // Re-quote whenever the basket changes.
  useEffect(() => {
    if (!hydrated) return;
    const current = JSON.parse(linesKey) as BasketLine[];
    if (current.length === 0) return;
    const id = ++request.current;
    quoteBasketAction(storeKey, current, preview)
      .then((res) => {
        if (id !== request.current) return;
        setError(res.error ?? null);
        setQuote(res.quote);
        if (res.quote) applyQuote(current, res.quote);
      })
      .catch(() => {
        if (id === request.current) setError("Could not load prices. Check your connection and try again.");
      });
    // applyQuote only touches the basket store and notices.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, linesKey, storeKey, preview]);

  function applyQuote(current: BasketLine[], q: OrderQuote) {
    const fresh = q.lines.map(noticeFor).filter((n): n is string => Boolean(n));
    if (fresh.length) setNotices((prev) => [...new Set([...prev, ...fresh])]);
    const next = syncedLines(current, q);
    if (next) {
      for (const l of current) {
        const n = next.find((x) => x.productId === l.productId);
        if (!n) basket.setQty(l.productId, 0);
        else if (n.qty !== l.qty) basket.setQty(l.productId, n.qty);
      }
    }
  }

  function change(productId: string, qty: number) {
    setNotices([]);
    setError(null);
    basket.setQty(productId, qty);
  }

  function checkout() {
    setNotices([]);
    setError(null);
    startCheckout(async () => {
      const res = await checkoutAction(storeKey, lines);
      // Only reached on failure: success redirects to Stripe.
      if (res?.error) {
        setError(res.error);
        if (res.quote) {
          setQuote(res.quote);
          applyQuote(lines, res.quote);
        }
      }
    });
  }

  if (!hydrated) return <p className="text-store-muted">Loading your basket…</p>;

  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4">
        {notices.map((n) => (
          <StoreNotice key={n}>{n}</StoreNotice>
        ))}
        <p className="text-store-muted">Your basket is empty.</p>
        <StoreLinkButton href={`${base}/shop`}>Browse the shop</StoreLinkButton>
      </div>
    );
  }

  const shown = lines.map((l) => ({ line: l, q: quote?.lines.find((x) => x.productId === l.productId) }));
  const loading = !quote || shown.some((s) => !s.q);

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      <div className="flex flex-col gap-4 lg:col-span-2">
        {notices.map((n) => (
          <StoreNotice key={n}>{n}</StoreNotice>
        ))}
        {error ? <StoreNotice tone="error">{error}</StoreNotice> : null}
        <StoreCard className="divide-y divide-store-border">
          {shown.map(({ line, q }) => {
            const max = Math.min(q?.stock ?? line.qty, BASKET_MAX_QTY);
            const name = q?.name ?? "Loading…";
            return (
              <div key={line.productId} className="flex flex-wrap items-center gap-4 p-4">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Link href={`${base}/shop/${line.productId}`} className="truncate font-semibold hover:text-store-primary">
                    {name}
                  </Link>
                  {q ? <p className="text-store-sm text-store-muted">{formatMoney(q.unitPriceCents, quote!.currency)} each</p> : null}
                </div>
                <div className="flex items-center gap-2" role="group" aria-label={`Quantity of ${name}`}>
                  <StoreButton variant="outline" aria-label={`One fewer ${name}`} disabled={checkingOut || line.qty <= 1} onClick={() => change(line.productId, line.qty - 1)}>
                    −
                  </StoreButton>
                  <span className="min-w-8 text-center font-semibold" aria-live="polite">
                    {line.qty}
                  </span>
                  <StoreButton variant="outline" aria-label={`One more ${name}`} disabled={checkingOut || line.qty >= max} onClick={() => change(line.productId, line.qty + 1)}>
                    +
                  </StoreButton>
                </div>
                <p className="w-24 text-right font-semibold">{q ? formatMoney(q.lineTotalCents, quote!.currency) : "…"}</p>
                <StoreButton variant="ghost" disabled={checkingOut} onClick={() => change(line.productId, 0)}>
                  Remove
                </StoreButton>
              </div>
            );
          })}
        </StoreCard>
      </div>

      <StoreCard className="flex h-fit flex-col gap-4 p-6">
        <h2 className="font-store-heading text-store-xl font-bold">Summary</h2>
        <div className="flex items-baseline justify-between">
          <span className="text-store-muted">Total</span>
          <span className="text-store-2xl font-bold" aria-live="polite">
            {quote && !loading ? formatMoney(quote.totalCents, quote.currency) : "…"}
          </span>
        </div>
        <p className="text-store-sm text-store-muted">Prices and stock are checked again when you pay.</p>
        <StoreButton full disabled={preview || loading || checkingOut || !quote || quote.itemCount === 0} onClick={checkout}>
          {checkingOut ? "Opening secure payment…" : "Checkout"}
        </StoreButton>
        {preview ? <p className="text-store-sm text-store-muted">Checkout is turned off in the preview. Customers pay on your published store.</p> : null}
      </StoreCard>
    </div>
  );
}

/** Empties the basket once an order is confirmed. */
export function ClearBasket({ storeKey }: { storeKey: string }) {
  const { lines, clear } = useBasket(storeKey);
  const hasLines = lines.length > 0;
  useEffect(() => {
    if (hasLines) clear();
  }, [hasLines, clear]);
  return null;
}

/** While payment is being confirmed, re-check the order every few seconds (up to a minute). */
export function PendingRefresher() {
  const router = useRouter();
  useEffect(() => {
    let n = 0;
    const t = setInterval(() => {
      n += 1;
      if (n > 20) clearInterval(t);
      else router.refresh();
    }, 3000);
    return () => clearInterval(t);
  }, [router]);
  return null;
}
