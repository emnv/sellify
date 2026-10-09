import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Card, DetailList, Grid, Muted, Notice, Page, PageHeader, Skeleton, StatusBadge, Tag } from "@/components/ui";
import { getRepairTicket, listRepairTicketNotes, REPAIR_STATUSES, repairSourceLabel, repairStatus } from "@/core/repairs";
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
  const notes = await listRepairTicketNotes(shop.id, ticket.id);
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
      {one(sp.note) === "failed" ? (
        <Notice tone="warning">The note wasn&apos;t saved with the ticket. Add it again below.</Notice>
      ) : null}

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

      <Card title="Notes" description="Oldest first. Only your staff see notes.">
        {notes.length === 0 ? (
          <Muted>No notes yet. Add one when you update the ticket.</Muted>
        ) : (
          <ol className="flex flex-col gap-4">
            {notes.map((n) => (
              <li key={n.id} className="flex flex-col gap-1">
                <Muted>{formatDateTime(n.created_at, shop.timezone)}</Muted>
                <p className="whitespace-pre-wrap text-body text-fg">{n.body}</p>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <StatusForm id={ticket.id} status={ticket.status} statuses={REPAIR_STATUSES} />
    </Page>
  );
}
