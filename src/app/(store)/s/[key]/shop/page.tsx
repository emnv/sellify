import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ShopPage } from "@/components/store/pages";
import { loadPublicCtx } from "@/stores/data";

export const metadata: Metadata = { title: "Shop" };

export default function StoreShop({ params }: PageProps<"/s/[key]/shop">) {
  return (
    <Suspense>
      <Body params={params} />
    </Suspense>
  );
}

async function Body({ params }: Pick<PageProps<"/s/[key]/shop">, "params">) {
  const ctx = await loadPublicCtx((await params).key);
  if (!ctx) notFound();
  return <ShopPage ctx={ctx} />;
}
