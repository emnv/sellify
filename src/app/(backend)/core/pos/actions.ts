"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireShop } from "@/core/shop";
import { createClient } from "@/lib/supabase/server";

export type PosSaleState = { error?: string };

// Only product ids and quantities come from the browser. Prices are read by
// record_pos_sale from the database.
const saleSchema = z.object({
  items: z
    .array(z.object({ product_id: z.uuid(), qty: z.number().int().min(1).max(1000) }))
    .min(1, "Add at least one product to the basket.")
    .max(100, "A sale can have up to 100 lines."),
  payment_method: z.enum(["cash", "card"], "Choose cash or card."),
  customer_name: z.string().trim().max(120, "Keep the customer name under 120 characters."),
});

function readItems(raw: FormDataEntryValue | null): unknown {
  if (typeof raw !== "string" || raw.length > 20_000) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function recordSale(_prev: PosSaleState, formData: FormData): Promise<PosSaleState> {
  const { shop } = await requireShop();
  const parsed = saleSchema.safeParse({
    items: readItems(formData.get("items")),
    payment_method: formData.get("payment_method"),
    customer_name: String(formData.get("customer_name") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the basket and try again." };
  }

  const { items, payment_method, customer_name } = parsed.data;
  const supabase = await createClient();
  const { data: saleId, error } = await supabase.rpc("record_pos_sale", {
    p_shop_id: shop.id,
    p_items: items.map((i) => ({ product_id: i.product_id, qty: i.qty })),
    p_payment_method: payment_method,
    p_customer_name: customer_name || undefined,
  });

  if (error || !saleId) {
    const stock = /not enough stock for (.+)/i.exec(error?.message ?? "");
    if (stock) return { error: `Not enough stock for ${stock[1].trim()}. Refresh and try again.` };
    return { error: "Could not record the sale. Try again." };
  }

  revalidatePath("/core/pos");
  revalidatePath("/core/sales");
  revalidatePath("/core/inventory");
  redirect(`/core/sales/${saleId}?recorded=1`);
}
