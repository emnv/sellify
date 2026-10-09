import "server-only";
import { z } from "zod";
import type { Tone } from "@/components/ui";
import type { Catalog } from "@/core/catalog";
import type { BuybackAnswers } from "@/lib/buyback/quote";
import { parseMoneyToCents } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import type { Json, Tables } from "@/lib/supabase/database.types";

// SELLIFY CORE (STAND-IN): buyback prices, condition deductions and the
// buybacks customers agree to (walk-in or from the online Sell tab).

export type Buyback = Tables<"buybacks">;
export type BuybackPrice = Tables<"buyback_prices">;
export type BuybackSettings = Tables<"buyback_settings">;

export const BUYBACK_STATUSES = [
  { value: "accepted", label: "Accepted", tone: "info" },
  { value: "received", label: "Received", tone: "warning" },
  { value: "paid", label: "Paid", tone: "success" },
  { value: "rejected", label: "Rejected", tone: "danger" },
  { value: "cancelled", label: "Cancelled", tone: "neutral" },
] as const satisfies ReadonlyArray<{ value: string; label: string; tone: Tone }>;
export type BuybackStatus = (typeof BUYBACK_STATUSES)[number]["value"];
const STATUS_VALUES = BUYBACK_STATUSES.map((s) => s.value) as [BuybackStatus, ...BuybackStatus[]];

export const BUYBACK_SOURCES = [
  { value: "walk_in", label: "Walk-in" },
  { value: "online", label: "Online" },
] as const;

export function buybackStatus(value: string): { label: string; tone: Tone } {
  return BUYBACK_STATUSES.find((s) => s.value === value) ?? { label: value, tone: "neutral" };
}
export function buybackSourceLabel(value: string) {
  return BUYBACK_SOURCES.find((s) => s.value === value)?.label ?? value;
}
export function handoverLabel(value: string) {
  return value === "drop_in" ? "Drop in to the shop" : value;
}

// ---------------------------------------------------------------------------
// Condition answers and offers
// ---------------------------------------------------------------------------

// The offer formula lives in @/lib/buyback/quote (pure, unit-tested, shared
// with the store's Sell tab). Re-exported here for existing imports.
export { computeOffer, type BuybackAnswers } from "@/lib/buyback/quote";

export function readAnswers(answers: Json): BuybackAnswers {
  const obj = answers && typeof answers === "object" && !Array.isArray(answers) ? answers : {};
  const bool = (v: Json | undefined) => (typeof v === "boolean" ? v : null);
  return { screenCracked: bool(obj.screen_cracked), batteryOk: bool(obj.battery_ok), turnsOn: bool(obj.turns_on) };
}

/** "Screen cracked · Battery OK · Turns on", or "No problems". */
export function conditionSummary(answers: Json): string {
  const a = readAnswers(answers);
  if (a.screenCracked === false && a.batteryOk === true && a.turnsOn === true) return "No problems";
  const parts: string[] = [];
  if (a.screenCracked !== null) parts.push(a.screenCracked ? "Screen cracked" : "Screen OK");
  if (a.batteryOk !== null) parts.push(a.batteryOk ? "Battery OK" : "Battery not OK");
  if (a.turnsOn !== null) parts.push(a.turnsOn ? "Turns on" : "Doesn't turn on");
  return parts.length ? parts.join(" · ") : "Not answered";
}

type Deductions = Pick<BuybackSettings, "screen_cracked_pct" | "battery_bad_pct" | "no_power_pct">;

// ---------------------------------------------------------------------------
// Settings (condition deductions)
// ---------------------------------------------------------------------------

const DEFAULT_DEDUCTIONS: Deductions = { screen_cracked_pct: 30, battery_bad_pct: 15, no_power_pct: 50 };

export async function getBuybackSettings(shopId: string): Promise<Deductions> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("buyback_settings")
    .select("screen_cracked_pct, battery_bad_pct, no_power_pct")
    .eq("shop_id", shopId)
    .maybeSingle();
  if (error) throw new Error(`Could not load buyback settings: ${error.message}`);
  // The row is created with the shop; fall back to the column defaults just in case.
  return data ?? DEFAULT_DEDUCTIONS;
}

const percent = z.coerce
  .number("Enter a whole number from 0 to 100.")
  .int("Enter a whole number from 0 to 100.")
  .min(0, "Enter a whole number from 0 to 100.")
  .max(100, "Enter a whole number from 0 to 100.");

export const deductionsSchema = z
  .object({ screen_cracked_pct: percent, battery_bad_pct: percent, no_power_pct: percent });

export function readDeductionsForm(formData: FormData) {
  return {
    screen_cracked_pct: String(formData.get("screen_cracked_pct") ?? ""),
    battery_bad_pct: String(formData.get("battery_bad_pct") ?? ""),
    no_power_pct: String(formData.get("no_power_pct") ?? ""),
  };
}

// ---------------------------------------------------------------------------
// Buyback prices
// ---------------------------------------------------------------------------

export function brandSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export type BuybackPriceRow = BuybackPrice & { modelLabel: string; brandName: string };

/**
 * All prices for the shop, in catalog order, with model and brand names.
 * A shop has at most a few hundred, so search and brand filters run in
 * memory (`filterBuybackPrices`) on top of this one query.
 */
