import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SellPage } from "@/components/store/service-pages";
import { loadPreviewCtx } from "@/stores/data";

export default function PreviewSell() {
  return (
    <Suspense>
      <Body />
    </Suspense>
  );
}

async function Body() {
  const ctx = await loadPreviewCtx();
  if (!ctx) redirect("/store");
  return <SellPage ctx={ctx} />;
}
