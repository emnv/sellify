import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, Page, PageHeader, Skeleton } from "@/components/ui";
import { getCatalog } from "@/core/catalog";
import { PRODUCT_CATEGORIES, PRODUCT_CONDITIONS } from "@/core/inventory";
import { requireShop } from "@/core/shop";
import { ProductForm } from "../product-form";

export const metadata: Metadata = { title: "Add product · Sellify" };

export default function NewProductPage() {
  return (
    <Page>
      <PageHeader title="Add product" back={{ href: "/core/inventory", label: "Inventory" }} />
      <Suspense fallback={<Card><Skeleton lines={8} /></Card>}>
        <NewProduct />
      </Suspense>
    </Page>
  );
}

async function NewProduct() {
  const [{ shop }, catalog] = await Promise.all([requireShop(), getCatalog()]);
  return (
    <ProductForm
      shopId={shop.id}
      brands={catalog.brands}
      repairTypes={catalog.repairTypes}
      categories={PRODUCT_CATEGORIES}
      conditions={PRODUCT_CONDITIONS}
    />
  );
}
