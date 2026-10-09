import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Card, DetailList, Grid, Notice, Page, PageHeader, Skeleton, StatusBadge, Tag } from "@/components/ui";
import { getRepairTicket, REPAIR_STATUSES, repairSourceLabel, repairStatus } from "@/core/repairs";
import { requireShop } from "@/core/shop";
import { formatDateTime } from "@/lib/datetime";
import { formatMoney } from "@/lib/money";
import { StatusForm } from "./status-form";

export const metadata: Metadata = { title: "Repair ticket · Sellify" };

const BACK = { href: "/core/repairs", label: "Repair tickets" };

export default function RepairTicketPage({ params, searchParams }: PageProps<"/core/repairs/[id]">) {
  return (
    <Suspense
      fallback={
        <Page>
          <PageHeader title="Repair ticket" back={BACK} />
          <Grid>
            <Card><Skeleton lines={4} /></Card>
            <Card><Skeleton lines={6} /></Card>
          </Grid>
        </Page>
      }
    >
      <Ticket params={params} searchParams={searchParams} />
    </Suspense>
  );
}

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

async function Ticket({ params, searchParams }: Pick<PageProps<"/core/repairs/[id]">, "params" | "searchParams">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const { shop } = await requireShop();
  const ticket = await getRepairTicket(shop.id, id);
  if (!ticket) notFound();
  const status = repairStatus(ticket.status);

  return (
    <Page>
      <PageHeader
        title={`${ticket.device_label} · ${ticket.repair_label}`}
        description={<StatusBadge tone={status.tone}>{status.label}</StatusBadge>}
        back={BACK}
      />
      {one(sp.created) ? <Notice tone="success">Ticket created.</Notice> : null}
      {one(sp.updated) ? <Notice tone="success">Ticket updated.</Notice> : null}

      <Grid>
        <Card title="Customer">
          <DetailList
            items={[
              { label: "Name", value: ticket.customer_name },
              { label: "Phone", value: ticket.customer_phone },
              { label: "Email", value: ticket.customer_email },
            ]}
          />
        </Card>
        <Card title="Repair">
          <DetailList
            items={[
              { label: "Device", value: ticket.device_label },
              { label: "Repair", value: ticket.repair_label },
              { label: "Quote", value: formatMoney(ticket.quoted_price_cents, shop.currency) },
              { label: "Appointment", value: ticket.scheduled_at ? formatDateTime(ticket.scheduled_at, shop.timezone) : "Not scheduled" },
              { label: "Source", value: <Tag>{repairSourceLabel(ticket.source)}</Tag> },
              { label: "Booked at", value: formatDateTime(ticket.created_at, shop.timezone) },
            ]}
          />
        </Card>
      </Grid>

      <StatusForm id={ticket.id} status={ticket.status} notes={ticket.notes} statuses={REPAIR_STATUSES} />
    </Page>
  );
}
