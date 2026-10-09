import { describe, expect, it } from "vitest";
import { classifyHost } from "./hosts";
import { storeUrl } from "@/stores/urls";

describe("classifyHost", () => {
  it("treats localhost and vercel.app as the app", () => {
    expect(classifyHost("localhost:3000", "")).toEqual({ kind: "app" });
    expect(classifyHost("sellify-lemon.vercel.app", "")).toEqual({ kind: "app" });
  });
  it("routes <slug>.localhost to a store in dev", () => {
    expect(classifyHost("fixit-galway.localhost:3000", "")).toEqual({ kind: "store", slug: "fixit-galway" });
  });
  it("routes subdomains of the root domain to stores", () => {
    expect(classifyHost("fixit-galway.mystores.com", "mystores.com")).toEqual({ kind: "store", slug: "fixit-galway" });
    expect(classifyHost("app.mystores.com", "mystores.com")).toEqual({ kind: "app" });
    expect(classifyHost("mystores.com", "mystores.com")).toEqual({ kind: "app" });
  });
  it("treats unknown hosts as custom domains", () => {
    expect(classifyHost("FixItGalway.ie", "mystores.com")).toEqual({ kind: "domain", host: "fixitgalway.ie" });
  });
  it("does not treat nested subdomains as stores", () => {
    expect(classifyHost("a.b.mystores.com", "mystores.com")).toEqual({ kind: "app" });
  });
  it("respects the configured app host", () => {
    expect(classifyHost("admin.example.org", "", "admin.example.org")).toEqual({ kind: "app" });
  });
});

describe("storeUrl", () => {
  const appUrl = "https://sellify-lemon.vercel.app";
  it("uses /s/<slug> without a root domain", () => {
    expect(storeUrl("fixit", { rootDomain: "", appUrl })).toBe("https://sellify-lemon.vercel.app/s/fixit");
  });
  it("uses a subdomain with a root domain", () => {
    expect(storeUrl("fixit", { rootDomain: "mystores.com", appUrl })).toBe("https://fixit.mystores.com");
  });
  it("prefers a connected custom domain", () => {
    expect(storeUrl("fixit", { rootDomain: "", appUrl }, "fixitgalway.ie")).toBe("https://fixitgalway.ie");
  });
});
