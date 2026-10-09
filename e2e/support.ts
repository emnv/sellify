import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// Shared by global setup/teardown: a throwaway shop owner for the e2e run.
export function loadEnv() {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}

export const E2E_EMAIL = "e2e-runner@sellify.test";
export const E2E_PASSWORD = "E2e-runner-pass-1";

export function adminClient() {
  loadEnv();
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

export async function deleteE2eUser() {
  const admin = adminClient();
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const user = data.users.find((u) => u.email === E2E_EMAIL);
  if (!user) return;
  const { data: members } = await admin.from("shop_members").select("shop_id").eq("user_id", user.id);
  for (const m of members ?? []) await admin.from("shops").delete().eq("id", m.shop_id);
  await admin.auth.admin.deleteUser(user.id);
}
