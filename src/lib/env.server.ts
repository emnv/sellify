import "server-only";
import { z } from "zod";

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  APP_URL: z.url().default("http://localhost:3000"),
  STORES_ROOT_DOMAIN: z.string().default(""),
});

let cached: z.infer<typeof serverSchema> | undefined;

// Parsed on first use rather than at import, so a missing secret fails the
// request that needs it with a clear message instead of the whole build.
export function serverEnv() {
  cached ??= serverSchema.parse(process.env);
  return cached;
}
