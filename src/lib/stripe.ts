import "server-only";
import Stripe from "stripe";

// Server-only Stripe client. Created lazily so a missing key fails the request
// that needs it (checkout, webhook) instead of the build.

let client: Stripe | null = null;

export function stripe(): Stripe {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Online payments are not configured (STRIPE_SECRET_KEY is missing).");
  client = new Stripe(key, { appInfo: { name: "Sellify Stores" }, maxNetworkRetries: 2 });
  return client;
}

export function stripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is missing.");
  return secret;
}

export type { Stripe };
