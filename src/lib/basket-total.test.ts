import { describe, expect, it } from "vitest";
import { BASKET_MAX_LINES, BASKET_MAX_QTY, normalizeLines, quoteLines } from "./basket-total";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const C = "00000000-0000-4000-8000-00000000000c";

const products = [
  { id: A, name: "Case", price_cents: 1500, stock_qty: 10 },
  { id: B, name: "Charger", price_cents: 2999, stock_qty: 2 },
  { id: C, name: "Cable", price_cents: 999, stock_qty: 0 },
];

describe("normalizeLines", () => {
  it("merges duplicates and drops bad quantities", () => {
    expect(
      normalizeLines([
        { productId: A, qty: 1 },
        { productId: A, qty: 2 },
        { productId: B, qty: 0 },
        { productId: B, qty: 1.5 },
      ]),
    ).toEqual([{ productId: A, qty: 3 }]);
  });

  it("caps quantity and line count", () => {
    expect(normalizeLines([{ productId: A, qty: 500 }])[0].qty).toBe(BASKET_MAX_QTY);
    const many = Array.from({ length: 80 }, (_, i) => ({ productId: `id-${i}`, qty: 1 }));
    expect(normalizeLines(many)).toHaveLength(BASKET_MAX_LINES);
  });
});

describe("quoteLines", () => {
  it("prices lines from product rows", () => {
    const q = quoteLines([{ productId: A, qty: 2 }], products);
    expect(q.totalCents).toBe(3000);
    expect(q.itemCount).toBe(2);
    expect(q.lines[0]).toMatchObject({ name: "Case", unitPriceCents: 1500, qty: 2, status: "ok" });
    expect(q.changed).toBe(false);
  });

  it("reduces to stock, flags sold out and missing products", () => {
    const q = quoteLines(
      [
        { productId: B, qty: 5 },
        { productId: C, qty: 1 },
        { productId: "00000000-0000-4000-8000-0000000000ff", qty: 1 },
      ],
      products,
    );
    expect(q.lines.map((l) => [l.status, l.qty])).toEqual([
      ["reduced", 2],
      ["sold_out", 0],
      ["missing", 0],
    ]);
    expect(q.totalCents).toBe(5998);
    expect(q.itemCount).toBe(2);
    expect(q.changed).toBe(true);
  });

  it("returns an empty quote for an empty basket", () => {
    expect(quoteLines([], products)).toEqual({ lines: [], totalCents: 0, itemCount: 0, changed: false });
  });
});
