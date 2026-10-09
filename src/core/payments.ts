import "server-only";
import type { Shop } from "@/core/shop";
import { serverEnv } from "@/lib/env.server";
import { stripe, type Stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

// Online payments: each shop's own Stripe account (Stripe Connect).
//
// Charge type: DIRECT CHARGES. The platform Stripe account is in Australia
// and shops are in Ireland/UK/EU. Destination charges and separate transfers
// only work across regions for platforms in the US, UK, EEA, CA or CH
// (https://docs.stripe.com/connect/cross-border-payouts), so an AU platform
// can't move EUR to an IE account that way. With direct charges the payment is
// created on the shop's account in its own currency and the platform only
// collects an optional application fee
// (https://docs.stripe.com/connect/direct-charges).
//
// Accounts are created with full Stripe Dashboard access, Stripe collecting
// requirements, the shop paying Stripe fees and Stripe owning negative-balance
// risk: the "Standard"-style set-up Stripe recommends for direct charges.
//
// stripe_* columns on shops are written only here, with the service role,
// after requireShop() has proved the caller is a member of that shop.

export type PaymentsStatus = "not_connected" | "incomplete" | "ready";

export function paymentsStatus(shop: Pick<Shop, "stripe_account_id" | "stripe_charges_enabled">): PaymentsStatus {
  if (!shop.stripe_account_id) return "not_connected";
  return shop.stripe_charges_enabled ? "ready" : "incomplete";
}

// Country the shop's Stripe account is opened in. Sellify sets time zone and
// currency; the time zone is the better hint (EUR alone doesn't say which country).
const COUNTRY_BY_TIMEZONE: Record<string, string> = {
  "Europe/Dublin": "IE",
  "Europe/London": "GB",
  "Europe/Belfast": "GB",
  "Europe/Oslo": "NO",
  "Europe/Stockholm": "SE",
  "Europe/Copenhagen": "DK",
  "Europe/Helsinki": "FI",
  "Europe/Berlin": "DE",
  "Europe/Paris": "FR",
  "Europe/Madrid": "ES",
  "Europe/Rome": "IT",
  "Europe/Amsterdam": "NL",
  "Europe/Brussels": "BE",
  "Europe/Lisbon": "PT",
  "Europe/Vienna": "AT",
};
const COUNTRY_BY_CURRENCY: Record<string, string> = { GBP: "GB", NOK: "NO", SEK: "SE", DKK: "DK", AUD: "AU", USD: "US", CAD: "CA", NZD: "NZ", CHF: "CH" };

export function stripeCountryFor(shop: Pick<Shop, "timezone" | "currency">): string | undefined {
  if (shop.timezone?.startsWith("Australia/")) return "AU";
  return COUNTRY_BY_TIMEZONE[shop.timezone] ?? COUNTRY_BY_CURRENCY[shop.currency?.toUpperCase()] ?? (shop.currency?.toUpperCase() === "EUR" ? "IE" : undefined);
}

async function saveAccountFlags(accountId: string, account: Pick<Stripe.Account, "charges_enabled" | "details_submitted">) {
  const { error } = await createAdminClient()
    .from("shops")
    .update({ stripe_charges_enabled: Boolean(account.charges_enabled), stripe_details_submitted: Boolean(account.details_submitted) })
    .eq("stripe_account_id", accountId);
  if (error) throw new Error(`Could not save the payment status: ${error.message}`);
}

/** Creates the shop's connected account if it has none. Returns the account id. */
async function ensureAccount(shop: Shop): Promise<string> {
  if (shop.stripe_account_id) return shop.stripe_account_id;
  const country = stripeCountryFor(shop);
  const account = await stripe().accounts.create(
    {
      ...(country ? { country } : {}),
      ...(shop.email ? { email: shop.email } : {}),
      business_profile: { name: shop.name.slice(0, 100) },
      controller: {
        stripe_dashboard: { type: "full" },
        fees: { payer: "account" },
        losses: { payments: "stripe" },
        requirement_collection: "stripe",
      },
      metadata: { sellify_shop_id: shop.id },
    },
    // Retrying within 24 h returns the same account instead of a second one.
    { idempotencyKey: `sellify-connect-${shop.id}` },
  );
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("shops")
    .update({ stripe_account_id: account.id })
    .eq("id", shop.id)
    .is("stripe_account_id", null)
    .select("stripe_account_id")
    .maybeSingle();
  if (error) throw new Error(`Could not save the Stripe account: ${error.message}`);
  if (data?.stripe_account_id) return data.stripe_account_id;
  // Someone else connected an account at the same moment: use theirs.
  const { data: current } = await admin.from("shops").select("stripe_account_id").eq("id", shop.id).single();
  if (!current?.stripe_account_id) throw new Error("Could not save the Stripe account.");
  return current.stripe_account_id;
}

/**
 * Onboarding link for the shop's Stripe account (creating the account first if
 * needed). Stripe sends the owner back to /core/settings?stripe=return, or
 * ?stripe=refresh when the link expired.
 */
export async function stripeOnboardingUrl(shop: Shop): Promise<string> {
  const accountId = await ensureAccount(shop);
  const base = `${serverEnv().APP_URL.replace(/\/$/, "")}/core/settings`;
  const link = await stripe().accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    return_url: `${base}?stripe=return`,
    refresh_url: `${base}?stripe=refresh`,
  });
  return link.url;
}

/** Re-reads the shop's account from Stripe and stores whether it can take payments. */
export async function refreshStripeAccount(shop: Pick<Shop, "stripe_account_id">): Promise<PaymentsStatus> {
  if (!shop.stripe_account_id) return "not_connected";
  const account = await stripe().accounts.retrieve(shop.stripe_account_id);
  await saveAccountFlags(account.id, account);
  return account.charges_enabled ? "ready" : "incomplete";
}

/** account.updated webhook: keeps the stored flags in sync. Unknown accounts change nothing. */
export async function syncConnectedAccount(account: Pick<Stripe.Account, "id" | "charges_enabled" | "details_submitted">): Promise<void> {
  if (!/^acct_[A-Za-z0-9]+$/.test(account.id)) return;
  await saveAccountFlags(account.id, account);
}
