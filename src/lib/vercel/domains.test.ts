import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  addErrorMessage,
  dnsRecordsFor,
  mapDomainState,
  parseCustomDomain,
  relativeName,
  VercelApiError,
  DEFAULT_A_RECORD,
  DEFAULT_CNAME,
  isApexDomain,
  wwwVariant,
  wwwRedirectBody,
  isWwwRedirectTo,
  combineWithWww,
} = await import("./domains");

// Sample payloads shaped like the Vercel REST API responses.
const apexUnverified = {
  name: "fixitgalway.ie",
  apexName: "fixitgalway.ie",
  projectId: "prj_x",
  verified: false,
  verification: [{ type: "TXT", domain: "_vercel.fixitgalway.ie", value: "vc-domain-verify=fixitgalway.ie,abc123", reason: "pending_domain_verification" }],
};
const subVerified = { name: "shop.fixitgalway.ie", apexName: "fixitgalway.ie", projectId: "prj_x", verified: true };
const misconfigured = {
  configuredBy: null,
  misconfigured: true,
  acceptedChallenges: ["dns-01", "http-01"],
  recommendedIPv4: [{ rank: 1, value: ["76.76.21.99"] }, { rank: 2, value: ["76.76.21.21"] }],
  recommendedCNAME: [{ rank: 2, value: "cname.vercel-dns.com." }, { rank: 1, value: "abc123.vercel-dns-017.com." }],
};
const configured = { ...misconfigured, configuredBy: "CNAME", misconfigured: false };

describe("relativeName", () => {
  it("uses @ for the apex and the labels before it otherwise", () => {
    expect(relativeName("fixitgalway.ie", "fixitgalway.ie")).toBe("@");
    expect(relativeName("shop.fixitgalway.ie", "fixitgalway.ie")).toBe("shop");
    expect(relativeName("_vercel.fixitgalway.ie", "fixitgalway.ie")).toBe("_vercel");
    expect(relativeName("a.b.example.co.uk", "example.co.uk")).toBe("a.b");
  });
});

describe("dnsRecordsFor", () => {
  it("apex domain: A record (recommended value) plus TXT when unverified", () => {
    expect(dnsRecordsFor(apexUnverified, misconfigured)).toEqual([
      { type: "A", name: "@", value: "76.76.21.99" },
      { type: "TXT", name: "_vercel", value: "vc-domain-verify=fixitgalway.ie,abc123" },
    ]);
  });

  it("apex domain without config falls back to 76.76.21.21", () => {
    expect(dnsRecordsFor({ ...apexUnverified, verification: [] }, null)).toEqual([{ type: "A", name: "@", value: DEFAULT_A_RECORD }]);
  });

  it("subdomain: CNAME with the top-ranked recommendation, no TXT once verified", () => {
    expect(dnsRecordsFor(subVerified, misconfigured)).toEqual([{ type: "CNAME", name: "shop", value: "abc123.vercel-dns-017.com" }]);
  });

  it("subdomain without config falls back to cname.vercel-dns.com", () => {
    expect(dnsRecordsFor(subVerified, null)).toEqual([{ type: "CNAME", name: "shop", value: DEFAULT_CNAME }]);
  });
});

describe("mapDomainState", () => {
  it("pending while ownership needs a TXT record", () => {
    const s = mapDomainState(apexUnverified, misconfigured);
    expect(s.status).toBe("pending");
    expect(s.records.map((r) => r.type)).toEqual(["A", "TXT"]);
    expect(s.message).toMatch(/TXT/);
  });

  it("pending without TXT when Vercel gives no challenge", () => {
    const s = mapDomainState({ ...apexUnverified, verification: undefined }, misconfigured);
    expect(s.status).toBe("pending");
    expect(s.records).toHaveLength(1);
  });

  it("verified but misconfigured DNS stays 'verified'", () => {
    expect(mapDomainState(subVerified, misconfigured).status).toBe("verified");
  });

  it("verified with unknown config stays 'verified'", () => {
    expect(mapDomainState(subVerified, null).status).toBe("verified");
  });

  it("verified and configured is 'active' (HTTPS)", () => {
    const s = mapDomainState(subVerified, configured);
    expect(s.status).toBe("active");
    expect(s.message).toMatch(/HTTPS/);
  });
});

describe("parseCustomDomain", () => {
  const opts = { rootDomain: "sellify.app", appHost: "app.sellify.app" };

  it("strips scheme, path, port and trailing dot; lowercases", () => {
    expect(parseCustomDomain("  https://FixItGalway.ie/shop?x=1 ", opts)).toEqual({ ok: true, domain: "fixitgalway.ie" });
    expect(parseCustomDomain("shop.fixitgalway.ie:8080", opts)).toEqual({ ok: true, domain: "shop.fixitgalway.ie" });
    expect(parseCustomDomain("www.fixitgalway.ie.", opts)).toEqual({ ok: true, domain: "www.fixitgalway.ie" });
  });

  it("rejects non-hostnames", () => {
    for (const bad of ["", "fixit", "192.168.1.1", "fix_it.ie", "-bad.ie", "a..ie"]) {
      expect(parseCustomDomain(bad, opts).ok).toBe(false);
    }
  });

  it("rejects hosts Sellify owns", () => {
    for (const bad of ["localhost", "shop.localhost", "sellify-lemon.vercel.app", "sellify.app", "fixit.sellify.app", "app.sellify.app"]) {
      expect(parseCustomDomain(bad, opts).ok).toBe(false);
    }
  });
});

