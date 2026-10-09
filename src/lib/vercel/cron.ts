import { timingSafeEqual } from "node:crypto";

// SELLIFY STORES: auth for Vercel Cron routes. Vercel sends
// `Authorization: Bearer <CRON_SECRET>` when the CRON_SECRET env var is set.
// Pure, so it is unit-tested without a request.

/** True only when a secret is configured and the header is exactly `Bearer <secret>`. Constant-time compare. */
export function isAuthorizedCron(authorization: string | null | undefined, secret: string | null | undefined): boolean {
  if (!secret || !authorization) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(authorization);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

/** Cut-off for re-checking active domains: rows last checked before this are due again. */
export function staleBefore(now: Date, days: number): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}
