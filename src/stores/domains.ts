import "server-only";
import { requireShop } from "@/core/shop";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json, Tables } from "@/lib/supabase/database.types";
import {
  addErrorMessage,
  addProjectDomain,
  checkProjectDomain,
  parseCustomDomain,
  removeProjectDomain,
  VercelApiError,
  type DnsRecord,
  type DomainState,
  type DomainStatus,
} from "@/lib/vercel/domains";
import { hasOwnershipRecord, newOwnershipToken, ownershipRecord } from "@/lib/vercel/ownership";
import { getOwnerStore, urlEnv } from "./store";

// SELLIFY STORES: the owner's custom domain (one per store).
// Members can only SELECT store_domains; every write goes through the service
// role here, after requireShop() and scoped to the owner's own store id.

export type StoreDomain = {
  id: string;
  domain: string;
  status: DomainStatus;
  records: DnsRecord[];
  message: string;
  lastError: string | null;
  checkedAt: string | null;
};

export type DomainResult = { ok: true } | { ok: false; error: string; field?: "domain" };

const RECORD_TYPES = new Set(["A", "CNAME", "TXT"]);

function toStoreDomain(row: Tables<"store_domains">): StoreDomain {
  const v = (row.verification ?? {}) as { records?: unknown; message?: unknown };
  const records = Array.isArray(v.records)
    ? v.records.filter(
        (r): r is DnsRecord =>
          !!r && typeof r === "object" && RECORD_TYPES.has((r as DnsRecord).type) && typeof (r as DnsRecord).name === "string" && typeof (r as DnsRecord).value === "string",
      )
    : [];
  return {
    id: row.id,
    domain: row.domain,
    status: row.status as DomainStatus,
    records,
    message: typeof v.message === "string" ? v.message : "",
    lastError: row.last_error,
    checkedAt: row.checked_at,
  };
}

function stateColumns(state: DomainState) {
  return {
    status: state.status,
    verification: { records: state.records, message: state.message } as unknown as Json,
    last_error: state.status === "error" ? state.message : null,
    checked_at: new Date().toISOString(),
  };
}

/** The signed-in shop's custom domain, or null. Read through RLS. */
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
  await requireShop();
  const store = await getOwnerStore();
  if (!store) return { ok: false, error: "Create your store first." };

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
  const { data: existing, error: readError } = await admin.from("store_domains").select("store_id, domain").or(`store_id.eq.${store.row.id},domain.eq.${domain}`);
  if (readError) return { ok: false, error: "Could not connect the domain. Try again." };
  if (existing?.some((r) => r.store_id === store.row.id)) {
    return { ok: false, error: "Your store already has a domain. Remove it first to connect a different one." };
  }
  if (existing?.some((r) => r.domain === domain)) {
    return { ok: false, error: "This domain is already connected to another Sellify store.", field: "domain" };
  }

  // Step 1: ownership proof only. The domain is NOT attached to Vercel or
  // routed until the TXT record is found (see checkDomain).
  const token = newOwnershipToken();
  const { error } = await admin.from("store_domains").insert({
    store_id: store.row.id,
    domain,
    status: "pending",
    verification: { records: [ownershipRecord(domain, token)], message: OWNERSHIP_MESSAGE, ownershipToken: token, onVercel: false } as unknown as Json,
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

function storedVerification(row: Tables<"store_domains">) {
  const v = (row.verification ?? {}) as { ownershipToken?: unknown; onVercel?: unknown };
  return { token: typeof v.ownershipToken === "string" ? v.ownershipToken : null, onVercel: v.onVercel === true };
}

export async function checkDomain(): Promise<DomainResult> {
  await requireShop();
  const store = await getOwnerStore();
  const current = await getStoreDomain();
  if (!store || !current) return { ok: false, error: "Connect a domain first." };

  const admin = createAdminClient();
  const { data: row } = await admin.from("store_domains").select("*").eq("id", current.id).eq("store_id", store.row.id).single();
  if (!row) return { ok: false, error: "Connect a domain first." };
  const { token, onVercel } = storedVerification(row);
  if (!token) return { ok: false, error: "Remove this domain and connect it again." };

  // Step 1: ownership. Until the TXT record is found nothing touches Vercel.
  if (!onVercel) {
    const owned = await hasOwnershipRecord(current.domain, token);
    if (!owned) {
      await admin
        .from("store_domains")
        .update({ checked_at: new Date().toISOString(), last_error: null })
        .eq("id", current.id)
        .eq("store_id", store.row.id);
      return { ok: false, error: "We can't see the TXT record yet. DNS changes can take a while; try again later." };
    }
    try {
      await addProjectDomain(current.domain);
    } catch (e) {
      return { ok: false, error: addErrorMessage(e) };
    }
  }

  let state: DomainState;
  try {
    state = await checkProjectDomain(current.domain);
  } catch (e) {
    const message = e instanceof VercelApiError && e.code === "not_configured" ? e.message : "Could not check the domain right now. Try again in a minute.";
    await createAdminClient()
      .from("store_domains")
      .update({ last_error: message, checked_at: new Date().toISOString() })
      .eq("id", current.id)
      .eq("store_id", store.row.id);
    return { ok: false, error: message };
  }

  const cols = stateColumns(state);
  const { error } = await admin
    .from("store_domains")
    .update({
      ...cols,
      // Keep the proof so the ownership step is not repeated.
      verification: { ...(cols.verification as object), ownershipToken: token, onVercel: true } as unknown as Json,
    })
    .eq("id", current.id)
    .eq("store_id", store.row.id);
  return error ? { ok: false, error: "Could not save the status. Try again." } : { ok: true };
}

export async function removeDomain(): Promise<DomainResult> {
  await requireShop();
  const store = await getOwnerStore();
  const current = await getStoreDomain();
  if (!store || !current) return { ok: true };

  const { data: row } = await createAdminClient().from("store_domains").select("*").eq("id", current.id).single();
  const onVercel = row ? storedVerification(row).onVercel : false;
  try {
    if (onVercel) await removeProjectDomain(current.domain);
  } catch (e) {
    if (!(e instanceof VercelApiError && e.code === "not_configured")) {
      return { ok: false, error: "Could not remove the domain. Try again." };
    }
  }
  const { error } = await createAdminClient().from("store_domains").delete().eq("id", current.id).eq("store_id", store.row.id);
  return error ? { ok: false, error: "Could not remove the domain. Try again." } : { ok: true };
}
