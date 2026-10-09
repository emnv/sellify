import type { Metadata } from "next";
import { Suspense } from "react";
import {
  Card,
  EmptyState,
  FilterBar,
  FilterPills,
  FilterSearch,
  HiddenField,
  Page,
  PageHeader,
  Skeleton,
  SubmitButton,
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
import { brandSlug, computeOffer, filterBuybackPrices, getBuybackSettings, listBuybackPrices } from "@/core/buybacks";
import { getCatalog, storageLabel } from "@/core/catalog";
import { requireShop } from "@/core/shop";
import { formatMoney } from "@/lib/money";
import { removeBuybackPrice } from "./actions";
import { DeductionsForm } from "./deductions-form";
import { BuybackPriceForm, type PriceFormBrand } from "./price-form";

export const metadata: Metadata = { title: "Buyback prices · Sellify" };

const BASE = "/core/buyback-prices";

export default function BuybackPricesPage({ searchParams }: PageProps<"/core/buyback-prices">) {
  return (
    <Page>
      <PageHeader
        title="Buyback prices"
        description="What you pay for used phones. The Sell tab of your online store quotes customers from these prices."
      />
      <Suspense fallback={<Card><Skeleton lines={6} /></Card>}>
        <BuybackPrices searchParams={searchParams} />
      </Suspense>
    </Page>
  );
}

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

async function BuybackPrices({ searchParams }: Pick<PageProps<"/core/buyback-prices">, "searchParams">) {
  const sp = await searchParams;
  const params = { q: one(sp.q), brand: one(sp.brand) };
  const [{ shop }, catalog] = await Promise.all([requireShop(), getCatalog()]);
  const [settings, allPrices] = await Promise.all([getBuybackSettings(shop.id), listBuybackPrices(shop.id, catalog)]);
  const prices = filterBuybackPrices(allPrices, params);
  const filtered = Boolean(params.q || params.brand);

  const formBrands: PriceFormBrand[] = catalog.brands.map((b) => ({
    id: b.id,
    name: b.name,
    models: b.models.map((m) => ({ id: m.id, name: m.name, storage: m.storageOptions.map((gb) => ({ gb, label: storageLabel(gb) })) })),
  }));

  const brandCounts: Record<string, number> = {};
  for (const p of allPrices) brandCounts[p.brandName] = (brandCounts[p.brandName] ?? 0) + 1;
  const crackedAnswers = { screenCracked: true, batteryOk: true, turnsOn: true };

  return (
    <>
      <DeductionsForm defaults={settings} />
      <BuybackPriceForm brands={formBrands} />

      <Card padding="none">
        {allPrices.length === 0 ? (
          <EmptyState
            title="No buyback prices yet"
            description="Add what you pay for each model and storage size. Customers can only get an online offer for phones that have a price."
          />
        ) : (
          <>
            <FilterBar>
              <FilterSearch basePath={BASE} params={params} placeholder="Search model" />
              <FilterPills
                basePath={BASE}
                params={params}
                param="brand"
                label="Brand"
                options={[
                  { value: undefined, label: "All", count: allPrices.length },
                  ...catalog.brands
                    .filter((b) => brandCounts[b.name])
                    .map((b) => ({ value: brandSlug(b.name), label: b.name, count: brandCounts[b.name] })),
                ]}
              />
            </FilterBar>
            <Table label="Buyback prices">
              <THead>
                <tr>
                  <Th>Model</Th>
                  <Th>Storage</Th>
                  <Th align="right">Base price</Th>
                  <Th align="right">Offer with cracked screen</Th>
                  <Th srOnly>Actions</Th>
                </tr>
              </THead>
              <TBody>
                {prices.length === 0 ? (
                  <TableEmpty colSpan={5}>No prices match these filters.</TableEmpty>
                ) : (
                  prices.map((p) => (
                    <Tr key={p.id}>
                      <Td>
                        <span className="font-medium">{p.modelLabel}</span>
                      </Td>
                      <Td>
                        <Tag>{storageLabel(p.storage_gb)}</Tag>
                      </Td>
                      <Td align="right" nowrap>
                        {formatMoney(p.base_price_cents, shop.currency)}
                      </Td>
                      <Td align="right" nowrap>
                        {formatMoney(computeOffer(p.base_price_cents, crackedAnswers, settings), shop.currency)}
                      </Td>
                      <Td align="right">
                        <form action={removeBuybackPrice}>
                          <HiddenField name="id" value={p.id} />
                          <SubmitButton variant="ghost" size="sm" pendingText="Removing…">
                            Remove
                          </SubmitButton>
                        </form>
                      </Td>
                    </Tr>
                  ))
                )}
              </TBody>
            </Table>
            <TableFooter>
              <span>
                {filtered ? `${prices.length} of ${allPrices.length}` : allPrices.length} {allPrices.length === 1 ? "price" : "prices"}
              </span>
            </TableFooter>
          </>
        )}
      </Card>
    </>
  );
}
