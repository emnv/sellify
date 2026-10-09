import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductPage } from "@/components/store/pages";
import { loadPublicCtx } from "@/stores/data";

export default function StoreProduct({ params }: PageProps<"/s/[key]/shop/[productId]">) {
  return (
    <Suspense>
      <Body params={params} />
    </Suspense>
  );
}

async function Body({ params }: Pick<PageProps<"/s/[key]/shop/[productId]">, "params">) {
  const { key, productId } = await params;
  const ctx = await loadPublicCtx(key);
  if (!ctx) notFound();
  return <ProductPage ctx={ctx} id={productId} />;
}
