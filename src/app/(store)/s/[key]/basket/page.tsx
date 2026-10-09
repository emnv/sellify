import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BasketPage } from "@/components/store/order-pages";
import { loadPublicCtx } from "@/stores/data";

export const metadata: Metadata = { title: "Basket", robots: { index: false } };

export default function StoreBasket({ params }: PageProps<"/s/[key]/basket">) {
  return (
    <Suspense>
      <Body params={params} />
    </Suspense>
  );
}

async function Body({ params }: Pick<PageProps<"/s/[key]/basket">, "params">) {
  const ctx = await loadPublicCtx((await params).key);
  if (!ctx) notFound();
  return <BasketPage ctx={ctx} />;
}
