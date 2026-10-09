"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { productSchema, readProductForm } from "@/core/inventory";
import { requireShop } from "@/core/shop";
import { createClient } from "@/lib/supabase/server";

export type ProductFormState = {
  error?: string;
  fieldErrors?: Partial<Record<string, string>>;
  values?: ReturnType<typeof readProductForm>;
};

function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

export async function saveProduct(_prev: ProductFormState, formData: FormData): Promise<ProductFormState> {
  const { shop } = await requireShop();
  const values = readProductForm(formData);
  const parsed = productSchema(shop.id).safeParse(values);
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error), values };
  }

  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const result = id
    ? await supabase.from("products").update(parsed.data).eq("id", id).eq("shop_id", shop.id).select("id").maybeSingle()
    : await supabase.from("products").insert({ ...parsed.data, shop_id: shop.id }).select("id").single();

  if (result.error || !result.data) {
    return { error: "Could not save the product. Try again.", values };
  }

  revalidatePath("/core/inventory");
  redirect(`/core/inventory?saved=${result.data.id}`);
}

export async function deleteProduct(formData: FormData) {
  const { shop } = await requireShop();
  const id = String(formData.get("id") ?? "");
  if (!z.uuid().safeParse(id).success) return;

  const supabase = await createClient();
  const { data: product } = await supabase.from("products").select("images").eq("id", id).eq("shop_id", shop.id).maybeSingle();
  await supabase.from("products").delete().eq("id", id).eq("shop_id", shop.id);

  // Remove the photos too. Sale history keeps its own name/price snapshot.
  const prefix = `/shop-media/`;
  const paths = (product?.images ?? []).map((url) => url.slice(url.indexOf(prefix) + prefix.length)).filter((p) => p.startsWith(`${shop.id}/`));
  if (paths.length) await supabase.storage.from("shop-media").remove(paths);

  revalidatePath("/core/inventory");
  redirect("/core/inventory?deleted=1");
}
