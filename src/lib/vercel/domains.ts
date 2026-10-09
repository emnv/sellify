import "server-only";
import { z } from "zod";

// SELLIFY STORES: custom domains through the Vercel REST API.
//
// Endpoints (https://vercel.com/docs/rest-api, checked 2026-10-09):
//   POST   /v10/projects/{id}/domains                 add a domain to the project
//   GET    /v9/projects/{id}/domains/{domain}         project domain (verified + verification challenges)
//   POST   /v9/projects/{id}/domains/{domain}/verify  re-check the verification challenge
//   DELETE /v9/projects/{id}/domains/{domain}         remove it from the project
//   GET    /v6/domains/{domain}/config                DNS config (misconfigured, recommended A / CNAME)
// Every call passes ?teamId=VERCEL_TEAM_ID.
//
// The mapping helpers at the bottom are pure, so they are unit-tested without network.

const API = "https://api.vercel.com";

export const DEFAULT_A_RECORD = "76.76.21.21";
export const DEFAULT_CNAME = "cname.vercel-dns.com";

export type DomainStatus = "pending" | "verified" | "active" | "error";
export type DnsRecord = { type: "A" | "CNAME" | "TXT"; name: string; value: string };
export type DomainState = { status: DomainStatus; records: DnsRecord[]; message: string };

export type VercelVerification = { type: string; domain: string; value: string; reason?: string };
export type VercelProjectDomain = {
  name: string;
  apexName: string;
  verified: boolean;
  verification?: VercelVerification[];
};
export type VercelDomainConfig = {
  misconfigured: boolean;
  configuredBy?: string | null;
  recommendedIPv4?: Array<{ rank: number; value: string[] | string }>;
  recommendedCNAME?: Array<{ rank: number; value: string | string[] }>;
};

export class VercelApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "VercelApiError";
  }
}

// ---------------------------------------------------------------------------
// HTTP client

const envSchema = z.object({
  VERCEL_API_TOKEN: z.string().min(1),
  VERCEL_PROJECT_ID: z.string().min(1),
  VERCEL_TEAM_ID: z.string().optional(),
});

function vercelEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) throw new VercelApiError(500, "not_configured", "Custom domains are not set up on this server.");
  return parsed.data;
}

