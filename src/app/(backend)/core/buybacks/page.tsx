import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  Card,
  EmptyState,
  FilterBar,
  FilterPills,
  FilterSearch,
  Muted,
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
import {
  BUYBACK_LIST_LIMIT,
  BUYBACK_SOURCES,
  BUYBACK_STATUSES,
  buybackSourceLabel,
  buybackStatus,
  conditionSummary,
  countBuybacksByStatus,
  listBuybacks,
} from "@/core/buybacks";
import { storageLabel } from "@/core/catalog";
import { requireShop } from "@/core/shop";
import { formatDateTime } from "@/lib/datetime";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Buybacks · Sellify" };

const BASE = "/core/buybacks";

export default function BuybacksPage({ searchParams }: PageProps<"/core/buybacks">) {
  return (
    <Page>
      <PageHeader title="Buybacks" description="Phones customers have agreed to sell to you. Update the status as they come in and get paid." />
      <Suspense fallback={<Card><Skeleton lines={6} /></Card>}>
        <BuybackList searchParams={searchParams} />
      </Suspense>
    </Page>
  );
}

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

async function BuybackList({ searchParams }: Pick<PageProps<"/core/buybacks">, "searchParams">) {
  const sp = await searchParams;
  const params = { q: one(sp.q), status: one(sp.status), source: one(sp.source) };
  const { shop } = await requireShop();
  const [buybacks, counts] = await Promise.all([listBuybacks(shop.id, params), countBuybacksByStatus(shop.id)]);
  const filtered = Boolean(params.q || params.status || params.source);

  return (
    <Card padding="none">
      <FilterBar>
        <FilterSearch basePath={BASE} params={params} placeholder="Search customer or device" />
        <FilterPills
          basePath={BASE}
          params={params}
          param="status"
          label="Status"
          options={[
            { value: undefined, label: "All", count: counts.all ?? 0 },
            ...BUYBACK_STATUSES.map((s) => ({ value: s.value, label: s.label, count: counts[s.value] ?? 0 })),
          ]}
        />
        <FilterPills
          basePath={BASE}
          params={params}
          param="source"
          label="Source"
          options={BUYBACK_SOURCES.map((s) => ({ value: s.value, label: s.label }))}
        />
      </FilterBar>

      {buybacks.length === 0 && !filtered ? (
        <EmptyState
          title="No buybacks yet"
          description="When a customer accepts an offer on the Sell tab of your online store, the buyback shows up here so you can expect the phone."
        />
      ) : (
        <>
          <Table label="Buybacks">
            <THead>
              <tr>
                <Th>Date</Th>
                <Th>Customer</Th>
                <Th>Device</Th>
                <Th>Condition</Th>
                <Th align="right">Offer</Th>
                <Th>Source</Th>
                <Th>Status</Th>
              </tr>
            </THead>
            <TBody>
              {buybacks.length === 0 ? (
                <TableEmpty colSpan={7}>No buybacks match these filters.</TableEmpty>
              ) : (
                buybacks.map((b) => {
                  const status = buybackStatus(b.status);
                  return (
                    <Tr key={b.id}>
                      <Td nowrap>
                        <Link href={`${BASE}/${b.id}`} className="font-medium text-fg hover:underline">
                          {formatDateTime(b.created_at, shop.timezone)}
                        </Link>
                      </Td>
                      <Td>
                        <div className="flex min-w-0 flex-col">
                          <span>{b.customer_name}</span>
                          {b.customer_phone ? <Muted>{b.customer_phone}</Muted> : null}
                        </div>
                      </Td>
                      <Td>
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`${BASE}/${b.id}`} className="font-medium text-fg hover:underline">
                            {b.device_label}
                          </Link>
                          {b.storage_gb ? <Tag>{storageLabel(b.storage_gb)}</Tag> : null}
                        </div>
                      </Td>
                      <Td>
                        <Muted>{conditionSummary(b.answers)}</Muted>
                      </Td>
                      <Td align="right" nowrap>
                        {formatMoney(b.offer_cents, shop.currency)}
                      </Td>
                      <Td>
                        <Tag>{buybackSourceLabel(b.source)}</Tag>
                      </Td>
                      <Td>
                        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                      </Td>
                    </Tr>
                  );
                })
              )}
            </TBody>
          </Table>
          <TableFooter>
            <span>
              {buybacks.length} {buybacks.length === 1 ? "buyback" : "buybacks"}
              {buybacks.length === BUYBACK_LIST_LIMIT ? ` (showing the ${BUYBACK_LIST_LIMIT} most recent)` : ""}
            </span>
          </TableFooter>
        </>
      )}
    </Card>
  );
}
