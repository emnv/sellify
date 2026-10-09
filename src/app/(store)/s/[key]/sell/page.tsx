import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SellPage } from "@/components/store/service-pages";
import { loadPublicCtx } from "@/stores/data";

export const metadata: Metadata = { title: "Sell your phone" };

export default function StoreSell({ params }: PageProps<"/s/[key]/sell">) {
  return (
    <Suspense>
      <Body params={params} />
    </Suspense>
  );
}

async function Body({ params }: Pick<PageProps<"/s/[key]/sell">, "params">) {
  const ctx = await loadPublicCtx((await params).key);
  if (!ctx) notFound();
  return <SellPage ctx={ctx} />;
}
