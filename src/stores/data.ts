import "server-only";
import { headers } from "next/headers";
import { cache } from "react";
import {
  getBuybackOptions,
  getPublicProduct,
  getPublicStore,
  getRepairOptions,
  listPublicProducts,
  type BuybackDeductions,
  type BuybackOption,
  type PublicProduct,
  type RepairOption,
} from "@/core/api";
import { getCatalog } from "@/core/catalog";
import { requireShop } from "@/core/shop";
import { createClient } from "@/lib/supabase/server";
import type { StoreCtx } from "@/components/store/context";
import { getOwnerStore } from "./store";
import { storeBasePath } from "./urls";

// Data for rendering a store. Public pages read through the published-only
// API in @/core/api. The editor preview renders the owner's DRAFT, before
// publishing, so it reads the owner's own data with their session (RLS).

/** Context for the public store at /s/<key> (or its own host). */
export const loadPublicCtx = cache(async (key: string): Promise<StoreCtx | null> => {
  const decoded = decodeURIComponent(key).toLowerCase();
  const store = await getPublicStore(decoded);
  if (!store) return null;
  const mode = (await headers()).get("x-store-mode") === "host" ? "host" : "path";
  return {
    config: store.config,
    base: storeBasePath(mode, store.slug),
    storeKey: decoded,
    currency: store.currency,
    timezone: store.timezone,
    preview: false,
  };
});

/** Context for the editor preview of the signed-in owner's draft. */
export const loadPreviewCtx = cache(async (): Promise<StoreCtx | null> => {
  const { shop } = await requireShop();
  const store = await getOwnerStore();
  if (!store) return null;
  return {
    config: store.draft,
    base: storeBasePath("preview", store.row.slug),
    storeKey: store.row.slug,
    currency: shop.currency,
    timezone: shop.timezone,
    preview: true,
  };
});

async function ownerProducts(id?: string): Promise<PublicProduct[]> {
  const { shop } = await requireShop();
  const supabase = await createClient();
  let q = supabase
    .from("products")
    .select("id, name, description, category, condition, price_cents, stock_qty, images")
    .eq("shop_id", shop.id)
    .eq("visible_online", true)
    .eq("is_part", false)
    .order("stock_qty", { ascending: false })
    .limit(500);
  if (id) q = q.eq("id", id);
  const { data, error } = await q;
  if (error) throw new Error(`Could not load products: ${error.message}`);
  return data;
}

export async function storeProducts(ctx: StoreCtx): Promise<PublicProduct[]> {
  return ctx.preview ? ownerProducts() : listPublicProducts(ctx.storeKey);
}

export async function storeProduct(ctx: StoreCtx, id: string): Promise<PublicProduct | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return ctx.preview ? ((await ownerProducts(id))[0] ?? null) : getPublicProduct(ctx.storeKey, id);
}

export async function storeRepairOptions(ctx: StoreCtx): Promise<RepairOption[]> {
  if (!ctx.preview) return getRepairOptions(ctx.storeKey);
  const { shop } = await requireShop();
  const supabase = await createClient();
  const [{ data: prices }, { data: parts }, catalog] = await Promise.all([
    supabase.from("repair_prices").select("model_id, repair_type_id, price_cents, duration_min").eq("shop_id", shop.id),
    supabase.from("products").select("model_id, repair_type_id").eq("shop_id", shop.id).eq("is_part", true).gt("stock_qty", 0),
    getCatalog(),
  ]);
  const out: RepairOption[] = [];
  for (const b of catalog.brands)
    for (const m of b.models)
      for (const rt of catalog.repairTypes) {
        const p = prices?.find((x) => x.model_id === m.id && x.repair_type_id === rt.id);
        if (!p) continue;
        out.push({
          brand_id: b.id,
          brand: b.name,
          model_id: m.id,
          model: m.name,
          repair_type_id: rt.id,
          repair: rt.name,
          price_cents: p.price_cents,
          duration_min: p.duration_min,
          part_in_stock: Boolean(parts?.some((x) => x.model_id === m.id && x.repair_type_id === rt.id)),
        });
      }
  return out;
}

export async function storeBuybackOptions(ctx: StoreCtx): Promise<{ prices: BuybackOption[]; deductions: BuybackDeductions }> {
  if (!ctx.preview) return (await getBuybackOptions(ctx.storeKey)) ?? { prices: [], deductions: { screen_cracked_pct: 0, battery_bad_pct: 0, no_power_pct: 0 } };
  const { shop } = await requireShop();
  const supabase = await createClient();
  const [{ data: prices }, { data: settings }, catalog] = await Promise.all([
    supabase.from("buyback_prices").select("model_id, storage_gb, base_price_cents").eq("shop_id", shop.id),
    supabase.from("buyback_settings").select("screen_cracked_pct, battery_bad_pct, no_power_pct").eq("shop_id", shop.id).maybeSingle(),
    getCatalog(),
  ]);
  const out: BuybackOption[] = [];
  for (const b of catalog.brands)
    for (const m of b.models)
      for (const p of (prices ?? []).filter((x) => x.model_id === m.id).sort((a, z) => a.storage_gb - z.storage_gb))
        out.push({ brand_id: b.id, brand: b.name, model_id: m.id, model: m.name, storage_gb: p.storage_gb, base_price_cents: p.base_price_cents });
  return { prices: out, deductions: settings ?? { screen_cracked_pct: 0, battery_bad_pct: 0, no_power_pct: 0 } };
}
