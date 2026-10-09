import type { StoreConfig } from "@/lib/store/config";

/** Everything a store page needs to render, passed down explicitly. */
export type StoreCtx = {
  config: StoreConfig;
  /** Link prefix inside the store: "" (own host), "/s/<slug>", or "/store/preview". */
  base: string;
  /** Key the public API resolves the store by (slug or custom domain). */
  storeKey: string;
  currency: string;
  timezone: string;
  /** Editor preview: forms render but do not submit. */
  preview: boolean;
};

export function storeHref(ctx: Pick<StoreCtx, "base">, path = "/") {
  const p = path === "/" ? "" : path;
  return `${ctx.base}${p}` || "/";
}
