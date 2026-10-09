import "server-only";
import Stripe from "stripe";

// Server-only Stripe client. Created lazily so a missing key fails the request
// that needs it (checkout, webhook) instead of the build.
//
// Payments use Stripe Connect DIRECT CHARGES: each shop has its own connected
// account (shops.stripe_account_id) and every Checkout Session, retrieval and
// refund for an order is made on that account (the `stripeAccount` request
// option). The platform takes an optional application fee (PLATFORM_FEE_BPS).

let client: Stripe | null = null;

export function stripe(): Stripe {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Online payments are not configured (STRIPE_SECRET_KEY is missing).");
  client = new Stripe(key, { appInfo: { name: "Sellify Stores" }, maxNetworkRetries: 2 });
  return client;
}

/**
 * Signing secrets of every webhook endpoint pointing at /api/stripe/webhook:
 * the platform endpoint (STRIPE_WEBHOOK_SECRET) and the Connect endpoint that
 * delivers connected-account events (STRIPE_CONNECT_WEBHOOK_SECRET). An event
 * is accepted when it verifies against either.
 */
export function stripeWebhookSecrets(): string[] {
  const secrets = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_CONNECT_WEBHOOK_SECRET].filter((s): s is string => Boolean(s));
  if (secrets.length === 0) throw new Error("STRIPE_WEBHOOK_SECRET is missing.");
  return secrets;
}

/** Verifies a webhook payload against any configured endpoint secret. Throws when none matches. */
export function constructWebhookEvent(body: string, signature: string): Stripe.Event {
  let lastError: unknown;
  for (const secret of stripeWebhookSecrets()) {
    try {
      return stripe().webhooks.constructEvent(body, signature, secret);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Invalid signature");
}

/**
 * Platform fee for an order total, from PLATFORM_FEE_BPS (basis points,
 * default 0). Returns 0 when no fee applies; never the whole amount.
 */
export function platformFeeCents(totalCents: number): number {
  const raw = Number(process.env.PLATFORM_FEE_BPS ?? 0);
  const bps = Number.isFinite(raw) ? Math.min(Math.max(Math.trunc(raw), 0), 10_000) : 0;
  const fee = Math.round((totalCents * bps) / 10_000);
  return fee > 0 && fee < totalCents ? fee : 0;
}

export type { Stripe };
