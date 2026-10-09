import { isAuthorizedCron, staleBefore } from "@/lib/vercel/cron";
import { CRON_ACTIVE_RECHECK_DAYS, CRON_BATCH_SIZE, recheckDueDomains } from "@/stores/domains";

// SELLIFY STORES: background re-check of custom domains (Vercel Cron).
// Re-checks every store_domains row that is not 'active' yet, and active rows
// whose last check is older than 7 days (ownership TXT still present, DNS
// still pointing here). Oldest check first, capped per run.
// Auth: `Authorization: Bearer ${CRON_SECRET}`; anything else gets 401.

export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedCron(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  try {
    const summary = await recheckDueDomains({
      staleBefore: staleBefore(new Date(), CRON_ACTIVE_RECHECK_DAYS),
      limit: CRON_BATCH_SIZE,
      concurrency: 5,
      budgetMs: 40_000,
    });
    const ms = Date.now() - started;
    console.info(
      `[cron/domains] due=${summary.due} checked=${summary.checked} ok=${summary.ok} failed=${summary.failed} skipped=${summary.skipped} statuses=${JSON.stringify(summary.byStatus)} ms=${ms}`,
    );
    return Response.json({ ...summary, ms });
  } catch (e) {
    console.error("[cron/domains] failed", e);
    return Response.json({ error: "Domain re-check failed" }, { status: 500 });
  }
}
