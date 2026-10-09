"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { readShopProfileForm, shopProfileSchema, updateShopProfile } from "@/core/settings";
import { requireShop } from "@/core/shop";

export type ShopProfileState = {
  error?: string;
  saved?: boolean;
  fieldErrors?: Partial<Record<string, string>>;
  values?: ReturnType<typeof readShopProfileForm>;
};

function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

export async function saveShopProfile(_prev: ShopProfileState, formData: FormData): Promise<ShopProfileState> {
  const { shop } = await requireShop();
  const values = readShopProfileForm(formData);
  const parsed = shopProfileSchema.safeParse(values);
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error), values };
  }

  const ok = await updateShopProfile(shop.id, parsed.data);
  if (!ok) return { error: "Could not save the settings. Try again.", values };

  // The shop name shows in the sidebar of every backend page.
  revalidatePath("/", "layout");
  return { saved: true, values };
}
