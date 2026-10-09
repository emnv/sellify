import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import {
  Button,
  Card,
  EmptyState,
  FilterBar,
  FilterPills,
  FilterSearch,
  Muted,
  Notice,
  Page,
  PageHeader,
  Skeleton,
  StatusBadge,
  Table,
  TableEmpty,
  TableFooter,
  Tag,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from "@/components/ui";
import { categoryLabel, conditionLabel, countProductsByCategory, listProducts, LOW_STOCK, PRODUCT_CATEGORIES } from "@/core/inventory";
import { requireShop } from "@/core/shop";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Inventory · Sellify" };

const BASE = "/core/inventory";

export default function InventoryPage({ searchParams }: PageProps<"/core/inventory">) {
  return (
    <Page>
      <PageHeader
        title="Inventory"
        description="Phones, accessories and repair parts. Stock here is what your POS and online store sell."
        actions={<Button href="/core/inventory/new">Add product</Button>}
      />
      <Suspense fallback={<Card><Skeleton lines={6} /></Card>}>
        <InventoryList searchParams={searchParams} />
      </Suspense>
    </Page>
  );
}

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

async function InventoryList({ searchParams }: Pick<PageProps<"/core/inventory">, "searchParams">) {
  const sp = await searchParams;
  const params = { q: one(sp.q), category: one(sp.category), online: one(sp.online) };
  const { shop } = await requireShop();
  const [products, counts] = await Promise.all([listProducts(shop.id, params), countProductsByCategory(shop.id)]);
  const filtered = Boolean(params.q || params.category || params.online);

  return (
    <>
      {one(sp.saved) ? <Notice tone="success">Product saved.</Notice> : null}
      {one(sp.deleted) ? <Notice tone="success">Product deleted.</Notice> : null}
      <Card padding="none">
        <FilterBar>
          <FilterSearch basePath={BASE} params={params} placeholder="Search name or SKU" />
          <FilterPills
            basePath={BASE}
            params={params}
            param="category"
            label="Category"
            options={[
              { value: undefined, label: "All", count: counts.all ?? 0 },
              ...PRODUCT_CATEGORIES.map((c) => ({ value: c.value, label: c.label, count: counts[c.value] ?? 0 })),
            ]}
          />
          <FilterPills
            basePath={BASE}
            params={params}
            param="online"
            label="Online store"
            options={[
              { value: "visible", label: "Shown online" },
              { value: "hidden", label: "Hidden online" },
            ]}
          />
        </FilterBar>

        {products.length === 0 && !filtered ? (
          <EmptyState
            title="No products yet"
            description="Add your phones, accessories and parts. They appear in your POS and, if you choose, your online store."
            action={<Button href="/core/inventory/new">Add product</Button>}
          />
        ) : (
          <>
            <Table label="Products">
              <THead>
                <tr>
                  <Th>Product</Th>
                  <Th>Category</Th>
                  <Th align="right">Price</Th>
                  <Th align="right">Stock</Th>
                  <Th>Online</Th>
                  <Th srOnly>Actions</Th>
                </tr>
              </THead>
              <TBody>
                {products.length === 0 ? (
                  <TableEmpty colSpan={6}>No products match these filters.</TableEmpty>
                ) : (
                  products.map((p) => (
                    <Tr key={p.id}>
                      <Td>
                        <div className="flex items-center gap-3">
                          <div className="relative size-10 shrink-0 overflow-hidden rounded-md border border-border bg-surface-muted">
                            {p.images[0] ? <Image src={p.images[0]} alt="" fill sizes="40px" className="object-cover" /> : null}
                          </div>
                          <div className="flex min-w-0 flex-col">
                            <Link href={`${BASE}/${p.id}`} className="truncate font-medium text-fg hover:underline">
                              {p.name}
                            </Link>
                            <Muted>{[conditionLabel(p.condition), p.sku].filter(Boolean).join(" · ") || "—"}</Muted>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <Tag>{categoryLabel(p.category)}</Tag>
                      </Td>
                      <Td align="right" nowrap>
                        {formatMoney(p.price_cents, shop.currency)}
                      </Td>
                      <Td align="right" nowrap>
                        {p.stock_qty === 0 ? (
                          <StatusBadge tone="danger">Sold out</StatusBadge>
                        ) : p.stock_qty <= LOW_STOCK ? (
                          <StatusBadge tone="warning">{p.stock_qty} left</StatusBadge>
                        ) : (
                          p.stock_qty
                        )}
                      </Td>
                      <Td>
                        {p.visible_online ? <StatusBadge tone="success">Shown</StatusBadge> : <StatusBadge tone="neutral">Hidden</StatusBadge>}
                      </Td>
                      <Td align="right">
                        <Button href={`${BASE}/${p.id}`} variant="ghost" size="sm">
                          Edit
                        </Button>
                      </Td>
                    </Tr>
                  ))
                )}
              </TBody>
            </Table>
            <TableFooter>
              <span>
                {products.length} {products.length === 1 ? "product" : "products"}
                {products.length === 200 ? " (showing the 200 most recently updated)" : ""}
              </span>
            </TableFooter>
          </>
        )}
      </Card>
    </>
  );
}
