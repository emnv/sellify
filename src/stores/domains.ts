import "server-only";
import { requireShop } from "@/core/shop";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json, Tables } from "@/lib/supabase/database.types";
import {
  addErrorMessage,
  addProjectDomain,
  addWwwRedirect,
  checkProjectDomain,
  combineWithWww,
  parseCustomDomain,
  removeProjectDomain,
  VercelApiError,
  wwwVariant,
  type DnsRecord,
  type DomainStatus,
  type ProjectDomainCheck,
  type WwwState,
} from "@/lib/vercel/domains";
import { hasOwnershipRecord, newOwnershipToken, ownershipRecord } from "@/lib/vercel/ownership";
import { getOwnerStore, urlEnv } from "./store";

// SELLIFY STORES: the owner's custom domain (one per store).
// Members can only SELECT store_domains; every write goes through the service
// role here. Session-bound functions (addDomain, checkDomain, removeDomain)
// require the shop OWNER and scope to their own store id. recheckDomainRow is
// the session-free core used by both checkDomain and the cron route.
//
// verification jsonb:
//   records, message      what the owner sees (apex + www records)
//   ownershipToken        the _sellify-verify TXT proof (covers www too)
//   onVercel              apex attached to the Vercel project
//   www                   { domain, onVercel, status, note } for an apex
//                         domain; www.<apex> is a 308 redirect to the apex on
//                         Vercel, so it never reaches the app and is NOT in
//                         the domain column.

type Admin = ReturnType<typeof createAdminClient>;
type Row = Tables<"store_domains">;

export type StoreWww = { domain: string; status: DomainStatus; note: string | null };

export type StoreDomain = {
  id: string;
  domain: string;
  status: DomainStatus;
  records: DnsRecord[];
  message: string;
  lastError: string | null;
  checkedAt: string | null;
  www: StoreWww | null;
};

export type DomainResult = { ok: true } | { ok: false; error: string; field?: "domain" };

export const OWNER_ONLY_MESSAGE = "Only the shop owner can change the domain.";

const RECORD_TYPES = new Set(["A", "CNAME", "TXT"]);
const STATUSES = new Set<DomainStatus>(["pending", "verified", "active", "error"]);

type StoredWww = { domain: string; onVercel: boolean; status: DomainStatus; note: string | null };
type Stored = { token: string | null; onVercel: boolean; www: StoredWww | null };

function parseRecords(v: unknown): DnsRecord[] {
  return Array.isArray(v)
    ? v.filter(
        (r): r is DnsRecord =>
          !!r && typeof r === "object" && RECORD_TYPES.has((r as DnsRecord).type) && typeof (r as DnsRecord).name === "string" && typeof (r as DnsRecord).value === "string",
      )
    : [];
}

function storedVerification(row: Pick<Row, "verification">): Stored {
  const v = (row.verification ?? {}) as { ownershipToken?: unknown; onVercel?: unknown; www?: unknown };
  let www: StoredWww | null = null;
  if (v.www && typeof v.www === "object") {
    const w = v.www as { domain?: unknown; onVercel?: unknown; status?: unknown; note?: unknown };
    if (typeof w.domain === "string") {
      www = {
        domain: w.domain,
        onVercel: w.onVercel === true,
        status: STATUSES.has(w.status as DomainStatus) ? (w.status as DomainStatus) : "pending",
        note: typeof w.note === "string" ? w.note : null,
      };
    }
  }
  return { token: typeof v.ownershipToken === "string" ? v.ownershipToken : null, onVercel: v.onVercel === true, www };
}

function toStoreDomain(row: Row): StoreDomain {
  const v = (row.verification ?? {}) as { records?: unknown; message?: unknown };
  const { www } = storedVerification(row);
  return {
    id: row.id,
    domain: row.domain,
    status: row.status as DomainStatus,
    records: parseRecords(v.records),
    message: typeof v.message === "string" ? v.message : "",
    lastError: row.last_error,
    checkedAt: row.checked_at,
    www: www ? { domain: www.domain, status: www.status, note: www.note } : null,
  };
}

function verificationJson(v: { records: DnsRecord[]; message: string; token: string; onVercel: boolean; www: StoredWww | null }): Json {
  return { records: v.records, message: v.message, ownershipToken: v.token, onVercel: v.onVercel, www: v.www } as unknown as Json;
}

