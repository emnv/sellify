import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";

/**
 * A stable, non-reversible id for the visitor's network address, for abuse
 * limits only. Keyed HMAC (server-only secret) truncated to 128 bits, so the
 * raw IP is never stored. On Vercel, x-vercel-forwarded-for / x-forwarded-for
 * are set by the platform edge.
 */
export async function clientHash(): Promise<string | null> {
  const h = await headers();
  const ip = (h.get("x-vercel-forwarded-for") ?? h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "").split(",")[0].trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!ip || !key) return null;
  return createHmac("sha256", key).update(`client:${ip}`).digest("hex").slice(0, 32);
}
