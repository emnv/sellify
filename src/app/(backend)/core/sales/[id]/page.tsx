import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  Card,
  DetailList,
  Notice,
  Page,
  PageHeader,
  Skeleton,
  StatusBadge,
  Table,
  TableEmpty,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from "@/components/ui";
import { getSale, paymentMethodLabel, saleChannelLabel, saleStatusLabel, saleStatusTone } from "@/core/sales";
import { requireShop } from "@/core/shop";
import { formatDateTime } from "@/lib/datetime";
import { addressLines, fulfilmentLabel, toShippingAddress } from "@/lib/fulfilment";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Sale · Sellify" };

const BACK = { href: "/core/sales", label: "Sales" };

export default function SalePage({ params, searchParams }: PageProps<"/core/sales/[id]">) {
  return (
    <Suspense
      fallback={
        <Page>
          <PageHeader title="Sale" back={BACK} />
          <Card><Skeleton lines={6} /></Card>
        </Page>
      }
    >
      <SaleDetail params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function SaleDetail({ params, searchParams }: Pick<PageProps<"/core/sales/[id]">, "params" | "searchParams">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const { shop } = await requireShop();
  const sale = await getSale(shop.id, id);
  if (!sale) notFound();

  const items = sale.sale_items;
  const itemCount = items.reduce((sum, i) => sum + i.qty, 0);
  const address = addressLines(toShippingAddress(sale.shipping_address));

  return (
    <Page>
      <PageHeader
        title={`Sale · ${formatDateTime(sale.created_at, shop.timezone)}`}
        description={`${itemCount} ${itemCount === 1 ? "item" : "items"} · ${formatMoney(sale.total_cents, shop.currency)}`}
        back={BACK}
      />
      {sp.recorded ? <Notice tone="success">Sale recorded.</Notice> : null}

      <Card title="Summary">
        <DetailList
          items={[
            { label: "Status", value: <StatusBadge tone={saleStatusTone(sale.status)}>{saleStatusLabel(sale.status)}</StatusBadge> },
            { label: "Channel", value: saleChannelLabel(sale.channel) },
            { label: "Payment method", value: paymentMethodLabel(sale.payment_method) },
            { label: "Paid at", value: sale.paid_at ? formatDateTime(sale.paid_at, shop.timezone) : null },
            { label: "Customer name", value: sale.customer_name ?? (sale.channel === "pos" ? "Walk-in customer" : null) },
            { label: "Customer email", value: sale.customer_email },
            { label: "Customer phone", value: sale.customer_phone },
            ...(sale.fulfilment ? [{ label: "Fulfilment", value: fulfilmentLabel(sale.fulfilment) }] : []),
            ...(sale.fulfilment === "delivery"
              ? [
                  {
                    label: "Delivery address",
                    value: address.length ? (
                      <span className="flex flex-col">
                        {address.map((line, i) => (
                          <span key={`${line}-${i}`}>{line}</span>
                        ))}
                      </span>
                    ) : null,
                  },
                ]
              : []),
            ...(sale.note ? [{ label: "Note", value: sale.note }] : []),
          ]}
        />
      </Card>

      <Card title="Items" padding="none">
        <Table label="Items in this sale">
          <THead>
            <tr>
              <Th>Item</Th>
              <Th align="right">Unit price</Th>
              <Th align="right">Qty</Th>
              <Th align="right">Line total</Th>
            </tr>
          </THead>
          <TBody>
            {items.length === 0 ? (
              <TableEmpty colSpan={4}>This sale has no items.</TableEmpty>
            ) : (
              items.map((item) => (
                <Tr key={item.id}>
                  <Td>
                    {item.product_id ? (
                      <Link href={`/core/inventory/${item.product_id}`} className="font-medium text-fg hover:underline">
                        {item.name}
                      </Link>
                    ) : (
                      <span className="font-medium">{item.name}</span>
                    )}
                  </Td>
                  <Td align="right" nowrap>
                    {formatMoney(item.unit_price_cents, shop.currency)}
                  </Td>
                  <Td align="right">{item.qty}</Td>
                  <Td align="right" nowrap>
                    {formatMoney(item.unit_price_cents * item.qty, shop.currency)}
                  </Td>
                </Tr>
              ))
            )}
            {sale.fulfilment === "delivery" ? (
              <tr>
                <Td colSpan={3} align="right">
                  Delivery
                </Td>
                <Td align="right" nowrap>
                  {formatMoney(sale.delivery_fee_cents, shop.currency)}
                </Td>
              </tr>
            ) : null}
            <tr>
              <Td colSpan={3} align="right">
                <span className="font-medium">Total</span>
              </Td>
              <Td align="right" nowrap>
                <span className="font-semibold">{formatMoney(sale.total_cents, shop.currency)}</span>
              </Td>
            </tr>
          </TBody>
        </Table>
      </Card>
    </Page>
  );
}
