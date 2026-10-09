import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OrderPage } from "@/components/store/order-pages";
import { loadPublicCtx } from "@/stores/data";

export const metadata: Metadata = { title: "Your order", robots: { index: false } };

export default function StoreOrder({ params, searchParams }: PageProps<"/s/[key]/order/[saleId]">) {
  return (
    <Suspense>
      <Body params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Body({ params, searchParams }: Pick<PageProps<"/s/[key]/order/[saleId]">, "params" | "searchParams">) {
  const [{ key, saleId }, sp] = await Promise.all([params, searchParams]);
  const ctx = await loadPublicCtx(key);
  if (!ctx) notFound();
  const sessionId = typeof sp.session_id === "string" && /^cs_[A-Za-z0-9_]{1,250}$/.test(sp.session_id) ? sp.session_id : null;
  return <OrderPage ctx={ctx} saleId={saleId} sessionId={sessionId} />;
}
