"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { stripeOnboardingUrl } from "@/core/payments";
import { onlineOrdersSchema, readOnlineOrdersForm, readShopProfileForm, shopProfileSchema, updateOnlineOrders, updateShopProfile } from "@/core/settings";
import { requireShop } from "@/core/shop";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";

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

export type OnlineOrdersState = {
  error?: string;
  saved?: boolean;
  fieldErrors?: Partial<Record<string, string>>;
  values?: ReturnType<typeof readOnlineOrdersForm>;
};

export async function saveOnlineOrders(_prev: OnlineOrdersState, formData: FormData): Promise<OnlineOrdersState> {
  const { shop } = await requireShop();
  const values = readOnlineOrdersForm(formData);
  const parsed = onlineOrdersSchema.safeParse(values);
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    return { error: errors.collection_enabled ?? "Check the highlighted fields.", fieldErrors: errors, values };
  }

  const ok = await updateOnlineOrders(shop.id, parsed.data);
  if (!ok) return { error: "Could not save the settings. Try again.", values };
  revalidatePath("/core/settings");
  return { saved: true, values };
}

export type ConnectStripeState = { error?: string };

/** Creates the shop's Stripe account if needed and sends the owner to Stripe's onboarding. */
export async function connectStripe(): Promise<ConnectStripeState> {
  const { shop, role } = await requireShop();
  if (role !== "owner") return { error: "Only the shop owner can set up online payments." };
  let url: string;
  try {
    url = await stripeOnboardingUrl(shop);
  } catch (e) {
    console.error("settings: could not start Stripe onboarding", { shopId: shop.id, error: (e as Error).message });
    return { error: "We could not reach Stripe. Try again in a moment." };
  }
  redirect(url);
}

export type ChangePasswordState = {
  error?: string;
  saved?: boolean;
  fieldErrors?: Partial<Record<string, string>>;
};

const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, "Enter your current password."),
    new_password: z.string().min(8, "Use at least 8 characters.").max(72, "Use 72 characters or fewer."),
    confirm_password: z.string(),
  })
  .refine((d) => d.new_password === d.confirm_password, { path: ["confirm_password"], message: "The passwords don't match." })
  .refine((d) => d.new_password !== d.current_password, { path: ["new_password"], message: "Choose a password you haven't used here." });

// Passwords are never sent back in state, so the fields clear after each try.
export async function changePassword(_prev: ChangePasswordState, formData: FormData): Promise<ChangePasswordState> {
  const { user } = await requireShop();
  const parsed = changePasswordSchema.safeParse({
    current_password: formData.get("current_password") ?? "",
    new_password: formData.get("new_password") ?? "",
    confirm_password: formData.get("confirm_password") ?? "",
  });
  if (!parsed.success) return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };

  // Check the current password on a cookie-less client so a wrong guess can't touch the session.
  const { error: verifyError } = await createPublicClient().auth.signInWithPassword({
    email: user.email,
    password: parsed.data.current_password,
  });
  if (verifyError) return { error: "Check the highlighted fields.", fieldErrors: { current_password: "Your current password is wrong." } };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.new_password });
  if (error) {
    if (error.code === "weak_password") return { error: "Check the highlighted fields.", fieldErrors: { new_password: "Choose a stronger password." } };
    if (error.code === "same_password") return { error: "Check the highlighted fields.", fieldErrors: { new_password: "Choose a password you haven't used here." } };
    console.error("settings: could not change the password", { userId: user.id, code: error.code });
    return { error: "Could not change the password. Try again in a moment." };
  }
  return { saved: true };
}
