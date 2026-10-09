// Dev helper: create (or delete) a confirmed test user, bypassing email
// confirmation. Usage: node scripts/dev-user.mjs create|delete <email> [password]
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const [cmd, email, password = "Dev-user-pass-1"] = process.argv.slice(2);
if (!["create", "delete"].includes(cmd) || !email) {
  console.error("Usage: node scripts/dev-user.mjs create|delete <email> [password]");
  process.exit(1);
}
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

if (cmd === "create") {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  console.log(error ? `error: ${error.message}` : `created ${data.user.id}`);
} else {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const user = data.users.find((u) => u.email === email);
  if (!user) process.exit(console.log("not found") ?? 0);
  const { data: members } = await admin.from("shop_members").select("shop_id").eq("user_id", user.id);
  for (const m of members ?? []) {
    const { data: files } = await admin.storage.from("shop-media").list(`${m.shop_id}/products`);
    if (files?.length) await admin.storage.from("shop-media").remove(files.map((f) => `${m.shop_id}/products/${f.name}`));
    await admin.from("shops").delete().eq("id", m.shop_id);
  }
  await admin.auth.admin.deleteUser(user.id);
  console.log(`deleted ${user.id} and ${members?.length ?? 0} shop(s)`);
}
