import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ShopPage } from "@/components/store/pages";
import { loadPreviewCtx } from "@/stores/data";

export default function PreviewShop() {
  return (
    <Suspense>
      <Body />
    </Suspense>
  );
}

async function Body() {
  const ctx = await loadPreviewCtx();
  if (!ctx) redirect("/store");
  return <ShopPage ctx={ctx} />;
}
