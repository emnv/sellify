import "server-only";
import { z } from "zod";
import type { Tone } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

// SELLIFY CORE (STAND-IN): point-of-sale products, sales list and sale detail.

export const SALE_STATUSES = [
  { value: "paid", label: "Paid", tone: "success" },
  { value: "pending", label: "Pending", tone: "warning" },
  { value: "cancelled", label: "Cancelled", tone: "danger" },
  { value: "refunded", label: "Refunded", tone: "neutral" },
] as const satisfies ReadonlyArray<{ value: string; label: string; tone: Tone }>;
export type SaleStatus = (typeof SALE_STATUSES)[number]["value"];

export const SALE_CHANNELS = [
  { value: "pos", label: "In shop" },
  { value: "online", label: "Online" },
] as const;

export const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "stripe", label: "Online payment" },
] as const;

export function saleStatusLabel(value: string) {
  return SALE_STATUSES.find((s) => s.value === value)?.label ?? value;
}
export function saleStatusTone(value: string): Tone {
  return SALE_STATUSES.find((s) => s.value === value)?.tone ?? "neutral";
}
export function saleChannelLabel(value: string) {
  return SALE_CHANNELS.find((c) => c.value === value)?.label ?? value;
}
export function paymentMethodLabel(value: string | null) {
  if (!value) return null;
  return PAYMENT_METHODS.find((m) => m.value === value)?.label ?? value;
}

/** Products the POS can sell: in stock, with the fields the picker shows. */
export async function listSellableProducts(shopId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, price_cents, stock_qty, images, category")
    .eq("shop_id", shopId)
    .gt("stock_qty", 0)
    .order("name")
    .limit(500);
  if (error) throw new Error(`Could not load products: ${error.message}`);
  return data.map((p) => ({
    id: p.id,
    name: p.name,
    price_cents: p.price_cents,
    stock_qty: p.stock_qty,
    category: p.category,
    image: p.images[0] ?? null,
  }));
}
export type SellableProduct = Awaited<ReturnType<typeof listSellableProducts>>[number];

export const SALES_LIMIT = 200;

export async function listSales(shopId: string, filter: { q?: string; channel?: string; status?: string }) {
  const supabase = await createClient();
  let query = supabase
    .from("sales")
    .select("id, created_at, channel, status, total_cents, customer_name, sale_items(qty)")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false })
    .limit(SALES_LIMIT);

  if (filter.channel && SALE_CHANNELS.some((c) => c.value === filter.channel)) {
    query = query.eq("channel", filter.channel);
  }
  if (filter.status && SALE_STATUSES.some((s) => s.value === filter.status)) {
    query = query.eq("status", filter.status);
  }
  if (filter.q) {
    // Drop LIKE wildcards and PostgREST filter syntax characters from user input.
    const term = filter.q.slice(0, 80).replace(/[%_\\,()."*:]/g, " ").trim();
    if (term) query = query.ilike("customer_name", `%${term}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Could not load sales: ${error.message}`);
  return data.map(({ sale_items, ...sale }) => ({
    ...sale,
    item_count: sale_items.reduce((sum, item) => sum + item.qty, 0),
  }));
}

export async function getSale(shopId: string, id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales")
    .select("*, sale_items(id, product_id, name, unit_price_cents, qty)")
    .eq("shop_id", shopId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Could not load the sale: ${error.message}`);
  return data;
}
