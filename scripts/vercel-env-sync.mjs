// Copies runtime env vars from .env to the Vercel project (production and
// preview). Values go to the CLI on stdin and are never printed.
// Usage: node scripts/vercel-env-sync.mjs [--app-url https://…] [--only KEY,KEY]
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Plain config (non-secret) values; everything else is stored as Sensitive.
const CONFIG_KEYS = new Set(["NEXT_PUBLIC_SUPABASE_URL", "EMAIL_FROM", "OPENAI_MODEL", "VERCEL_PROJECT_ID", "VERCEL_TEAM_ID", "STORES_ROOT_DOMAIN", "APP_URL", "PLATFORM_FEE_BPS"]);

const RUNTIME_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "VERCEL_API_TOKEN",
  "VERCEL_PROJECT_ID",
  "VERCEL_TEAM_ID",
  "STORES_ROOT_DOMAIN",
  "APP_URL",
  "CRON_SECRET",
  "PLATFORM_FEE_BPS",
  "STRIPE_CONNECT_WEBHOOK_SECRET",
];

const args = process.argv.slice(2);
const appUrl = args.includes("--app-url") ? args[args.indexOf("--app-url") + 1] : null;
const only = args.includes("--only") ? args[args.indexOf("--only") + 1].split(",") : null;
const overrides = Object.fromEntries((args.includes("--set") ? args[args.indexOf("--set") + 1].split(",") : []).map((kv) => kv.split("=")));

const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
}
if (appUrl) env.APP_URL = appUrl;
// Production webhook signing secret differs from the local one (stripe listen).
if (process.env.WEBHOOK_SECRET_FILE) env.STRIPE_WEBHOOK_SECRET = readFileSync(process.env.WEBHOOK_SECRET_FILE, "utf8").trim();
Object.assign(env, overrides);

const token = process.env.VERCEL_TOKEN;
const scope = process.env.VERCEL_ORG_ID;
if (!token || !scope) throw new Error("VERCEL_TOKEN and VERCEL_ORG_ID must be set");

const vercel = (argv, input) =>
  spawnSync("npx", ["vercel", ...argv, "--token", token, "--scope", scope], { input, encoding: "utf8", shell: true });

for (const key of RUNTIME_KEYS) {
  if (only && !only.includes(key)) continue;
  // Production webhook secrets come from the Stripe endpoints, not from .env
  // (which holds the local `stripe listen` secret). Never overwrite them by accident.
  if (key === "STRIPE_WEBHOOK_SECRET" && !process.env.WEBHOOK_SECRET_FILE) {
    console.log(`${key}: skipped (set WEBHOOK_SECRET_FILE to update it)`);
    continue;
  }
  if (key === "STRIPE_CONNECT_WEBHOOK_SECRET" && !process.env.CONNECT_WEBHOOK_SECRET_FILE) {
    console.log(`${key}: skipped (set CONNECT_WEBHOOK_SECRET_FILE to update it)`);
    continue;
  }
  if (key === "STRIPE_CONNECT_WEBHOOK_SECRET") env[key] = readFileSync(process.env.CONNECT_WEBHOOK_SECRET_FILE, "utf8").trim();
  const value = env[key] ?? "";
  for (const target of ["production", "preview"]) {
    vercel(["env", "rm", key, target, "--yes"]); // replace if present
    if (value === "") {
      console.log(`${key} [${target}]: empty, skipped`);
      continue;
    }
    // NEXT_PUBLIC_* values ship to the browser by design, so they are Config, not Sensitive.
    const sensitive = !CONFIG_KEYS.has(key) && !key.startsWith("NEXT_PUBLIC_");
    const r = vercel(["env", "add", key, target, sensitive ? "--sensitive" : "--no-sensitive", "--yes", "--non-interactive"], value);
    console.log(`${key} [${target}]: ${r.status === 0 ? "set" : "FAILED " + (r.stderr || "").split("\n").filter(Boolean).slice(-1)[0]}`);
  }
}
