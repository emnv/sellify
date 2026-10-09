import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, DetailList, Notice, Page, Skeleton, StatusBadge, TextLink } from "@/components/ui";
import { requireShop } from "@/core/shop";
import { formatDateTime } from "@/lib/datetime";
import { getOwnerStore, suggestSlug, urlEnv } from "@/stores/store";
import { storeUrl } from "@/stores/urls";
import { CreateStoreForm, GeneralForm } from "./general-forms";
import { UnpublishButton } from "./publish-button";
import { StoreHeader } from "./store-header";

export const metadata: Metadata = { title: "Online store · Sellify" };

export default function StoreGeneralPage({ searchParams }: PageProps<"/store">) {
  return (
    <Page>
      <Suspense fallback={<Card><Skeleton lines={6} /></Card>}>
        <General searchParams={searchParams} />
      </Suspense>
    </Page>
  );
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function General({ searchParams }: Pick<PageProps<"/store">, "searchParams">) {
  const sp = await searchParams;
  const { shop } = await requireShop();
  const store = await getOwnerStore();

  if (!store) {
    const slug = suggestSlug(shop.name);
    return (
      <>
        <StoreHeader hasStore={false} />
        <Card title="Create your online store" description="Pick your store's web address. You can change everything else afterwards.">
          <CreateStoreForm defaultSlug={slug} exampleUrl={storeUrl("your-address", urlEnv())} />
        </Card>
      </>
    );
  }

  const live = store.row.is_published;
  const publishError = one(sp.publishError);
  return (
    <>
      <StoreHeader />
      {one(sp.created) ? <Notice tone="success" title="Your store is ready to set up.">Add your logo and details, check the preview, then publish.</Notice> : null}
      {one(sp.published) ? <Notice tone="success" title="Your store is live.">Customers can now visit {store.liveUrl}.</Notice> : null}
      {one(sp.unpublished) ? <Notice tone="info">Your store is offline. Customers see a “not found” page until you publish again.</Notice> : null}
      {publishError ? <Notice tone="danger">{publishError}</Notice> : null}

      <Card
        title="Status"
        actions={live ? <UnpublishButton /> : null}
      >
        <DetailList
          items={[
            { label: "Store", value: live ? <StatusBadge tone="success">Live</StatusBadge> : <StatusBadge tone="neutral">Offline</StatusBadge> },
            {
              label: "Web address",
              value: live ? <TextLink href={store.liveUrl}>{store.liveUrl}</TextLink> : <span className="text-fg-muted">{store.liveUrl} (after you publish)</span>,
            },
            { label: "Last published", value: store.row.published_at ? formatDateTime(store.row.published_at, shop.timezone) : "Never" },
            {
              label: "Draft",
              value: store.hasUnpublishedChanges ? <StatusBadge tone="warning">Unpublished changes</StatusBadge> : <StatusBadge tone="success">Up to date</StatusBadge>,
            },
          ]}
        />
      </Card>

      <GeneralForm
        shopId={shop.id}
        slug={store.row.slug}
        storeName={store.draft.content.storeName}
        tagline={store.draft.content.tagline}
        logoUrl={store.draft.content.logoUrl}
        addressPreview={storeUrl("ADDRESS", urlEnv())}
      />
    </>
  );
}
