"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type OnboardingState = { error?: string; name?: string; email?: string };

const schema = z.object({
  name: z.string().trim().min(1, "Enter your shop name.").max(80, "Keep the name under 80 characters."),
  email: z.union([z.literal(""), z.email("Enter a valid email address.").trim().toLowerCase()]),
});

export async function createShop(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  await requireUser();
  const raw = { name: String(formData.get("name") ?? ""), email: String(formData.get("email") ?? "") };
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message, ...raw };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_shop", {
    p_name: parsed.data.name,
    p_email: parsed.data.email || undefined,
  });
  // 23505: this user already has a shop (e.g. a double submit). Carry on.
  if (error && error.code !== "23505") return { error: "Could not create the shop. Try again.", ...raw };

  redirect("/");
}
