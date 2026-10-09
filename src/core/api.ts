import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { parseStoreConfig, type StoreConfig } from "@/lib/store/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/public";

// =============================================================================
// THE SEAM between Sellify Stores and Sellify Core.
// Store code (public store pages, checkout, bookings) reaches Core data ONLY
// through this file. To run on the real Sellify, reimplement these functions.
//
// Reads go through the anonymous public_* database functions: they resolve a
// published store by slug or verified domain and return only its public data.
// Writes run on the server with the service role, always scoped to the shop
// that owns the resolved published store, and never trust client prices.
// =============================================================================

export type PublicStore = {
  storeId: string;
  slug: string;
  config: StoreConfig;
  currency: string;
  timezone: string;
};

/** A published store by slug or custom domain, or null. Live (not cached). */
export const getPublicStore = cache(async (key: string): Promise<PublicStore | null> => {
  await connection();
  const { data, error } = await createPublicClient().rpc("public_store", { p_key: key });
  if (error) throw new Error(`Could not load the store: ${error.message}`);
  if (!data) return null;
  const row = data as { store_id: string; slug: string; config: unknown; currency: string; timezone: string };
  return {
    storeId: row.store_id,
    slug: row.slug,
    config: parseStoreConfig(row.config),
    currency: row.currency,
    timezone: row.timezone,
  };
});

export type PublicProduct = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  condition: string | null;
  price_cents: number;
  stock_qty: number;
  images: string[];
};

export async function listPublicProducts(key: string): Promise<PublicProduct[]> {
  await connection();
  const { data, error } = await createPublicClient().rpc("public_products", { p_key: key });
  if (error) throw new Error(`Could not load products: ${error.message}`);
  return (data ?? []) as PublicProduct[];
}

export async function getPublicProduct(key: string, id: string): Promise<PublicProduct | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  await connection();
  const { data, error } = await createPublicClient().rpc("public_products", { p_key: key, p_product_id: id });
  if (error) throw new Error(`Could not load the product: ${error.message}`);
  return ((data ?? []) as PublicProduct[])[0] ?? null;
}

export type RepairOption = {
  brand_id: number;
  brand: string;
  model_id: number;
  model: string;
  repair_type_id: number;
  repair: string;
  price_cents: number;
  duration_min: number;
  part_in_stock: boolean;
};

export async function getRepairOptions(key: string): Promise<RepairOption[]> {
  await connection();
  const { data, error } = await createPublicClient().rpc("public_repair_options", { p_key: key });
  if (error) throw new Error(`Could not load repair prices: ${error.message}`);
  return (data ?? []) as RepairOption[];
}

export async function getBookedSlots(key: string, from: Date, to: Date): Promise<string[]> {
  await connection();
  const { data, error } = await createPublicClient().rpc("public_booked_slots", {
    p_key: key,
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });
  if (error) throw new Error(`Could not load bookings: ${error.message}`);
  return ((data ?? []) as string[]).map((s) => new Date(s).toISOString());
}

export type BuybackOption = { brand_id: number; brand: string; model_id: number; model: string; storage_gb: number; base_price_cents: number };
export type BuybackDeductions = { screen_cracked_pct: number; battery_bad_pct: number; no_power_pct: number };

export async function getBuybackOptions(key: string): Promise<{ prices: BuybackOption[]; deductions: BuybackDeductions } | null> {
  await connection();
  const { data, error } = await createPublicClient().rpc("public_buyback_options", { p_key: key });
  if (error) throw new Error(`Could not load buyback prices: ${error.message}`);
  if (!data) return null;
  const d = data as { prices: BuybackOption[]; deductions: BuybackDeductions | null };
  return { prices: d.prices, deductions: d.deductions ?? { screen_cracked_pct: 0, battery_bad_pct: 0, no_power_pct: 0 } };
}

// ---------------------------------------------------------------------------
// Server-side writes. These resolve the published store again (never trust a
// shop id from the client) and use the service role.
// ---------------------------------------------------------------------------

export type ShopForStore = {
  shopId: string;
  shopName: string;
  notifyEmail: string | null;
  currency: string;
  timezone: string;
};

/** The shop behind a published store, for server-side writes and emails. */
export async function getShopForPublishedStore(key: string): Promise<ShopForStore | null> {
  const store = await getPublicStore(key);
  if (!store) return null;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("stores")
    .select("shop_id, is_published, shops(name, email, notification_email, currency, timezone)")
    .eq("id", store.storeId)
    .single();
  if (error || !data?.is_published || !data.shops) return null;
  return {
    shopId: data.shop_id,
    shopName: data.shops.name,
    notifyEmail: data.shops.notification_email ?? data.shops.email,
    currency: data.shops.currency,
    timezone: data.shops.timezone,
  };
}
