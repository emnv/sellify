// Pure basket maths, shared by the server quote and checkout. Prices, names
// and stock always come from the database rows passed in here; the client
// only ever supplies product ids and quantities.

export const BASKET_MAX_LINES = 50;
export const BASKET_MAX_QTY = 20;

export type RequestedLine = { productId: string; qty: number };

export type ProductRow = { id: string; name: string; price_cents: number; stock_qty: number };

export type LineStatus = "ok" | "reduced" | "sold_out" | "missing";

export type QuotedLine = {
  productId: string;
  /** Current name from the database; null when the product is gone. */
  name: string | null;
  unitPriceCents: number;
  stock: number;
  requestedQty: number;
  /** Quantity that can actually be bought (0 for sold out / missing). */
  qty: number;
  lineTotalCents: number;
  status: LineStatus;
};

export type BasketQuote = {
  lines: QuotedLine[];
  totalCents: number;
  itemCount: number;
  /** True when any line was removed or reduced compared to the request. */
  changed: boolean;
};

/** Merge duplicate ids, drop invalid quantities, cap qty and line count. */
export function normalizeLines(lines: RequestedLine[]): RequestedLine[] {
  const merged = new Map<string, number>();
  for (const l of lines) {
    if (!Number.isInteger(l.qty) || l.qty <= 0) continue;
    merged.set(l.productId, (merged.get(l.productId) ?? 0) + l.qty);
  }
  return [...merged.entries()].slice(0, BASKET_MAX_LINES).map(([productId, qty]) => ({ productId, qty: Math.min(qty, BASKET_MAX_QTY) }));
}

/** Price a basket against current product rows. */
export function quoteLines(requested: RequestedLine[], products: ProductRow[]): BasketQuote {
  const byId = new Map(products.map((p) => [p.id, p]));
  const lines: QuotedLine[] = normalizeLines(requested).map(({ productId, qty: requestedQty }) => {
    const p = byId.get(productId);
    if (!p) return { productId, name: null, unitPriceCents: 0, stock: 0, requestedQty, qty: 0, lineTotalCents: 0, status: "missing" };
    const stock = Math.max(0, p.stock_qty);
    const qty = Math.min(requestedQty, stock);
    const status: LineStatus = stock === 0 ? "sold_out" : qty < requestedQty ? "reduced" : "ok";
    return { productId, name: p.name, unitPriceCents: p.price_cents, stock, requestedQty, qty, lineTotalCents: p.price_cents * qty, status };
  });
  return {
    lines,
    totalCents: lines.reduce((sum, l) => sum + l.lineTotalCents, 0),
    itemCount: lines.reduce((n, l) => n + l.qty, 0),
    changed: lines.some((l) => l.status !== "ok") || requested.length !== lines.length,
  };
}
