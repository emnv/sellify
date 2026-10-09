// Money is stored as integer cents everywhere. These helpers are the only
// place that converts to and from what people type and read.

export function formatMoney(cents: number, currency = "EUR"): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency }).format(cents / 100);
}

/** "129", "129.5", "129,50", "€1,299.00" → cents. Returns null if not a valid amount. */
export function parseMoneyToCents(input: unknown): number | null {
  if (typeof input !== "string") return null;
  let s = input.trim().replace(/[€\s]/g, "");
  if (s === "") return null;
  // "1.299,50" or "129,50": comma is the decimal separator.
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const cents = Math.round(Number(s) * 100);
  return Number.isSafeInteger(cents) && cents <= 100_000_000 ? cents : null;
}

/** Cents → plain input value ("129.00"). */
export function centsToInput(cents: number | null | undefined): string {
  return cents == null ? "" : (cents / 100).toFixed(2);
}
