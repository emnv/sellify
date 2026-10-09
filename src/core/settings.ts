import "server-only";
import { z } from "zod";
import { parseMoneyToCents } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

// SELLIFY CORE (STAND-IN): the shop profile. Currency and time zone are set
// by Sellify and are not editable here.

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((v) => (v === "" ? null : v));

const optionalEmail = z
  .string()
  .trim()
  .max(254, "Keep the email address under 254 characters.")
  .refine((v) => v === "" || z.email().safeParse(v).success, "Enter an email address like shop@example.com.")
  .transform((v) => (v === "" ? null : v.toLowerCase()));

// Lengths match the checks on public.shops.
export const shopProfileSchema = z.object({
  name: z.string().trim().min(1, "Enter your shop name.").max(80, "Keep the shop name under 80 characters."),
  email: optionalEmail,
  phone: optionalText(40, "Keep the phone number under 40 characters."),
  address: optionalText(300, "Keep the address under 300 characters."),
  notification_email: optionalEmail,
});

export type ShopProfile = z.output<typeof shopProfileSchema>;

export function readShopProfileForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    address: String(formData.get("address") ?? ""),
    notification_email: String(formData.get("notification_email") ?? ""),
  };
}

// Online orders: how customers get what they buy online. At least one option
// stays on (public.shops has the same check).
export const onlineOrdersSchema = z
  .object({
    collection_enabled: z.boolean(),
    delivery_enabled: z.boolean(),
    delivery_fee: z.string().trim().max(20, "Enter the delivery fee like 4.95."),
  })
  .transform((v, ctx) => {
    const cents = v.delivery_fee === "" ? 0 : parseMoneyToCents(v.delivery_fee);
    if (cents === null || cents > 100_000) {
      ctx.addIssue({ code: "custom", path: ["delivery_fee"], message: "Enter a delivery fee between 0 and 1,000.00, like 4.95." });
      return z.NEVER;
    }
    return { collection_enabled: v.collection_enabled, delivery_enabled: v.delivery_enabled, delivery_fee_cents: cents };
  })
  .refine((v) => v.collection_enabled || v.delivery_enabled, {
    path: ["collection_enabled"],
    message: "Keep collection or delivery on, so customers can get their order.",
  });

export type OnlineOrders = z.output<typeof onlineOrdersSchema>;

export function readOnlineOrdersForm(formData: FormData) {
  return {
    collection_enabled: formData.get("collection_enabled") === "on",
    delivery_enabled: formData.get("delivery_enabled") === "on",
    delivery_fee: String(formData.get("delivery_fee") ?? ""),
  };
}

/** Updates the online-order options of the caller's own shop (member column grant + RLS). */
export async function updateOnlineOrders(shopId: string, settings: OnlineOrders) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("shops").update(settings).eq("id", shopId).select("id").maybeSingle();
  return !error && Boolean(data);
}

/** Updates only the editable profile columns of the caller's own shop. */
export async function updateShopProfile(shopId: string, profile: ShopProfile) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("shops").update(profile).eq("id", shopId).select("id").maybeSingle();
  return !error && Boolean(data);
}
