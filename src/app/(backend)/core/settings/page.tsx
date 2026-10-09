import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, DetailList, Page, PageHeader, Skeleton } from "@/components/ui";
import { requireShop } from "@/core/shop";
import { ShopForm } from "./shop-form";

export const metadata: Metadata = { title: "Settings · Sellify" };

export default function SettingsPage() {
  return (
    <Page>
      <PageHeader title="Settings" description="Your shop's name and contact details." />
      <Suspense fallback={<Card><Skeleton lines={8} /></Card>}>
        <Settings />
      </Suspense>
    </Page>
  );
}

async function Settings() {
  const { shop } = await requireShop();
  return (
    <>
      <ShopForm
        shop={{ name: shop.name, email: shop.email, phone: shop.phone, address: shop.address, notification_email: shop.notification_email }}
      />
      <Card title="Region" description="Set by Sellify.">
        <DetailList
          items={[
            { label: "Currency", value: shop.currency },
            { label: "Time zone", value: shop.timezone },
          ]}
        />
      </Card>
    </>
  );
}
