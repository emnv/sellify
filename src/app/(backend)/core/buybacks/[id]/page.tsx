import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Card, DetailList, Grid, Notice, Page, PageHeader, Skeleton, StatusBadge, Tag } from "@/components/ui";
import { BUYBACK_STATUSES, buybackSourceLabel, buybackStatus, getBuyback, handoverLabel, readAnswers } from "@/core/buybacks";
import { storageLabel } from "@/core/catalog";
import { requireShop } from "@/core/shop";
import { formatDateTime } from "@/lib/datetime";
import { formatMoney } from "@/lib/money";
import { BuybackStatusForm } from "./status-form";

export const metadata: Metadata = { title: "Buyback · Sellify" };

const BACK = { href: "/core/buybacks", label: "Buybacks" };

export default function BuybackPage({ params, searchParams }: PageProps<"/core/buybacks/[id]">) {
  return (
    <Suspense
      fallback={
        <Page>
          <PageHeader title="Buyback" back={BACK} />
          <Card><Skeleton lines={8} /></Card>
        </Page>
      }
    >
      <BuybackDetail params={params} searchParams={searchParams} />
    </Suspense>
  );
}

function yesNo(v: boolean | null) {
  return v === null ? "Not answered" : v ? "Yes" : "No";
}

async function BuybackDetail({ params, searchParams }: PageProps<"/core/buybacks/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const { shop } = await requireShop();
  const buyback = await getBuyback(shop.id, id);
  if (!buyback) notFound();

  const status = buybackStatus(buyback.status);
  const answers = readAnswers(buyback.answers);

  return (
    <Page>
      <PageHeader
        title={buyback.device_label}
        description={<StatusBadge tone={status.tone}>{status.label}</StatusBadge>}
        back={BACK}
      />
      {sp.updated ? <Notice tone="success">Buyback updated.</Notice> : null}
      <Grid>
        <Card title="Customer">
          <DetailList
            items={[
              { label: "Name", value: buyback.customer_name },
              { label: "Phone", value: buyback.customer_phone },
              { label: "Email", value: buyback.customer_email },
            ]}
          />
        </Card>
        <Card title="Phone">
          <DetailList
            items={[
              { label: "Device", value: buyback.device_label },
              { label: "Storage", value: buyback.storage_gb ? <Tag>{storageLabel(buyback.storage_gb)}</Tag> : null },
              { label: "Screen cracked", value: yesNo(answers.screenCracked) },
              { label: "Battery OK", value: yesNo(answers.batteryOk) },
              { label: "Turns on", value: yesNo(answers.turnsOn) },
              { label: "Offer", value: formatMoney(buyback.offer_cents, shop.currency) },
              { label: "Handover", value: handoverLabel(buyback.handover) },
              { label: "Source", value: buybackSourceLabel(buyback.source) },
              { label: "Date", value: formatDateTime(buyback.created_at, shop.timezone) },
            ]}
          />
        </Card>
      </Grid>
      <BuybackStatusForm id={buyback.id} status={buyback.status} notes={buyback.notes} statuses={BUYBACK_STATUSES} />
    </Page>
  );
}
