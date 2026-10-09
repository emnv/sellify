import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

// SELLIFY CORE (STAND-IN): which shop the signed-in user works in.

export type Shop = Tables<"shops">;
export type ShopContext = { user: CurrentUser; shop: Shop; role: "owner" | "staff" };

export const getCurrentShop = cache(async (): Promise<ShopContext | null> => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shop_members")
    .select("role, shops(*)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Could not load shop: ${error.message}`);
  if (!data?.shops) return null;
  return { user, shop: data.shops, role: data.role as ShopContext["role"] };
});

// Every backend page and action calls this first. Signed out → /login,
// no shop yet → /onboarding.
export async function requireShop(): Promise<ShopContext> {
  const ctx = await getCurrentShop();
  if (!ctx) redirect("/onboarding");
  return ctx;
}
