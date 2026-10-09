import type { Metadata } from "next";
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
import { listSales, SALE_CHANNELS, SALE_STATUSES, SALES_LIMIT, saleChannelLabel, saleStatusLabel, saleStatusTone } from "@/core/sales";
import { requireShop } from "@/core/shop";
import { formatDateTime } from "@/lib/datetime";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Sales · Sellify" };

const BASE = "/core/sales";

export default function SalesPage({ searchParams }: PageProps<"/core/sales">) {
  return (
    <Page>
      <PageHeader
        title="Sales"
        description="Every sale from your shop counter and your online store."
        actions={<Button href="/core/pos">Record a sale</Button>}
      />
      <Suspense fallback={<Card><Skeleton lines={6} /></Card>}>
        <SalesList searchParams={searchParams} />
      </Suspense>
    </Page>
  );
}

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

async function SalesList({ searchParams }: Pick<PageProps<"/core/sales">, "searchParams">) {
  const sp = await searchParams;
  const params = { q: one(sp.q), channel: one(sp.channel), status: one(sp.status) };
  const { shop } = await requireShop();
  const sales = await listSales(shop.id, params);
  const filtered = Boolean(params.q || params.channel || params.status);

  return (
    <Card padding="none">
      <FilterBar>
        <FilterSearch basePath={BASE} params={params} placeholder="Search customer name" />
        <FilterPills
          basePath={BASE}
          params={params}
          param="channel"
          label="Channel"
          options={[{ value: undefined, label: "All" }, ...SALE_CHANNELS.map((c) => ({ value: c.value, label: c.label }))]}
        />
        <FilterPills
          basePath={BASE}
          params={params}
          param="status"
          label="Status"
          options={[{ value: undefined, label: "Any status" }, ...SALE_STATUSES.map((s) => ({ value: s.value, label: s.label }))]}
        />
      </FilterBar>

      {sales.length === 0 && !filtered ? (
        <EmptyState
          title="No sales yet"
          description="Sales you ring up at the counter and orders from your online store show up here."
          action={<Button href="/core/pos">Record a sale</Button>}
        />
      ) : (
        <>
          <Table label="Sales">
            <THead>
              <tr>
                <Th>Date</Th>
                <Th>Customer</Th>
                <Th>Channel</Th>
                <Th align="right">Items</Th>
                <Th align="right">Total</Th>
                <Th>Status</Th>
              </tr>
            </THead>
            <TBody>
              {sales.length === 0 ? (
                <TableEmpty colSpan={6}>No sales match these filters.</TableEmpty>
              ) : (
                sales.map((s) => (
                  <Tr key={s.id}>
                    <Td nowrap>
                      <Link href={`${BASE}/${s.id}`} className="font-medium text-fg hover:underline">
                        {formatDateTime(s.created_at, shop.timezone)}
                      </Link>
                    </Td>
                    <Td>{s.customer_name ? s.customer_name : <Muted>Walk-in customer</Muted>}</Td>
                    <Td>
                      <Tag>{saleChannelLabel(s.channel)}</Tag>
                    </Td>
                    <Td align="right">{s.item_count}</Td>
                    <Td align="right" nowrap>
                      {formatMoney(s.total_cents, shop.currency)}
                    </Td>
                    <Td>
                      <StatusBadge tone={saleStatusTone(s.status)}>{saleStatusLabel(s.status)}</StatusBadge>
                    </Td>
                  </Tr>
                ))
              )}
            </TBody>
          </Table>
          <TableFooter>
            <span>
              {sales.length} {sales.length === 1 ? "sale" : "sales"}
              {sales.length === SALES_LIMIT ? ` (showing the ${SALES_LIMIT} most recent)` : ""}
            </span>
          </TableFooter>
        </>
      )}
    </Card>
  );
}
