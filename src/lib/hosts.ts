// Classifies the request host. Pure, so it is unit-tested and usable in proxy.ts.
//   app    → the Sellify backend (localhost, *.vercel.app, app.<root>, APP_URL host)
//   store  → <slug>.<root> or <slug>.localhost
//   domain → anything else: a shop's custom domain

export type HostKind = { kind: "app" } | { kind: "store"; slug: string } | { kind: "domain"; host: string };

const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

export function classifyHost(rawHost: string, rootDomain: string, appHost = ""): HostKind {
  const host = rawHost.split(":")[0].toLowerCase().replace(/\.$/, "");
  const root = rootDomain.toLowerCase();

  if (!host || host === "localhost" || host === "127.0.0.1" || host === "[::1]") return { kind: "app" };
  if (host === appHost) return { kind: "app" };
  if (host.endsWith(".vercel.app")) return { kind: "app" };

  // Dev: fixit-galway.localhost
  if (host.endsWith(".localhost")) {
    const sub = host.slice(0, -".localhost".length);
    return SLUG.test(sub) ? { kind: "store", slug: sub } : { kind: "app" };
  }

  if (root) {
    if (host === root || host === `www.${root}` || host === `app.${root}`) return { kind: "app" };
    if (host.endsWith(`.${root}`)) {
      const sub = host.slice(0, -(root.length + 1));
      return SLUG.test(sub) ? { kind: "store", slug: sub } : { kind: "app" };
    }
  }

  return { kind: "domain", host };
}
