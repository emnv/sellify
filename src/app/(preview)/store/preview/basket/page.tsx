import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BasketPage } from "@/components/store/order-pages";
import { loadPreviewCtx } from "@/stores/data";

export default function PreviewBasket() {
  return (
    <Suspense>
      <Body />
    </Suspense>
  );
}

async function Body() {
  const ctx = await loadPreviewCtx();
  if (!ctx) redirect("/store");
  return <BasketPage ctx={ctx} />;
}
