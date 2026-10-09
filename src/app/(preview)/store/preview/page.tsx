import { redirect } from "next/navigation";
import { Suspense } from "react";
import { HomePage } from "@/components/store/pages";
import { loadPreviewCtx } from "@/stores/data";

export default function PreviewHome() {
  return (
    <Suspense>
      <Body />
    </Suspense>
  );
}

async function Body() {
  const ctx = await loadPreviewCtx();
  if (!ctx) redirect("/store");
  return <HomePage ctx={ctx} />;
}
