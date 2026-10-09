import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { StoreLoading, StoreShell } from "@/components/store/shell";
import { loadPublicCtx } from "@/stores/data";

// Public store. Reached at /s/<slug>, or on <slug>.<root> / a custom domain
// (proxy.ts rewrites those here). Unpublished or unknown stores → 404.

export async function generateMetadata({ params }: LayoutProps<"/s/[key]">): Promise<Metadata> {
  const { key } = await params;
  const ctx = await loadPublicCtx(key);
  if (!ctx) return { title: "Store not found" };
  const { storeName, tagline, logoUrl } = ctx.config.content;
  return { title: { default: storeName, template: `%s · ${storeName}` }, description: tagline, icons: logoUrl ? { icon: logoUrl } : undefined };
}

export default function PublicStoreLayout({ children, params }: LayoutProps<"/s/[key]">) {
  return (
    <Suspense fallback={<StoreLoading />}>
      <Frame params={params}>{children}</Frame>
    </Suspense>
  );
}

async function Frame({ params, children }: Pick<LayoutProps<"/s/[key]">, "params" | "children">) {
  const { key } = await params;
  const ctx = await loadPublicCtx(key);
  if (!ctx) notFound();
  return <StoreShell ctx={ctx}>{children}</StoreShell>;
}
