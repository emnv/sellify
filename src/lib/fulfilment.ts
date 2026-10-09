// How an online order reaches the customer, and the delivery address as
// stored on sales.shipping_address (copied from Stripe Checkout on payment).
// Pure helpers: used by the store, the backend, emails and tests.

export const FULFILMENTS = ["collection", "delivery"] as const;
export type Fulfilment = (typeof FULFILMENTS)[number];

/** Shown on the basket (and returned by checkout) while the shop can't take card payments. */
export const PAYMENTS_OFF_MESSAGE = "Online payment isn't set up yet — visit the shop or call us.";

/** Countries Stripe Checkout accepts a delivery address for. */
export const DELIVERY_COUNTRIES = ["IE", "GB"] as const;

export type FulfilmentOptions = { collection: boolean; delivery: boolean; deliveryFeeCents: number };

export type ShippingAddress = {
  name: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  postalCode: string | null;
  state: string | null;
  country: string | null;
};

export function isFulfilment(v: unknown): v is Fulfilment {
  return typeof v === "string" && (FULFILMENTS as readonly string[]).includes(v);
}

export function fulfilmentLabel(v: string | null | undefined): string | null {
  if (v === "collection") return "Collection in the shop";
  if (v === "delivery") return "Delivery";
  return null;
}

/** The options a shop offers, in display order. */
export function offeredFulfilments(o: Pick<FulfilmentOptions, "collection" | "delivery">): Fulfilment[] {
  return FULFILMENTS.filter((f) => o[f]);
}

/** Delivery fee for a choice: only delivery costs anything. */
export function deliveryFeeFor(fulfilment: Fulfilment, o: Pick<FulfilmentOptions, "deliveryFeeCents">): number {
  return fulfilment === "delivery" ? Math.max(0, o.deliveryFeeCents) : 0;
}

const text = (v: unknown, max = 200) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/** Normalises a Stripe shipping_details object (or a stored jsonb value) into our shape. */
export function toShippingAddress(v: unknown): ShippingAddress | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const a = (o.address && typeof o.address === "object" ? o.address : o) as Record<string, unknown>;
  const out: ShippingAddress = {
    name: text(o.name, 120),
    line1: text(a.line1),
    line2: text(a.line2),
    city: text(a.city, 120),
    postalCode: text(a.postal_code ?? a.postalCode, 20),
    state: text(a.state, 120),
    country: text(a.country, 2),
  };
  return out.line1 || out.city || out.postalCode ? out : null;
}

/** Stored jsonb form (snake_case, Stripe-like). */
export function shippingAddressJson(a: ShippingAddress) {
  return { name: a.name, line1: a.line1, line2: a.line2, city: a.city, postal_code: a.postalCode, state: a.state, country: a.country };
}

/** Address lines for display, one per line. */
export function addressLines(a: ShippingAddress | null): string[] {
  if (!a) return [];
  const cityLine = [a.city, a.state, a.postalCode].filter(Boolean).join(", ");
  return [a.name, a.line1, a.line2, cityLine || null, a.country].filter((l): l is string => Boolean(l));
}
