"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCatalog } from "@/core/catalog";
import { readRepairPriceForm, repairPriceSchema } from "@/core/repairs";
import { requireShop } from "@/core/shop";
import { createClient } from "@/lib/supabase/server";

export type RepairPriceFormState = {
  error?: string;
  /** Success message after a save. */
  saved?: string;
  fieldErrors?: Partial<Record<string, string>>;
  values?: ReturnType<typeof readRepairPriceForm>;
};

function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

export async function saveRepairPrice(_prev: RepairPriceFormState, formData: FormData): Promise<RepairPriceFormState> {
  const { shop } = await requireShop();
  const catalog = await getCatalog();
  const values = readRepairPriceForm(formData);
  const parsed = repairPriceSchema(catalog).safeParse(values);
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error), values };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("repair_prices")
    .upsert({ ...parsed.data, shop_id: shop.id }, { onConflict: "shop_id,model_id,repair_type_id" });
  if (error) return { error: "Could not save the price. Try again.", values };

  revalidatePath("/core/repair-prices");
  const repair = catalog.repairTypes.find((r) => r.id === parsed.data.repair_type_id)?.name ?? "repair";
  // Keep the model selected so the next repair for the same phone is quick to add.
  return {
    saved: `Price saved for ${catalog.modelLabels[parsed.data.model_id]} · ${repair}.`,
    values: { model_id: values.model_id, repair_type_id: "", price: "", duration: "60" },
  };
}

export async function removeRepairPrice(formData: FormData) {
  const { shop } = await requireShop();
  const id = String(formData.get("id") ?? "");
  if (!z.uuid().safeParse(id).success) return;

  const supabase = await createClient();
  await supabase.from("repair_prices").delete().eq("id", id).eq("shop_id", shop.id);
  revalidatePath("/core/repair-prices");
}
