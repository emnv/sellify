import type { Metadata } from "next";
import { Card, EmptyState, Page } from "@/components/ui";
import { StoreHeader } from "../store-header";

export const metadata: Metadata = { title: "Domain · Online store · Sellify" };

export default function StoreDomainPage() {
  return (
    <Page>
      <StoreHeader />
      <Card>
        <EmptyState title="Custom domains are coming" description="Connect your own web address, like fixitgalway.ie." />
      </Card>
    </Page>
  );
}
