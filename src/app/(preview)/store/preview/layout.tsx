import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { StoreLoading, StoreShell } from "@/components/store/shell";
import { Button } from "@/components/ui";
import { loadPreviewCtx } from "@/stores/data";
import { PublishButton } from "@/app/(backend)/store/publish-button";

export const metadata: Metadata = { title: "Preview · Sellify", robots: { index: false } };

// Editor preview: the owner's DRAFT rendered with the real store components.
// Customers never see this; only the signed-in shop's members can.
export default function PreviewLayout({ children }: LayoutProps<"/store/preview">) {
  return (
    <Suspense fallback={<StoreLoading />}>
      <Frame>{children}</Frame>
    </Suspense>
  );
}

async function Frame({ children }: { children: React.ReactNode }) {
  const ctx = await loadPreviewCtx();
  if (!ctx) redirect("/store");
  return (
    <>
      <div className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2 font-sans">
        <p className="text-body text-fg">
          <span className="font-medium">Preview.</span> <span className="text-fg-muted">Customers see these changes only after you publish.</span>
        </p>
        <div className="flex items-center gap-2">
          <Button href="/store" variant="secondary" size="sm">
            Back to editor
          </Button>
          <PublishButton size="sm" />
        </div>
      </div>
      <StoreShell ctx={ctx}>{children}</StoreShell>
    </>
  );
}
