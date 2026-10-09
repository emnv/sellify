import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Card, Page, PageHeader, Skeleton } from "@/components/ui";
import { getCatalog } from "@/core/catalog";
import { getProduct, PRODUCT_CATEGORIES, PRODUCT_CONDITIONS } from "@/core/inventory";
import { requireShop } from "@/core/shop";
import { ProductForm } from "../product-form";
import { DeleteProduct } from "./delete-product";

export const metadata: Metadata = { title: "Edit product · Sellify" };

export default function EditProductPage({ params }: PageProps<"/core/inventory/[id]">) {
  return (
    <Suspense
      fallback={
        <Page>
          <PageHeader title="Edit product" back={{ href: "/core/inventory", label: "Inventory" }} />
          <Card><Skeleton lines={8} /></Card>
        </Page>
      }
    >
      <EditProduct params={params} />
    </Suspense>
  );
}

async function EditProduct({ params }: Pick<PageProps<"/core/inventory/[id]">, "params">) {
  const { id } = await params;
  const [{ shop }, catalog] = await Promise.all([requireShop(), getCatalog()]);
  const product = await getProduct(shop.id, id);
  if (!product) notFound();

  return (
    <Page>
      <PageHeader
        title={product.name}
        description="Edit details, price, stock and photos."
        back={{ href: "/core/inventory", label: "Inventory" }}
        actions={<DeleteProduct id={product.id} name={product.name} />}
      />
      <ProductForm
        shopId={shop.id}
        product={product}
        brands={catalog.brands}
        repairTypes={catalog.repairTypes}
        categories={PRODUCT_CATEGORIES}
        conditions={PRODUCT_CONDITIONS}
      />
    </Page>
  );
}
