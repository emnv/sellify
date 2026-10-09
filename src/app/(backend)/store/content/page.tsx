import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, Page, Skeleton } from "@/components/ui";
import { requireShop } from "@/core/shop";
import { DAY_LABELS, DAYS } from "@/lib/store/config";
import { requireOwnerStore } from "@/stores/store";
import { StoreHeader } from "../store-header";
import { ContentForm } from "./content-form";

export const metadata: Metadata = { title: "Content · Online store · Sellify" };

export default function StoreContentPage() {
  return (
    <Page>
      <StoreHeader />
      <Suspense fallback={<Card><Skeleton lines={10} /></Card>}>
        <Content />
      </Suspense>
    </Page>
  );
}

async function Content() {
  const [{ shop }, store] = await Promise.all([requireShop(), requireOwnerStore()]);
  return <ContentForm shopId={shop.id} content={store.draft.content} days={DAYS.map((d) => ({ key: d, label: DAY_LABELS[d] }))} />;
}
