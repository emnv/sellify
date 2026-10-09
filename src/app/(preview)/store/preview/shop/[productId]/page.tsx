import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ProductPage } from "@/components/store/pages";
import { loadPreviewCtx } from "@/stores/data";

export default function PreviewProduct({ params }: PageProps<"/store/preview/shop/[productId]">) {
  return (
    <Suspense>
      <Body params={params} />
    </Suspense>
  );
}

async function Body({ params }: Pick<PageProps<"/store/preview/shop/[productId]">, "params">) {
  const ctx = await loadPreviewCtx();
  if (!ctx) redirect("/store");
  return <ProductPage ctx={ctx} id={(await params).productId} />;
}
