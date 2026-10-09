"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { buybackPriceSchema, deductionsSchema, readBuybackPriceForm, readDeductionsForm } from "@/core/buybacks";
import { getCatalog } from "@/core/catalog";
import { requireShop } from "@/core/shop";
import { createClient } from "@/lib/supabase/server";

const BASE = "/core/buyback-prices";

function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

export type DeductionsFormState = {
  error?: string;
  saved?: boolean;
  fieldErrors?: Partial<Record<string, string>>;
  values?: ReturnType<typeof readDeductionsForm>;
};

export async function saveDeductions(_prev: DeductionsFormState, formData: FormData): Promise<DeductionsFormState> {
  const { shop } = await requireShop();
  const values = readDeductionsForm(formData);
  const parsed = deductionsSchema.safeParse(values);
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error), values };
  }

  const supabase = await createClient();
  // The settings row is created with the shop; members may only update it.
  const { data, error } = await supabase.from("buyback_settings").update(parsed.data).eq("shop_id", shop.id).select("shop_id").maybeSingle();
  if (error || !data) return { error: "Could not save the deductions. Try again.", values };

  revalidatePath(BASE);
  return { saved: true, values };
}

export type BuybackPriceFormState = {
  error?: string;
  saved?: string;
  fieldErrors?: Partial<Record<string, string>>;
  values?: ReturnType<typeof readBuybackPriceForm>;
  /** Changes on every response so the form remounts with the right defaults. */
  nonce?: number;
};

export async function saveBuybackPrice(_prev: BuybackPriceFormState, formData: FormData): Promise<BuybackPriceFormState> {
  const [{ shop }, catalog] = await Promise.all([requireShop(), getCatalog()]);
  const values = readBuybackPriceForm(formData);
  const parsed = buybackPriceSchema(catalog).safeParse(values);
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error), values, nonce: Date.now() };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("buyback_prices")
    .upsert({ ...parsed.data, shop_id: shop.id }, { onConflict: "shop_id,model_id,storage_gb" });
  if (error) return { error: "Could not save the price. Try again.", values, nonce: Date.now() };

  revalidatePath(BASE);
  return { saved: catalog.modelLabels[parsed.data.model_id], nonce: Date.now() };
}

export async function removeBuybackPrice(formData: FormData) {
  const { shop } = await requireShop();
  const id = String(formData.get("id") ?? "");
  if (!z.uuid().safeParse(id).success) return;

  const supabase = await createClient();
  await supabase.from("buyback_prices").delete().eq("id", id).eq("shop_id", shop.id);
  revalidatePath(BASE);
}
