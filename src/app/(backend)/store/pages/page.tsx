import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, Page, Skeleton } from "@/components/ui";
import { requireOwnerStore } from "@/stores/store";
import { StoreHeader } from "../store-header";
import { PagesForm } from "./pages-form";

export const metadata: Metadata = { title: "Pages · Online store · Sellify" };

export default function StorePagesPage() {
  return (
    <Page>
      <StoreHeader />
      <Suspense fallback={<Card><Skeleton lines={4} /></Card>}>
        <Pages />
      </Suspense>
    </Page>
  );
}

async function Pages() {
  const store = await requireOwnerStore();
  return <PagesForm tabs={store.draft.content.tabs} />;
}
