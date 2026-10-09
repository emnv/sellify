import "server-only";
import { z } from "zod";
import type { Tone } from "@/components/ui";
import type { Catalog } from "@/core/catalog";
import { orderTickets, type TicketWhen } from "@/lib/booking/ticket-order";
import { parseMoneyToCents } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

// SELLIFY CORE (STAND-IN): repair prices (what a shop charges per model and
// repair, read by the online Repair tab) and repair tickets (bookings).

export type RepairPrice = Tables<"repair_prices">;
export type RepairTicket = Tables<"repair_tickets">;
export type RepairTicketNote = Tables<"repair_ticket_notes">;

export const REPAIR_STATUSES = [
  { value: "booked", label: "Booked", tone: "info" },
  { value: "in_progress", label: "In progress", tone: "warning" },
  { value: "ready", label: "Ready", tone: "brand" },
  { value: "collected", label: "Collected", tone: "success" },
  { value: "cancelled", label: "Cancelled", tone: "neutral" },
] as const satisfies ReadonlyArray<{ value: string; label: string; tone: Tone }>;
export type RepairStatus = (typeof REPAIR_STATUSES)[number]["value"];
const STATUS_VALUES = REPAIR_STATUSES.map((s) => s.value) as [RepairStatus, ...RepairStatus[]];

export const REPAIR_SOURCES = [
  { value: "walk_in", label: "Walk-in" },
  { value: "online", label: "Online" },
] as const;

export function repairStatus(value: string): { label: string; tone: Tone } {
  return REPAIR_STATUSES.find((s) => s.value === value) ?? { label: value, tone: "neutral" };
}
export function repairSourceLabel(value: string) {
  return REPAIR_SOURCES.find((s) => s.value === value)?.label ?? value;
}

