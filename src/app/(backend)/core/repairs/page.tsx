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
import {
  countRepairTicketsByStatus,
  listRepairTickets,
  REPAIR_SOURCES,
  REPAIR_STATUSES,
  repairSourceLabel,
  repairStatus,
  TICKET_LIMIT,
  TICKET_WHEN,
} from "@/core/repairs";
import { requireShop } from "@/core/shop";
import { formatDateTime } from "@/lib/datetime";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Repair tickets · Sellify" };

const BASE = "/core/repairs";

export default function RepairTicketsPage({ searchParams }: PageProps<"/core/repairs">) {
  return (
    <Page>
      <PageHeader
        title="Repair tickets"
        description="Repairs booked in your online store and walk-ins at the counter."
        actions={<Button href="/core/repairs/new">New ticket</Button>}
      />
      <Suspense fallback={<Card><Skeleton lines={6} /></Card>}>
        <TicketList searchParams={searchParams} />
      </Suspense>
    </Page>
  );
}

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

async function TicketList({ searchParams }: Pick<PageProps<"/core/repairs">, "searchParams">) {
  const sp = await searchParams;
  const params = { q: one(sp.q), status: one(sp.status), source: one(sp.source), when: one(sp.when) };
  const { shop } = await requireShop();
  const [tickets, counts] = await Promise.all([listRepairTickets(shop.id, params), countRepairTicketsByStatus(shop.id)]);
  const filtered = Boolean(params.q || params.status || params.source || params.when);

  return (
    <Card padding="none">
      <FilterBar>
        <FilterSearch basePath={BASE} params={params} placeholder="Search customer or device" />
        <FilterPills
          basePath={BASE}
          params={params}
          param="when"
          label="When"
          options={[{ value: undefined, label: "All" }, ...TICKET_WHEN.map((w) => ({ value: w.value, label: w.label }))]}
        />
        <FilterPills
          basePath={BASE}
          params={params}
          param="status"
          label="Status"
          options={[
            { value: undefined, label: "All", count: counts.all ?? 0 },
            ...REPAIR_STATUSES.map((s) => ({ value: s.value, label: s.label, count: counts[s.value] ?? 0 })),
          ]}
        />
        <FilterPills
          basePath={BASE}
          params={params}
          param="source"
          label="Source"
          options={[{ value: undefined, label: "All sources" }, ...REPAIR_SOURCES.map((s) => ({ value: s.value, label: s.label }))]}
        />
      </FilterBar>

      {tickets.length === 0 && !filtered ? (
        <EmptyState
          title="No repair tickets yet"
          description="Repairs booked in your online store appear here. Add walk-in customers yourself so every repair is in one list."
          action={<Button href="/core/repairs/new">New ticket</Button>}
        />
      ) : (
        <>
          <Table label="Repair tickets">
            <THead>
              <tr>
                <Th>When</Th>
                <Th>Customer</Th>
                <Th>Device</Th>
                <Th align="right">Quote</Th>
                <Th>Source</Th>
                <Th>Status</Th>
              </tr>
            </THead>
            <TBody>
              {tickets.length === 0 ? (
                <TableEmpty colSpan={6}>No tickets match these filters.</TableEmpty>
              ) : (
                tickets.map((t) => {
                  const status = repairStatus(t.status);
                  return (
                    <Tr key={t.id}>
                      <Td nowrap>
                        <Link href={`${BASE}/${t.id}`} className="font-medium text-fg hover:underline">
                          {t.scheduled_at ? formatDateTime(t.scheduled_at, shop.timezone) : "Not scheduled"}
                        </Link>
                      </Td>
                      <Td>
                        <div className="flex min-w-0 flex-col">
                          <span>{t.customer_name}</span>
                          {t.customer_phone ? <Muted>{t.customer_phone}</Muted> : null}
                        </div>
                      </Td>
                      <Td>
                        <div className="flex min-w-0 flex-col">
                          <span>{t.device_label}</span>
                          <Muted>{t.repair_label}</Muted>
                        </div>
                      </Td>
                      <Td align="right" nowrap>
                        {formatMoney(t.quoted_price_cents, shop.currency)}
                      </Td>
                      <Td>
                        <Tag>{repairSourceLabel(t.source)}</Tag>
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
              {tickets.length} {tickets.length === 1 ? "ticket" : "tickets"}
              {tickets.length === TICKET_LIMIT ? ` (showing the first ${TICKET_LIMIT})` : ""}
            </span>
          </TableFooter>
        </>
      )}
    </Card>
  );
}
