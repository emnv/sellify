import "server-only";
import { randomBytes } from "node:crypto";
import { resolveTxt } from "node:dns/promises";
import type { DnsRecord } from "./domains";

// Proof that a shop controls a domain BEFORE it is attached to the Vercel
// project and routed to their store. Without it, a shop could claim someone
// else's domain and receive its traffic once the real owner points DNS at
// Vercel. Proof = a TXT record at _sellify-verify.<domain> with our token.

export const OWNERSHIP_LABEL = "_sellify-verify";

export function newOwnershipToken() {
  return `sellify-verify=${randomBytes(16).toString("hex")}`;
}

/** The TXT record the owner must add (full host name; some DNS providers want only the part before the domain). */
export function ownershipRecord(domain: string, token: string): DnsRecord {
  return { type: "TXT", name: `${OWNERSHIP_LABEL}.${domain}`, value: token };
}

/** True when the TXT record is published. DNS errors (NXDOMAIN, timeout) → false. */
export async function hasOwnershipRecord(domain: string, token: string, timeoutMs = 5000): Promise<boolean> {
  const lookup = resolveTxt(`${OWNERSHIP_LABEL}.${domain}`)
    .then((records) => records.some((chunks) => chunks.join("").trim() === token))
    .catch(() => false);
  const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs));
  return Promise.race([lookup, timeout]);
}
