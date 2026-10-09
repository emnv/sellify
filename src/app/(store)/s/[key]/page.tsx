import { notFound } from "next/navigation";
import { Suspense } from "react";
import { HomePage } from "@/components/store/pages";
import { loadPublicCtx } from "@/stores/data";

export default function StoreHome({ params }: PageProps<"/s/[key]">) {
  return (
    <Suspense>
      <Body params={params} />
    </Suspense>
  );
}

async function Body({ params }: Pick<PageProps<"/s/[key]">, "params">) {
  const ctx = await loadPublicCtx((await params).key);
  if (!ctx) notFound();
  return <HomePage ctx={ctx} />;
}
