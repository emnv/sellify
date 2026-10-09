import { timingSafeEqual } from "node:crypto";
import { releaseExpiredReservations } from "@/core/api-orders";

// Vercel Cron backstop: gives back stock held by checkouts whose
// checkout.session.expired event never arrived. Vercel sends
// `Authorization: Bearer ${CRON_SECRET}`; anything else is refused.

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
  try {
    const released = await releaseExpiredReservations();
    console.info("[cron reservations] released", { released });
    return Response.json({ released });
  } catch (e) {
    console.error("[cron reservations] failed", { error: (e as Error).message });
    return new Response("Could not release reservations", { status: 500 });
  }
}