async function call<T>(method: string, path: (projectId: string) => string, opts: { body?: unknown; query?: Record<string, string> } = {}): Promise<T> {
  const env = vercelEnv();
  const url = new URL(API + path(encodeURIComponent(env.VERCEL_PROJECT_ID)));
  if (env.VERCEL_TEAM_ID) url.searchParams.set("teamId", env.VERCEL_TEAM_ID);
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v);

  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${env.VERCEL_API_TOKEN}`, "Content-Type": "application/json" },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const json: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (json as { error?: { code?: string; message?: string } }).error;
    throw new VercelApiError(res.status, err?.code ?? "unknown", err?.message ?? `Vercel API returned ${res.status}`);
  }
  return json as T;
}

const d = (domain: string) => encodeURIComponent(domain);

export function addProjectDomain(domain: string) {
  return call<VercelProjectDomain>("POST", (p) => `/v10/projects/${p}/domains`, { body: { name: domain } });
}

/** The project domain, or null when it is not on the project. */
export async function getProjectDomain(domain: string): Promise<VercelProjectDomain | null> {
  try {
    return await call<VercelProjectDomain>("GET", (p) => `/v9/projects/${p}/domains/${d(domain)}`);
  } catch (e) {
    if (e instanceof VercelApiError && e.status === 404) return null;
    throw e;
  }
}

/** Asks Vercel to re-check the challenge. Throws (e.g. 400) while the TXT record is missing. */
export function verifyProjectDomain(domain: string) {
  return call<VercelProjectDomain>("POST", (p) => `/v9/projects/${p}/domains/${d(domain)}/verify`);
}

/** Removes the domain from the project. A domain that is already gone counts as removed. */
export async function removeProjectDomain(domain: string): Promise<void> {
  try {
    await call<unknown>("DELETE", (p) => `/v9/projects/${p}/domains/${d(domain)}`);
  } catch (e) {
    if (e instanceof VercelApiError && e.status === 404) return;
    throw e;
  }
}

export function getDomainConfig(domain: string) {
  const env = vercelEnv();
  return call<VercelDomainConfig>("GET", () => `/v6/domains/${d(domain)}/config`, { query: { projectIdOrName: env.VERCEL_PROJECT_ID } });
}

/**
 * Full status check: re-verify when needed, then read the project domain and
 * its DNS config. Returns the mapped state; null project domain means the
 * domain is no longer on the Vercel project.
 */
export async function checkProjectDomain(domain: string): Promise<DomainState> {
  let project = await getProjectDomain(domain);
  if (!project) return removedState();
  if (!project.verified) {
    try {
      project = await verifyProjectDomain(domain);
      // The verify response has no challenge list; re-read when still unverified.
      if (!project.verified) project = (await getProjectDomain(domain)) ?? project;
    } catch {
      project = (await getProjectDomain(domain)) ?? project;
    }
  }
  const config = await getDomainConfig(domain).catch(() => null);
  return mapDomainState(project, config);
}

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested)

/** Name to type in a DNS provider: "@" for the apex, the label(s) before the apex otherwise. */
export function relativeName(fqdn: string, apex: string): string {
  const host = fqdn.toLowerCase().replace(/\.$/, "");
  const root = apex.toLowerCase().replace(/\.$/, "");
  if (host === root) return "@";
  if (host.endsWith(`.${root}`)) return host.slice(0, -(root.length + 1));
  return host;
}

function first(v: string | string[] | undefined): string | undefined {
  const value = Array.isArray(v) ? v[0] : v;
  return value ? value.replace(/\.$/, "") : undefined;
}

function preferred<T extends { rank: number }>(list: T[] | undefined): T | undefined {
  return list?.length ? [...list].sort((a, b) => a.rank - b.rank)[0] : undefined;
}

/** The records the owner adds at their DNS provider. */
export function dnsRecordsFor(project: VercelProjectDomain, config: VercelDomainConfig | null): DnsRecord[] {
  const apex = project.apexName || project.name;
  const records: DnsRecord[] = [];

  if (project.name === apex) {
    records.push({ type: "A", name: "@", value: first(preferred(config?.recommendedIPv4)?.value) ?? DEFAULT_A_RECORD });
  } else {
    records.push({ type: "CNAME", name: relativeName(project.name, apex), value: first(preferred(config?.recommendedCNAME)?.value) ?? DEFAULT_CNAME });
  }

  if (!project.verified) {
    for (const v of project.verification ?? []) {
      if (v.type.toUpperCase() !== "TXT" || !v.value) continue;
      records.push({ type: "TXT", name: relativeName(v.domain, apex), value: v.value });
    }
  }
  return records;
}

/**
 * pending  → Vercel has not verified ownership yet (TXT missing) or DNS not checked
 * verified → ownership verified, but DNS does not point at Vercel yet
 * active   → verified and DNS correct; Vercel issues the HTTPS certificate itself
 */
export function mapDomainState(project: VercelProjectDomain, config: VercelDomainConfig | null): DomainState {
  const records = dnsRecordsFor(project, config);
  const needsTxt = records.some((r) => r.type === "TXT");

  if (!project.verified) {
    return {
      status: "pending",
      records,
      message: needsTxt
        ? "Add all the records below. The TXT record proves you own the domain."
        : "Add the record below. We check it each time you click Check status.",
    };
  }
  if (!config) {
    return { status: "verified", records, message: "Your domain is verified. We could not check its DNS just now. Try again in a minute." };
  }
  if (config.misconfigured) {
    return { status: "verified", records, message: "Your domain is verified. Point it at Sellify with the record below to go live." };
  }
  return { status: "active", records, message: "Your store is live on this domain with HTTPS." };
}

export function removedState(): DomainState {
  return { status: "error", records: [], message: "This domain is no longer connected. Remove it and connect it again." };
}

/** Plain-language message for an API error from adding a domain. */
export function addErrorMessage(e: unknown): string {
  if (!(e instanceof VercelApiError)) return "Could not connect the domain. Try again.";
  if (e.code === "not_configured") return e.message;
  if (e.status === 409 || /in_use|already|taken|exists/.test(e.code)) {
    return "This domain is already used by another website. Remove it there first, then try again.";
  }
  if (e.status === 400 && /invalid/.test(e.code)) return "That doesn't look like a domain you can connect. Check the spelling.";
  if (e.status === 401 || e.status === 403) return "Custom domains are not available right now. Contact support.";
  return "Could not connect the domain. Try again.";
}

// ---------------------------------------------------------------------------
// Input normalisation

const HOSTNAME = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export type ParsedDomain = { ok: true; domain: string } | { ok: false; error: string };

/**
 * Turn what the owner typed ("https://www.FixIt.ie/shop") into a bare host
 * ("www.fixit.ie") and reject hosts Sellify itself owns.
 */
export function parseCustomDomain(input: string, opts: { rootDomain?: string; appHost?: string } = {}): ParsedDomain {
  let raw = input.trim().toLowerCase();
  if (!raw) return { ok: false, error: "Enter your domain, like fixitgalway.ie." };
  if (!/^[a-z][a-z0-9+.-]*:\/\//.test(raw)) raw = `http://${raw}`;

  let host: string;
  try {
    const url = new URL(raw);
    if (url.username || url.password) return { ok: false, error: "Enter just the domain, like fixitgalway.ie." };
    host = url.hostname.replace(/\.$/, "");
  } catch {
    return { ok: false, error: "Enter just the domain, like fixitgalway.ie." };
  }

  if (host.length > 253 || !HOSTNAME.test(host)) {
    return { ok: false, error: "That doesn't look like a domain. Enter it like fixitgalway.ie or shop.fixitgalway.ie." };
  }

  const owned = (base: string) => !!base && (host === base || host.endsWith(`.${base}`));
  const root = (opts.rootDomain ?? "").toLowerCase();
  const app = (opts.appHost ?? "").toLowerCase();
  if (owned("localhost") || owned("vercel.app") || owned("vercel.com") || owned(root) || (app && host === app)) {
    return { ok: false, error: "Use a domain you own. Your Sellify address already works without connecting it." };
  }
  return { ok: true, domain: host };
}