/** Session gate for every write: signed in, shop OWNER, store exists. */
async function requireOwner(): Promise<{ ok: true; storeId: string } | { ok: false; error: string }> {
  const { role } = await requireShop();
  if (role !== "owner") return { ok: false, error: OWNER_ONLY_MESSAGE };
  const store = await getOwnerStore();
  if (!store) return { ok: false, error: "Create your store first." };
  return { ok: true, storeId: store.row.id };
}

/** The signed-in shop's custom domain, or null. Read through RLS (owners and staff). */
export async function getStoreDomain(): Promise<StoreDomain | null> {
  const store = await getOwnerStore();
  if (!store) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("store_domains")
    .select("*")
    .eq("store_id", store.row.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Could not load your domain: ${error.message}`);
  return data ? toStoreDomain(data) : null;
}

export async function addDomain(input: string): Promise<DomainResult> {
  const gate = await requireOwner();
  if (!gate.ok) return gate;
  const storeId = gate.storeId;

  const env = urlEnv();
  let appHost = "";
  try {
    appHost = new URL(env.appUrl).hostname;
  } catch {
    // APP_URL is validated by the env schema; ignore.
  }
  const parsed = parseCustomDomain(input, { rootDomain: env.rootDomain, appHost });
  if (!parsed.ok) return { ok: false, error: parsed.error, field: "domain" };
  const domain = parsed.domain;

  const admin = createAdminClient();
  const { data: existing, error: readError } = await admin.from("store_domains").select("store_id, domain").or(`store_id.eq.${storeId},domain.eq.${domain}`);
  if (readError) return { ok: false, error: "Could not connect the domain. Try again." };
  if (existing?.some((r) => r.store_id === storeId)) {
    return { ok: false, error: "Your store already has a domain. Remove it first to connect a different one." };
  }
  if (existing?.some((r) => r.domain === domain)) {
    return { ok: false, error: "This domain is already connected to another Sellify store.", field: "domain" };
  }
  // www.<apex> may already be in use as another store's apex redirect.
  if (domain.startsWith("www.")) {
    const { data: apexRow } = await admin.from("store_domains").select("verification").eq("domain", domain.slice(4)).maybeSingle();
    const apexWww = apexRow ? storedVerification(apexRow).www : null;
    if (apexWww?.onVercel) return { ok: false, error: "This domain is already connected to another Sellify store.", field: "domain" };
  }

  // Step 1: ownership proof only. The domain is NOT attached to Vercel or
  // routed until the TXT record is found (see recheckDomainRow).
  const token = newOwnershipToken();
  const { error } = await admin.from("store_domains").insert({
    store_id: storeId,
    domain,
    status: "pending",
    verification: verificationJson({ records: [ownershipRecord(domain, token)], message: OWNERSHIP_MESSAGE, token, onVercel: false, www: null }),
    last_error: null,
    checked_at: new Date().toISOString(),
  });
  if (error) {
    return error.code === "23505"
      ? { ok: false, error: "This domain is already connected to another Sellify store.", field: "domain" }
      : { ok: false, error: "Could not connect the domain. Try again." };
  }
  return { ok: true };
}

const OWNERSHIP_MESSAGE =
  "First, prove you own this domain: add the TXT record below at your domain provider, then click Check status. After that we show the records that point the domain at your store.";

async function loadOwnRow(admin: Admin, storeId: string): Promise<Row | null> {
  const { data } = await admin.from("store_domains").select("*").eq("store_id", storeId).order("created_at", { ascending: true }).limit(1).maybeSingle();
  return data;
}

export async function checkDomain(): Promise<DomainResult> {
  const gate = await requireOwner();
  if (!gate.ok) return gate;
  const admin = createAdminClient();
  const row = await loadOwnRow(admin, gate.storeId);
  if (!row) return { ok: false, error: "Connect a domain first." };
  return recheckDomainRow(row, admin);
}

/** Detaches www (first: it redirects to the apex) and then the apex from Vercel. Missing domains count as removed. */
async function detachFromVercel(domain: string, stored: Stored): Promise<void> {
  if (stored.www?.onVercel) await removeProjectDomain(stored.www.domain);
  if (stored.onVercel) await removeProjectDomain(domain);
}

/**
 * The full domain check for one row, without a user session: re-proves
 * ownership, attaches the apex (and its www redirect) to Vercel once proven,
 * then saves the mapped state. Every path updates checked_at so the cron's
 * oldest-first queue keeps moving. Callers must have authorised access to
 * this row (owner session, or the cron secret).
 */
export async function recheckDomainRow(row: Row, admin: Admin = createAdminClient()): Promise<DomainResult> {
  const stored = storedVerification(row);
  const now = () => new Date().toISOString();
  const save = (cols: Partial<Pick<Row, "status" | "verification" | "last_error">>) =>
    admin
      .from("store_domains")
      .update({ ...cols, checked_at: now() })
      .eq("id", row.id)
      .eq("store_id", row.store_id);

  const token = stored.token;
  if (!token) {
    const error = "Remove this domain and connect it again.";
    await save({ last_error: error });
    return { ok: false, error };
  }

  // Step 1: ownership, re-checked on EVERY check (owners keep the TXT record).
  // If a domain changes hands and the record disappears, it stops routing here.
  const owned = await hasOwnershipRecord(row.domain, token);
  if (!owned) {
    const wasAttached = stored.onVercel || !!stored.www?.onVercel;
    if (wasAttached) await detachFromVercel(row.domain, stored).catch(() => undefined);
    await save({
      status: "pending",
      verification: verificationJson({ records: [ownershipRecord(row.domain, token)], message: OWNERSHIP_MESSAGE, token, onVercel: false, www: null }),
      last_error: wasAttached ? "The ownership TXT record is gone, so the domain was disconnected. Add it back to reconnect." : null,
    });
    return {
      ok: false,
      error: wasAttached
        ? "We couldn't find your _sellify-verify TXT record any more, so the domain was disconnected. Add the record back, then check again."
        : "We can't see the TXT record yet. DNS changes can take a while; try again later.",
    };
  }

  if (!stored.onVercel) {
    try {
      await addProjectDomain(row.domain);
    } catch (e) {
      // Already attached (e.g. an earlier check added it but failed to save):
      // carry on and read its state below instead of failing.
      const attached = await checkProjectDomain(row.domain).then((s) => s.status !== "error").catch(() => false);
      if (!attached) {
        const error = addErrorMessage(e);
        await save({ last_error: error });
        return { ok: false, error };
      }
    }
  }

  let apex: ProjectDomainCheck;
  try {
    apex = await checkProjectDomain(row.domain);
  } catch (e) {
    const message = e instanceof VercelApiError && e.code === "not_configured" ? e.message : "Could not check the domain right now. Try again in a minute.";
    // The apex is on Vercel from here on; remember that so removal detaches it.
    await save({ last_error: message, verification: verificationJson({ ...currentView(row), token, onVercel: true, www: stored.www }) });
    return { ok: false, error: message };
  }

  // Step 2: www. Only for an apex domain; the apex ownership proof covers it.
  // (If the apex vanished from the project, isApex is false: keep the stored
  // www as is so Remove domain still detaches it.)
  const www = apex.isApex ? await syncWww(admin, row, apex, stored.www) : stored.www ? { stored: stored.www, records: [] } : null;
  const wwwView: WwwState | null = www && apex.isApex ? { domain: www.stored.domain, status: www.stored.status, records: www.records, note: www.stored.note } : null;
  const state = combineWithWww(apex, wwwView);

  const { error } = await save({
    status: state.status,
    verification: verificationJson({ records: state.records, message: state.message, token, onVercel: true, www: www?.stored ?? null }),
    last_error: state.status === "error" ? state.message : null,
  });
  return error ? { ok: false, error: "Could not save the status. Try again." } : { ok: true };
}

function currentView(row: Row): { records: DnsRecord[]; message: string } {
  const v = (row.verification ?? {}) as { records?: unknown; message?: unknown };
  return { records: parseRecords(v.records), message: typeof v.message === "string" ? v.message : "" };
}

/**
 * Attaches www.<apex> as a 308 redirect (once) and reads its state. Skipped
 * when another store has connected www.<apex> itself, so this never takes
 * over a domain someone else proved.
 */
async function syncWww(admin: Admin, row: Row, apex: ProjectDomainCheck, prev: StoredWww | null): Promise<{ stored: StoredWww; records: DnsRecord[] }> {
  const domain = wwwVariant(row.domain);
  const { data: clash } = await admin.from("store_domains").select("id").eq("domain", domain).neq("id", row.id).limit(1);
  if (clash?.length) {
    return {
      stored: { domain, onVercel: false, status: "error", note: `${domain} is connected to another Sellify store, so it does not forward here.` },
      records: [],
    };
  }

  let onVercel = prev?.onVercel === true && prev.domain === domain;
  if (!onVercel) {
    try {
      await addWwwRedirect(row.domain);
      onVercel = true;
    } catch (e) {
      const note =
        e instanceof VercelApiError && (e.status === 409 || /in_use|already|taken|exists/.test(e.code))
          ? `${domain} is used by another website, so it does not forward here. Remove it there, then check again.`
          : `We could not set up ${domain} yet. Check status again in a minute.`;
      return { stored: { domain, onVercel: false, status: "error", note }, records: [] };
    }
  }

  const state = await checkProjectDomain(domain).catch(() => null);
  if (!state) {
    return { stored: { domain, onVercel, status: prev?.status ?? "pending", note: null }, records: [] };
  }
  if (state.status === "error") {
    // Gone from the project (removed by hand): re-add on the next check.
    return { stored: { domain, onVercel: false, status: "pending", note: null }, records: [] };
  }
  // A www redirect only works once the apex itself is live.
  const status: DomainStatus = state.status === "active" && apex.status !== "active" ? "verified" : state.status;
  return { stored: { domain, onVercel, status, note: null }, records: state.records };
}

export async function removeDomain(): Promise<DomainResult> {
  const gate = await requireOwner();
  if (!gate.ok) return gate;
  const admin = createAdminClient();
  const row = await loadOwnRow(admin, gate.storeId);
  if (!row) return { ok: true };

  try {
    await detachFromVercel(row.domain, storedVerification(row));
  } catch (e) {
    if (!(e instanceof VercelApiError && e.code === "not_configured")) {
      return { ok: false, error: "Could not remove the domain. Try again." };
    }
  }
  const { error } = await admin.from("store_domains").delete().eq("id", row.id).eq("store_id", gate.storeId);
  return error ? { ok: false, error: "Could not remove the domain. Try again." } : { ok: true };
}

// ---------------------------------------------------------------------------
// Background re-check (cron). No session: authorised by CRON_SECRET in the route.

export const CRON_BATCH_SIZE = 25;
export const CRON_ACTIVE_RECHECK_DAYS = 7;

export type RecheckSummary = { due: number; checked: number; ok: number; failed: number; skipped: number; byStatus: Record<string, number> };

/**
 * Re-checks rows that are not active, plus active rows last checked before
 * `staleBefore`. Oldest check first, at most `limit` rows, a few at a time,
 * and stops starting new rows once `budgetMs` has passed.
 */
export async function recheckDueDomains(opts: { staleBefore: string; limit?: number; concurrency?: number; budgetMs?: number }): Promise<RecheckSummary> {
  const admin = createAdminClient();
  const limit = opts.limit ?? CRON_BATCH_SIZE;
  const started = Date.now();
  const { data: rows, error } = await admin
    .from("store_domains")
    .select("*")
    .or(`status.neq.active,checked_at.is.null,checked_at.lt."${opts.staleBefore}"`)
    .order("checked_at", { ascending: true, nullsFirst: true })
    .limit(limit);
  if (error) throw new Error(`Could not load domains to check: ${error.message}`);

  const summary: RecheckSummary = { due: rows?.length ?? 0, checked: 0, ok: 0, failed: 0, skipped: 0, byStatus: {} };
  const queue = [...(rows ?? [])];
  const worker = async () => {
    for (let row = queue.shift(); row; row = queue.shift()) {
      if (opts.budgetMs && Date.now() - started > opts.budgetMs) {
        summary.skipped += 1;
        continue;
      }
      const result = await recheckDomainRow(row, admin).catch(() => ({ ok: false }) as const);
      summary.checked += 1;
      if (result.ok) summary.ok += 1;
      else summary.failed += 1;
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, opts.concurrency ?? 5) }, worker));

  if (rows?.length) {
    const { data: after } = await admin.from("store_domains").select("status").in("id", rows.map((r) => r.id));
    for (const r of after ?? []) summary.byStatus[r.status] = (summary.byStatus[r.status] ?? 0) + 1;
  }
  return summary;
}