/** 60 → "1 h", 45 → "45 min", 90 → "1 h 30 min" */
export function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Drop LIKE wildcards and PostgREST filter syntax characters from user input. */
function searchTerm(q: string | undefined) {
  return (q ?? "").slice(0, 80).replace(/[%_\\,()."*:]/g, " ").trim().split(/\s+/).join("%");
}

// ---------------------------------------------------------------------------
// Repair prices
// ---------------------------------------------------------------------------

/**
 * Prices for a shop, filtered by brand (id) and model name. Model names live
 * in the catalog, so the filter becomes a list of model ids.
 */
export async function listRepairPrices(shopId: string, catalog: Catalog, filter: { q?: string; brand?: string }) {
  const brands = filter.brand ? catalog.brands.filter((b) => String(b.id) === filter.brand) : catalog.brands;
  const term = searchTerm(filter.q).toLowerCase();
  const filtered = Boolean(filter.brand || term);
  const modelIds = brands.flatMap((b) => b.models.map((m) => m.id)).filter((id) => !term || catalog.modelLabels[id]?.toLowerCase().includes(term));
  if (filtered && modelIds.length === 0) return [];

  const supabase = await createClient();
  let query = supabase.from("repair_prices").select("*").eq("shop_id", shopId).limit(1000);
  if (filtered) query = query.in("model_id", modelIds);
  const { data, error } = await query;
  if (error) throw new Error(`Could not load repair prices: ${error.message}`);

  // Catalog order: brand, then model, then repair type.
  const modelOrder = new Map(catalog.brands.flatMap((b) => b.models).map((m, i) => [m.id, i]));
  const repairOrder = new Map(catalog.repairTypes.map((r, i) => [r.id, i]));
  return data.sort(
    (a, b) =>
      (modelOrder.get(a.model_id) ?? 0) - (modelOrder.get(b.model_id) ?? 0) ||
      (repairOrder.get(a.repair_type_id) ?? 0) - (repairOrder.get(b.repair_type_id) ?? 0),
  );
}

export async function countRepairPrices(shopId: string) {
  const supabase = await createClient();
  const { count, error } = await supabase.from("repair_prices").select("id", { count: "exact", head: true }).eq("shop_id", shopId);
  if (error) throw new Error(`Could not count repair prices: ${error.message}`);
  return count ?? 0;
}

/** "modelId:repairTypeId" for every part the shop has in stock. */
export async function partsInStock(shopId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("model_id, repair_type_id")
    .eq("shop_id", shopId)
    .eq("is_part", true)
    .gt("stock_qty", 0);
  if (error) throw new Error(`Could not load parts: ${error.message}`);
  return new Set(data.map((p) => `${p.model_id}:${p.repair_type_id}`));
}

const money = (message: string) =>
  z.string().transform((v, ctx) => {
    const cents = parseMoneyToCents(v);
    if (cents === null) {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    return cents;
  });

const catalogModelId = (catalog: Catalog) =>
  z.coerce
    .number("Choose a model.")
    .int("Choose a model.")
    .refine((id) => id in catalog.modelLabels, "Choose a model.");

const catalogRepairTypeId = (catalog: Catalog) =>
  z.coerce
    .number("Choose a repair.")
    .int("Choose a repair.")
    .refine((id) => catalog.repairTypes.some((r) => r.id === id), "Choose a repair.");

export function repairPriceSchema(catalog: Catalog) {
  return z
    .object({
      model_id: catalogModelId(catalog),
      repair_type_id: catalogRepairTypeId(catalog),
      price: money("Enter a price like 89 or 89.99."),
      duration: z.coerce
        .number("Enter the time in minutes, from 15 to 480.")
        .int("Enter the time in whole minutes.")
        .min(15, "Enter at least 15 minutes.")
        .max(480, "Enter at most 480 minutes (8 hours)."),
    })
    .transform((v) => ({
      model_id: v.model_id,
      repair_type_id: v.repair_type_id,
      price_cents: v.price,
      duration_min: v.duration,
    }));
}

export function readRepairPriceForm(formData: FormData) {
  return {
    model_id: String(formData.get("model_id") ?? ""),
    repair_type_id: String(formData.get("repair_type_id") ?? ""),
    price: String(formData.get("price") ?? ""),
    duration: String(formData.get("duration") ?? ""),
  };
}

// ---------------------------------------------------------------------------
// Repair tickets
// ---------------------------------------------------------------------------

export const TICKET_LIMIT = 200;

export const TICKET_WHEN = [
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
] as const satisfies ReadonlyArray<{ value: TicketWhen; label: string }>;

/**
 * Tickets in list order (see orderTickets): upcoming appointments first,
 * soonest first; then unscheduled and past tickets, newest first.
 * `when`: "upcoming" = appointment from now on, "past" = appointment before
 * now (unscheduled tickets only show under All).
 */
export async function listRepairTickets(shopId: string, filter: { q?: string; status?: string; source?: string; when?: string }) {
  const supabase = await createClient();
  const now = new Date();
  const nowIso = now.toISOString();
  const term = searchTerm(filter.q);

  const base = () => {
    let query = supabase.from("repair_tickets").select("*").eq("shop_id", shopId).limit(TICKET_LIMIT);
    if (filter.status && REPAIR_STATUSES.some((s) => s.value === filter.status)) query = query.eq("status", filter.status);
    if (filter.source && REPAIR_SOURCES.some((s) => s.value === filter.source)) query = query.eq("source", filter.source);
    if (term) query = query.or(`customer_name.ilike.%${term}%,device_label.ilike.%${term}%`);
    return query;
  };

  // Each query is capped and ordered so its first TICKET_LIMIT rows are the
  // ones that would come first in the merged list.
  const queries = [];
  if (filter.when !== "past") queries.push(base().gte("scheduled_at", nowIso).order("scheduled_at", { ascending: true }));
  if (filter.when !== "upcoming") queries.push(base().lt("scheduled_at", nowIso).order("scheduled_at", { ascending: false }));
  if (!filter.when || !TICKET_WHEN.some((w) => w.value === filter.when)) {
    queries.push(base().is("scheduled_at", null).order("created_at", { ascending: false }));
  }

  const results = await Promise.all(queries);
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(`Could not load repair tickets: ${failed.error.message}`);
  return orderTickets(
    results.flatMap((r) => r.data ?? []),
    now,
    TICKET_LIMIT,
  );
}

export async function countRepairTicketsByStatus(shopId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("repair_tickets").select("status").eq("shop_id", shopId);
  if (error) throw new Error(`Could not count repair tickets: ${error.message}`);
  const counts: Record<string, number> = { all: data.length };
  for (const row of data) counts[row.status] = (counts[row.status] ?? 0) + 1;
  return counts;
}

export async function getRepairTicket(shopId: string, id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("repair_tickets").select("*").eq("shop_id", shopId).eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not load the repair ticket: ${error.message}`);
  return data;
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .transform((v) => (v === "" ? null : v));

export function ticketSchema(catalog: Catalog) {
  return z.object({
    customer_name: z.string().trim().min(1, "Enter the customer's name.").max(120, "Keep the name under 120 characters."),
    customer_phone: optionalText(40),
    customer_email: optionalText(254).refine((v) => v === null || z.email().safeParse(v).success, "Enter an email like name@example.com."),
    model_id: catalogModelId(catalog),
    repair_type_id: catalogRepairTypeId(catalog),
    // Empty = use the shop's repair price (looked up in the action).
    quoted_price: z.string().transform((v, ctx) => {
      if (v.trim() === "") return null;
      const cents = parseMoneyToCents(v);
      if (cents === null) {
        ctx.addIssue({ code: "custom", message: "Enter a price like 89 or 89.99, or leave it empty." });
        return z.NEVER;
      }
      return cents;
    }),
    // Raw <input type="datetime-local"> value; converted with the shop's timezone in the action.
    scheduled_at: z
      .string()
      .trim()
      .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v), "Choose a date and time, or leave it empty."),
    notes: optionalText(2000),
  });
}

export function readTicketForm(formData: FormData) {
  return {
    customer_name: String(formData.get("customer_name") ?? ""),
    customer_phone: String(formData.get("customer_phone") ?? ""),
    customer_email: String(formData.get("customer_email") ?? ""),
    model_id: String(formData.get("model_id") ?? ""),
    repair_type_id: String(formData.get("repair_type_id") ?? ""),
    quoted_price: String(formData.get("quoted_price") ?? ""),
    scheduled_at: String(formData.get("scheduled_at") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
}

/** A status change plus an optional note, added to the ticket's notes history. */
export const ticketUpdateSchema = z.object({
  status: z.enum(STATUS_VALUES, "Choose a status."),
  note: optionalText(2000),
});

export function readTicketUpdateForm(formData: FormData) {
  return {
    status: String(formData.get("status") ?? ""),
    note: String(formData.get("note") ?? ""),
  };
}

/** Notes history of a ticket, oldest first. */
export async function listRepairTicketNotes(shopId: string, ticketId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("repair_ticket_notes")
    .select("id, body, created_at")
    .eq("shop_id", shopId)
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(500);
  if (error) throw new Error(`Could not load the ticket notes: ${error.message}`);
  return data;
}

// ---------------------------------------------------------------------------
// Booking capacity
// ---------------------------------------------------------------------------

export const SLOT_CAPACITY_MAX = 10;

export const slotCapacitySchema = z.object({
  capacity: z.coerce
    .number("Choose how many repairs you can take per time slot.")
    .int("Choose how many repairs you can take per time slot.")
    .min(1, "Choose at least 1 repair per time slot.")
    .max(SLOT_CAPACITY_MAX, `Choose at most ${SLOT_CAPACITY_MAX} repairs per time slot.`),
});
