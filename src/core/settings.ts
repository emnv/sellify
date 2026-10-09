import "server-only";
import { z } from "zod";
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

/** Updates only the editable profile columns of the caller's own shop. */
export async function updateShopProfile(shopId: string, profile: ShopProfile) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("shops").update(profile).eq("id", shopId).select("id").maybeSingle();
  return !error && Boolean(data);
}
