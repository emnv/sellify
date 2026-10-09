import "server-only";
import { z } from "zod";
import { publicEnv } from "@/lib/env";
import { parseMoneyToCents } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

// SELLIFY CORE (STAND-IN): inventory reads and the product form schema.

export type Product = Tables<"products">;

export const PRODUCT_CATEGORIES = [
  { value: "phone", label: "Phones", singular: "Phone" },
  { value: "accessory", label: "Accessories", singular: "Accessory" },
  { value: "part", label: "Parts", singular: "Part" },
  { value: "other", label: "Other", singular: "Other" },
] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number]["value"];

export { PRODUCT_CONDITIONS, conditionLabel } from "./inventory-labels";

export const LOW_STOCK = 2;

export function categoryLabel(value: string) {
  return PRODUCT_CATEGORIES.find((c) => c.value === value)?.singular ?? value;
}

export async function listProducts(shopId: string, filter: { q?: string; category?: string; online?: string }) {
  const supabase = await createClient();
  let query = supabase
    .from("products")
    .select("*")
    .eq("shop_id", shopId)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (filter.category && PRODUCT_CATEGORIES.some((c) => c.value === filter.category)) {
    query = query.eq("category", filter.category);
  }
  if (filter.online === "visible") query = query.eq("visible_online", true);
  if (filter.online === "hidden") query = query.eq("visible_online", false);
  if (filter.q) {
    // Drop LIKE wildcards and PostgREST filter syntax characters from user input.
    const term = filter.q.slice(0, 80).replace(/[%_\\,()."*:]/g, " ").trim().split(/\s+/).join("%");
    if (term) query = query.or(`name.ilike.%${term}%,sku.ilike.%${term}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Could not load products: ${error.message}`);
  return data;
}

export async function countProductsByCategory(shopId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("products").select("category").eq("shop_id", shopId);
  if (error) throw new Error(`Could not count products: ${error.message}`);
  const counts: Record<string, number> = { all: data.length };
  for (const row of data) counts[row.category] = (counts[row.category] ?? 0) + 1;
  return counts;
}

export async function getProduct(shopId: string, id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("products").select("*").eq("shop_id", shopId).eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not load the product: ${error.message}`);
  return data;
}

/** Public URL prefix for a shop's uploaded media. Images outside it are rejected. */
export function shopMediaPrefix(shopId: string) {
  return `${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/shop-media/${shopId}/`;
}

const money = z.string().transform((v, ctx) => {
  const cents = parseMoneyToCents(v);
  if (cents === null) {
    ctx.addIssue({ code: "custom", message: "Enter a price like 129 or 129.99." });
    return z.NEVER;
  }
  return cents;
});

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .transform((v) => (v === "" ? null : v));

const optionalId = z
  .string()
  .transform((v) => (v === "" ? null : Number(v)))
  .refine((v) => v === null || (Number.isInteger(v) && v > 0), "Choose an option.");

export function productSchema(shopId: string) {
  const prefix = shopMediaPrefix(shopId);
  return z
    .object({
      name: z.string().trim().min(1, "Enter a product name.").max(120, "Keep the name under 120 characters."),
      description: optionalText(4000),
      category: z.enum(["phone", "accessory", "part", "other"], "Choose a category."),
      condition: z
        .enum(["", "new", "refurbished", "used"])
        .transform((v) => (v === "" ? null : v)),
      sku: optionalText(60),
      price: money,
      stock: z.coerce.number("Enter a whole number.").int("Enter a whole number.").min(0, "Stock can't be negative.").max(100000),
      visible_online: z.boolean(),
      images: z.array(z.string().refine((u) => u.startsWith(prefix), "Invalid image.")).max(8, "Up to 8 photos."),
      model_id: optionalId,
      repair_type_id: optionalId,
    })
    .superRefine((v, ctx) => {
      if (v.category !== "part") return;
      if (v.model_id === null) ctx.addIssue({ code: "custom", path: ["model_id"], message: "Choose the phone model this part fits." });
      if (v.repair_type_id === null) ctx.addIssue({ code: "custom", path: ["repair_type_id"], message: "Choose the repair this part is used for." });
    })
    .transform((v) => ({
      name: v.name,
      description: v.description,
      category: v.category,
      condition: v.condition,
      sku: v.sku,
      price_cents: v.price,
      stock_qty: v.stock,
      visible_online: v.visible_online,
      images: v.images,
      is_part: v.category === "part",
      model_id: v.category === "part" ? v.model_id : null,
      repair_type_id: v.category === "part" ? v.repair_type_id : null,
    }));
}

export function readProductForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    category: String(formData.get("category") ?? ""),
    condition: String(formData.get("condition") ?? ""),
    sku: String(formData.get("sku") ?? ""),
    price: String(formData.get("price") ?? ""),
    stock: String(formData.get("stock") ?? ""),
    visible_online: formData.get("visible_online") === "on",
    images: formData.getAll("images").map(String).filter(Boolean),
    model_id: String(formData.get("model_id") ?? ""),
    repair_type_id: String(formData.get("repair_type_id") ?? ""),
  };
}