export async function listBuybackPrices(shopId: string, catalog: Catalog): Promise<BuybackPriceRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("buyback_prices").select("*").eq("shop_id", shopId).limit(2000);
  if (error) throw new Error(`Could not load buyback prices: ${error.message}`);

  const order = new Map<number, { index: number; brandName: string }>();
  let i = 0;
  for (const b of catalog.brands) for (const m of b.models) order.set(m.id, { index: i++, brandName: b.name });

  return data
    .map((p): BuybackPriceRow => ({
      ...p,
      modelLabel: catalog.modelLabels[p.model_id] ?? "Unknown model",
      brandName: order.get(p.model_id)?.brandName ?? "",
    }))
    .sort((a, b) => (order.get(a.model_id)?.index ?? 1e9) - (order.get(b.model_id)?.index ?? 1e9) || a.storage_gb - b.storage_gb);
}

/** Model search and brand filter (`brand` is a `brandSlug`). */
export function filterBuybackPrices(rows: BuybackPriceRow[], filter: { q?: string; brand?: string }) {
  const term = filter.q?.trim().toLowerCase().slice(0, 80);
  return rows
    .filter((p) => (filter.brand ? brandSlug(p.brandName) === filter.brand : true))
    .filter((p) => (term ? p.modelLabel.toLowerCase().includes(term) : true));
}

const requiredId = (message: string) =>
  z
    .string()
    .transform((v) => Number(v))
    .refine((v) => Number.isInteger(v) && v > 0, message);

/** Validates against the catalog: storage must be one the model is sold with. */
export function buybackPriceSchema(catalog: Catalog) {
  const models = new Map(catalog.brands.flatMap((b) => b.models.map((m) => [m.id, m] as const)));
  return z
    .object({
      model_id: requiredId("Choose a model."),
      storage_gb: requiredId("Choose a storage size."),
      base_price: z.string().transform((v, ctx) => {
        const cents = parseMoneyToCents(v);
        if (cents === null) {
          ctx.addIssue({ code: "custom", message: "Enter a price like 250 or 249.99." });
          return z.NEVER;
        }
        return cents;
      }),
    })
    .superRefine((v, ctx) => {
      const model = models.get(v.model_id);
      if (!model) {
        ctx.addIssue({ code: "custom", path: ["model_id"], message: "Choose a model from the list." });
        return;
      }
      if (!model.storageOptions.includes(v.storage_gb)) {
        ctx.addIssue({ code: "custom", path: ["storage_gb"], message: "Choose a storage size this model comes in." });
      }
    })
    .transform((v) => ({ model_id: v.model_id, storage_gb: v.storage_gb, base_price_cents: v.base_price }));
}

export function readBuybackPriceForm(formData: FormData) {
  return {
    model_id: String(formData.get("model_id") ?? ""),
    storage_gb: String(formData.get("storage_gb") ?? ""),
    base_price: String(formData.get("base_price") ?? ""),
  };
}

// ---------------------------------------------------------------------------
// Buybacks
// ---------------------------------------------------------------------------

export const BUYBACK_LIST_LIMIT = 200;

export async function listBuybacks(shopId: string, filter: { q?: string; status?: string; source?: string }) {
  const supabase = await createClient();
  let query = supabase
    .from("buybacks")
    .select("id, created_at, customer_name, customer_phone, device_label, storage_gb, answers, offer_cents, source, status")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false })
    .limit(BUYBACK_LIST_LIMIT);

  if (filter.status && STATUS_VALUES.includes(filter.status as BuybackStatus)) query = query.eq("status", filter.status);
  if (filter.source && BUYBACK_SOURCES.some((s) => s.value === filter.source)) query = query.eq("source", filter.source);
  if (filter.q) {
    // Drop LIKE wildcards and PostgREST filter syntax characters from user input.
    const term = filter.q.slice(0, 80).replace(/[%_\\,()."*:]/g, " ").trim();
    if (term) query = query.or(`customer_name.ilike.%${term}%,customer_phone.ilike.%${term}%,device_label.ilike.%${term}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Could not load buybacks: ${error.message}`);
  return data;
}

export async function countBuybacksByStatus(shopId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("buybacks").select("status").eq("shop_id", shopId);
  if (error) throw new Error(`Could not count buybacks: ${error.message}`);
  const counts: Record<string, number> = { all: data.length };
  for (const row of data) counts[row.status] = (counts[row.status] ?? 0) + 1;
  return counts;
}

export async function getBuyback(shopId: string, id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("buybacks").select("*").eq("shop_id", shopId).eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not load the buyback: ${error.message}`);
  return data;
}

export const buybackUpdateSchema = z.object({
  id: z.uuid("This buyback no longer exists."),
  status: z.enum(STATUS_VALUES, "Choose a status."),
  notes: z
    .string()
    .trim()
    .max(2000, "Keep notes under 2000 characters.")
    .transform((v) => (v === "" ? null : v)),
});

export function readBuybackUpdateForm(formData: FormData) {
  return {
    id: String(formData.get("id") ?? ""),
    status: String(formData.get("status") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
}
