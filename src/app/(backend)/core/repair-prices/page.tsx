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
  StatusBadge,
  SubmitButton,
  Table,
  TableEmpty,
  TableFooter,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from "@/components/ui";
import { getCatalog } from "@/core/catalog";
import { countRepairPrices, formatDuration, listRepairPrices, partsInStock, SLOT_CAPACITY_MAX } from "@/core/repairs";
import { requireShop } from "@/core/shop";
import { formatMoney } from "@/lib/money";
import { removeRepairPrice } from "./actions";
import { RepairPriceForm } from "./repair-price-form";
import { SlotCapacityForm } from "./slot-capacity-form";

export const metadata: Metadata = { title: "Repair prices · Sellify" };

const BASE = "/core/repair-prices";

export default function RepairPricesPage({ searchParams }: PageProps<"/core/repair-prices">) {
  return (
    <Page>
      <PageHeader title="Repair prices" description="What you charge per model and repair. Your online store's Repair tab shows these prices." />
      <Suspense
        fallback={
          <>
            <Card><Skeleton lines={4} /></Card>
            <Card><Skeleton lines={6} /></Card>
          </>
        }
      >
        <RepairPrices searchParams={searchParams} />
      </Suspense>
    </Page>
  );
}

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

async function RepairPrices({ searchParams }: Pick<PageProps<"/core/repair-prices">, "searchParams">) {
  const sp = await searchParams;
  const params = { q: one(sp.q), brand: one(sp.brand) };
  const [{ shop }, catalog] = await Promise.all([requireShop(), getCatalog()]);
  const [prices, total, parts] = await Promise.all([
    listRepairPrices(shop.id, catalog, params),
    countRepairPrices(shop.id),
    partsInStock(shop.id),
  ]);
  const repairName = new Map(catalog.repairTypes.map((r) => [r.id, r.name]));

  return (
    <>
      <RepairPriceForm brands={catalog.brands} repairTypes={catalog.repairTypes} />
      <SlotCapacityForm capacity={shop.repair_slot_capacity} max={SLOT_CAPACITY_MAX} />

      <Card padding="none">
        {total === 0 ? (
          <EmptyState
            title="No repair prices yet"
            description="Add a price for each model and repair you offer. Your online store's Repair tab uses them to show prices and take bookings."
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
                options={[{ value: undefined, label: "All" }, ...catalog.brands.map((b) => ({ value: String(b.id), label: b.name }))]}
              />
            </FilterBar>
            <Table label="Repair prices">
              <THead>
                <tr>
                  <Th>Model</Th>
                  <Th>Repair</Th>
                  <Th align="right">Price</Th>
                  <Th align="right">Time</Th>
                  <Th>Part</Th>
                  <Th srOnly>Actions</Th>
                </tr>
              </THead>
              <TBody>
                {prices.length === 0 ? (
                  <TableEmpty colSpan={6}>No repair prices match these filters.</TableEmpty>
                ) : (
                  prices.map((p) => (
                    <Tr key={p.id}>
                      <Td>
                        <span className="font-medium">{catalog.modelLabels[p.model_id] ?? "Unknown model"}</span>
                      </Td>
                      <Td>{repairName.get(p.repair_type_id) ?? "Unknown repair"}</Td>
                      <Td align="right" nowrap>
                        {formatMoney(p.price_cents, shop.currency)}
                      </Td>
                      <Td align="right" nowrap>
                        {formatDuration(p.duration_min)}
                      </Td>
                      <Td>
                        {parts.has(`${p.model_id}:${p.repair_type_id}`) ? (
                          <StatusBadge tone="success">Part in stock</StatusBadge>
                        ) : (
                          <StatusBadge tone="neutral">No part in stock</StatusBadge>
                        )}
                      </Td>
                      <Td align="right">
                        <form action={removeRepairPrice}>
                          <HiddenField name="id" value={p.id} />
                          <SubmitButton variant="ghost" size="sm" pendingText="Removing…">
                            Remove price
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
                {prices.length === total
                  ? `${total} ${total === 1 ? "price" : "prices"}`
                  : `${prices.length} of ${total} prices`}
              </span>
            </TableFooter>
          </>
        )}
      </Card>
    </>
  );
}
