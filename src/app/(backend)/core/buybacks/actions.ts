"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { buybackUpdateSchema, readBuybackUpdateForm } from "@/core/buybacks";
import { requireShop } from "@/core/shop";
import { createClient } from "@/lib/supabase/server";

export type BuybackUpdateState = {
  error?: string;
  fieldErrors?: Partial<Record<string, string>>;
  values?: ReturnType<typeof readBuybackUpdateForm>;
};

function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

export async function updateBuyback(_prev: BuybackUpdateState, formData: FormData): Promise<BuybackUpdateState> {
  const { shop } = await requireShop();
  const values = readBuybackUpdateForm(formData);
  const parsed = buybackUpdateSchema.safeParse(values);
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error), values };
  }

  const { id, status, notes } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("buybacks")
    .update({ status, notes })
    .eq("id", id)
    .eq("shop_id", shop.id)
    .select("id")
    .maybeSingle();
  if (error || !data) return { error: "Could not update the buyback. Try again.", values };

  revalidatePath("/core/buybacks");
  redirect(`/core/buybacks/${id}?updated=1`);
}
