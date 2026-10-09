import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, DetailList, Page, PageHeader, Skeleton } from "@/components/ui";
import { paymentsStatus, refreshStripeAccount, type PaymentsStatus } from "@/core/payments";
import { requireShop } from "@/core/shop";
import { OnlineOrdersForm } from "./online-orders-form";
import { OnlinePaymentsCard } from "./online-payments-card";
import { ShopForm } from "./shop-form";

export const metadata: Metadata = { title: "Settings · Sellify" };

export default function SettingsPage({ searchParams }: PageProps<"/core/settings">) {
  return (
    <Page>
      <PageHeader title="Settings" description="Your shop's details, online orders and payments." />
      <Suspense fallback={<Card><Skeleton lines={8} /></Card>}>
        <Settings searchParams={searchParams} />
      </Suspense>
    </Page>
  );
}

function currencySymbol(currency: string) {
  try {
    return new Intl.NumberFormat("en-IE", { style: "currency", currency }).formatToParts(0).find((p) => p.type === "currency")?.value ?? currency;
  } catch {
    return currency;
  }
}

async function Settings({ searchParams }: Pick<PageProps<"/core/settings">, "searchParams">) {
  const [{ shop, role }, sp] = await Promise.all([requireShop(), searchParams]);
  const returned = sp.stripe === "return" || sp.stripe === "refresh" ? sp.stripe : null;

  // Back from Stripe onboarding: read the account now rather than waiting for account.updated.
  let status: PaymentsStatus = paymentsStatus(shop);
  if (returned === "return" && shop.stripe_account_id) {
    try {
      status = await refreshStripeAccount(shop);
    } catch (e) {
      console.error("settings: could not refresh the Stripe account", { shopId: shop.id, error: (e as Error).message });
    }
  }

  return (
    <>
      <ShopForm
        shop={{ name: shop.name, email: shop.email, phone: shop.phone, address: shop.address, notification_email: shop.notification_email }}
      />
      <OnlineOrdersForm
        settings={{ collection_enabled: shop.collection_enabled, delivery_enabled: shop.delivery_enabled, delivery_fee_cents: shop.delivery_fee_cents }}
        currencySymbol={currencySymbol(shop.currency)}
      />
      <OnlinePaymentsCard status={status} returned={returned} canConnect={role === "owner"} />
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
