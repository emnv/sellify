import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { conditionLabel } from "@/core/inventory-labels";
import { formatMoney } from "@/lib/money";
import { storeProduct, storeProducts } from "@/stores/data";
import { AddToBasket } from "./add-to-basket";
import { storeHref, type StoreCtx } from "./context";
import { ProductGrid, StoreHome, stockLabel } from "./sections";
import { Section, StoreBadge } from "./ui";

// Page bodies shared by the public store (/s/<key>/…) and the editor preview.

export async function HomePage({ ctx }: { ctx: StoreCtx }) {
  const products = ctx.config.content.tabs.shop ? await storeProducts(ctx) : [];
  return <StoreHome ctx={ctx} products={products.filter((p) => p.stock_qty > 0)} />;
}

export async function ShopPage({ ctx }: { ctx: StoreCtx }) {
  if (!ctx.config.content.tabs.shop) notFound();
  const products = await storeProducts(ctx);
  return (
    <Section title="Shop" subtitle="Prices and stock are live from our shop.">
      {products.length ? (
        <ProductGrid ctx={ctx} products={products} />
      ) : (
        <p className="text-store-muted">Nothing for sale online right now. Pop in to the shop or check back soon.</p>
      )}
    </Section>
  );
}

export async function ProductPage({ ctx, id }: { ctx: StoreCtx; id: string }) {
  if (!ctx.config.content.tabs.shop) notFound();
  const product = await storeProduct(ctx, id);
  if (!product) notFound();
  const label = stockLabel(product.stock_qty);
  const condition = conditionLabel(product.condition);

  return (
    <Section>
      <Link href={storeHref(ctx, "/shop")} className="mb-6 inline-block text-store-sm font-semibold text-store-muted hover:text-store-primary">
        ← All products
      </Link>
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <div className="relative aspect-square overflow-hidden rounded-store-card border border-store-border bg-store-surface">
            {product.images[0] ? (
              <Image src={product.images[0]} alt={product.name} fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center text-store-muted">No photo</div>
            )}
          </div>
          {product.images.length > 1 ? (
            <div className="grid grid-cols-4 gap-3">
              {product.images.slice(1, 5).map((src, i) => (
                <div key={src} className="relative aspect-square overflow-hidden rounded-store border border-store-border">
                  <Image src={src} alt={`${product.name}, photo ${i + 2}`} fill sizes="120px" className="object-cover" />
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              {condition ? <StoreBadge tone="muted">{condition}</StoreBadge> : null}
              {label ? <StoreBadge tone={label.tone}>{label.text}</StoreBadge> : product.stock_qty > 0 ? <StoreBadge tone="muted">In stock</StoreBadge> : null}
            </div>
            <h1 className="font-store-heading text-store-3xl font-bold tracking-tight">{product.name}</h1>
            <p className="text-store-2xl font-semibold">{formatMoney(product.price_cents, ctx.currency)}</p>
          </div>
          <AddToBasket storeKey={ctx.storeKey} productId={product.id} stock={product.stock_qty} basketHref={storeHref(ctx, "/basket")} disabled={ctx.preview} />
          {product.description ? <p className="whitespace-pre-line text-store-muted">{product.description}</p> : null}
        </div>
      </div>
    </Section>
  );
}
