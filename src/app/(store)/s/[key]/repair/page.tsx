import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RepairPage } from "@/components/store/service-pages";
import { loadPublicCtx } from "@/stores/data";

export const metadata: Metadata = { title: "Book a repair" };

export default function StoreRepair({ params }: PageProps<"/s/[key]/repair">) {
  return (
    <Suspense>
      <Body params={params} />
    </Suspense>
  );
}

async function Body({ params }: Pick<PageProps<"/s/[key]/repair">, "params">) {
  const ctx = await loadPublicCtx((await params).key);
  if (!ctx) notFound();
  return <RepairPage ctx={ctx} />;
}
