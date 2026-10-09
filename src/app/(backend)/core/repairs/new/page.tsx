import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, Page, PageHeader, Skeleton } from "@/components/ui";
import { getCatalog } from "@/core/catalog";
import { requireShop } from "@/core/shop";
import { TicketForm } from "../ticket-form";

export const metadata: Metadata = { title: "New repair ticket · Sellify" };

export default function NewTicketPage() {
  return (
    <Page>
      <PageHeader
        title="New repair ticket"
        description="Book in a walk-in customer."
        back={{ href: "/core/repairs", label: "Repair tickets" }}
      />
      <Suspense fallback={<Card><Skeleton lines={8} /></Card>}>
        <NewTicket />
      </Suspense>
    </Page>
  );
}

async function NewTicket() {
  const [, catalog] = await Promise.all([requireShop(), getCatalog()]);
  return <TicketForm brands={catalog.brands} repairTypes={catalog.repairTypes} />;
}