describe("www variant", () => {
  const wwwUnverified = {
    name: "www.fixitgalway.ie",
    apexName: "fixitgalway.ie",
    verified: false,
    redirect: "fixitgalway.ie",
    redirectStatusCode: 308,
    verification: [
      { type: "TXT", domain: "_vercel.fixitgalway.ie", value: "vc-domain-verify=fixitgalway.ie,abc123" },
      { type: "TXT", domain: "_vercel.fixitgalway.ie", value: "vc-domain-verify=www.fixitgalway.ie,def456" },
    ],
  };

  it("only an apex domain gets a www variant", () => {
    expect(isApexDomain(apexUnverified)).toBe(true);
    expect(isApexDomain(subVerified)).toBe(false);
    expect(isApexDomain({ name: "www.fixitgalway.ie", apexName: "fixitgalway.ie" })).toBe(false);
    expect(isApexDomain({ name: "fixit.co.uk", apexName: "fixit.co.uk" })).toBe(true);
    expect(isApexDomain({ name: "shop.fixit.co.uk", apexName: "fixit.co.uk" })).toBe(false);
  });

  it("adds www as a 308 redirect to the bare apex", () => {
    expect(wwwVariant("FixItGalway.ie.")).toBe("www.fixitgalway.ie");
    expect(wwwRedirectBody("fixitgalway.ie")).toEqual({ name: "www.fixitgalway.ie", redirect: "fixitgalway.ie", redirectStatusCode: 308 });
  });

  it("recognises an existing redirect, including string status and https:// target", () => {
    expect(isWwwRedirectTo({ redirect: "fixitgalway.ie", redirectStatusCode: 308 }, "fixitgalway.ie")).toBe(true);
    expect(isWwwRedirectTo({ redirect: "https://fixitgalway.ie/", redirectStatusCode: "308" }, "fixitgalway.ie")).toBe(true);
    expect(isWwwRedirectTo({ redirect: "fixitgalway.ie", redirectStatusCode: 307 }, "fixitgalway.ie")).toBe(false);
    expect(isWwwRedirectTo({ redirect: null, redirectStatusCode: null }, "fixitgalway.ie")).toBe(false);
    expect(isWwwRedirectTo({ redirect: "other.ie", redirectStatusCode: 308 }, "fixitgalway.ie")).toBe(false);
  });

  it("www DNS record is a CNAME named www with the recommended value", () => {
    expect(dnsRecordsFor({ ...wwwUnverified, verified: true }, misconfigured)).toEqual([{ type: "CNAME", name: "www", value: "abc123.vercel-dns-017.com" }]);
    expect(dnsRecordsFor({ ...wwwUnverified, verified: true }, null)).toEqual([{ type: "CNAME", name: "www", value: DEFAULT_CNAME }]);
  });

  it("shows www records alongside the apex ones without duplicates; apex status wins", () => {
    const apex = mapDomainState(apexUnverified, misconfigured);
    const www = mapDomainState(wwwUnverified, misconfigured);
    const combined = combineWithWww(apex, { domain: "www.fixitgalway.ie", status: www.status, records: www.records, note: null });
    expect(combined.status).toBe("pending");
    expect(combined.records).toEqual([
      { type: "A", name: "@", value: "76.76.21.99" },
      { type: "TXT", name: "_vercel", value: "vc-domain-verify=fixitgalway.ie,abc123" },
      { type: "CNAME", name: "www", value: "abc123.vercel-dns-017.com" },
      { type: "TXT", name: "_vercel", value: "vc-domain-verify=www.fixitgalway.ie,def456" },
    ]);
    expect(combined.message).toMatch(/www\.fixitgalway\.ie/);
  });

  it("an active apex stays active while www still needs its record", () => {
    const apex = mapDomainState({ ...apexUnverified, verified: true }, configured);
    const combined = combineWithWww(apex, { domain: "www.fixitgalway.ie", status: "verified", records: [{ type: "CNAME", name: "www", value: DEFAULT_CNAME }], note: null });
    expect(combined.status).toBe("active");
    expect(combined.records.map((r) => r.name)).toEqual(["@", "www"]);
    expect(combined.message).toMatch(/www forwards/);
  });

  it("no www (subdomain) leaves the state untouched; a note replaces the default hint", () => {
    const sub = mapDomainState(subVerified, configured);
    expect(combineWithWww(sub, null)).toBe(sub);
    const apex = mapDomainState({ ...apexUnverified, verified: true }, configured);
    const noted = combineWithWww(apex, { domain: "www.fixitgalway.ie", status: "error", records: [], note: "Taken elsewhere." });
    expect(noted.message.endsWith("Taken elsewhere.")).toBe(true);
    expect(noted.records).toEqual(apex.records);
  });
});

describe("addErrorMessage", () => {
  it("explains a domain used elsewhere", () => {
    expect(addErrorMessage(new VercelApiError(409, "domain_already_in_use", "x"))).toMatch(/already used/);
  });
  it("falls back to a generic retry message", () => {
    expect(addErrorMessage(new Error("boom"))).toMatch(/Try again/);
  });
});
