// Every public store link is built here, so switching from path-based stores
// (/s/<slug>) to subdomains (<slug>.<root>) is one env var: STORES_ROOT_DOMAIN.
// Safe on client and server: pass rootDomain/appUrl in from the server.

export type StoreUrlEnv = { rootDomain: string; appUrl: string };

/** The live public address of a store. Custom domain wins when connected. */
export function storeUrl(slug: string, env: StoreUrlEnv, customDomain?: string | null): string {
  if (customDomain) return `https://${customDomain}`;
  if (env.rootDomain) return `https://${slug}.${env.rootDomain}`;
  return `${env.appUrl.replace(/\/$/, "")}/s/${slug}`;
}

/**
 * Path prefix for links *inside* a rendered store. "" when the store is served
 * on its own host (subdomain or custom domain), "/s/<slug>" when path-based,
 * "/store/preview" in the editor preview.
 */
export function storeBasePath(mode: "host" | "path" | "preview", slug: string): string {
  if (mode === "host") return "";
  if (mode === "preview") return "/store/preview";
  return `/s/${slug}`;
}
