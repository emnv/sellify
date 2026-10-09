import type { Metadata } from "next";
import { Suspense } from "react";
import { Button, Card, EmptyState, Grid, Page, PageHeader, Skeleton } from "@/components/ui";
import { categoryLabel } from "@/core/inventory";
import { listSellableProducts } from "@/core/sales";
import { requireShop } from "@/core/shop";
import { PointOfSale } from "./point-of-sale";

export const metadata: Metadata = { title: "Point of sale · Sellify" };

export default function PosPage() {
  return (
    <Page>
      <PageHeader title="Point of sale" description="Ring up an in-shop sale. Stock comes off your inventory straight away." />
      <Suspense
        fallback={
          <Grid>
            <Card><Skeleton lines={8} /></Card>
            <Card><Skeleton lines={5} /></Card>
          </Grid>
        }
      >
        <PosContent />
      </Suspense>
    </Page>
  );
}

async function PosContent() {
  const { shop } = await requireShop();
  const products = await listSellableProducts(shop.id);

  if (products.length === 0) {
    return (
      <Card>
        <EmptyState
          title="Nothing in stock to sell"
          description="Products with stock show up here. Add products or update stock in your inventory."
          action={<Button href="/core/inventory">Go to inventory</Button>}
        />
      </Card>
    );
  }

  return (
    <PointOfSale
      products={products.map((p) => ({ ...p, category: categoryLabel(p.category) }))}
      currency={shop.currency}
    />
  );
}
