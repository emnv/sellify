"use client";

import Image from "next/image";
import { useActionState, useMemo, useState } from "react";
import {
  Button,
  Card,
  ChoiceGroup,
  FilterBar,
  Field,
  FormStack,
  Grid,
  HiddenField,
  Input,
  Muted,
  Notice,
  Table,
  TableEmpty,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from "@/components/ui";
import type { SellableProduct } from "@/core/sales";
import { formatMoney } from "@/lib/money";
import { recordSale, type PosSaleState } from "./actions";

type Props = {
  /** In-stock products; `category` is already the display label. */
  products: SellableProduct[];
  currency: string;
};

type PaymentMethod = "cash" | "card";

const MAX_LINES = 100;

export function PointOfSale({ products, currency }: Props) {
  const [state, formAction, pending] = useActionState<PosSaleState, FormData>(recordSale, {});
  const [search, setSearch] = useState("");
  // product id → quantity, in the order lines were added.
  const [basket, setBasket] = useState<Array<{ id: string; qty: number }>>([]);
  const [payment, setPayment] = useState<PaymentMethod>("card");
  const [customerName, setCustomerName] = useState("");

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const term = search.trim().toLowerCase();
  const shown = term ? products.filter((p) => p.name.toLowerCase().includes(term) || p.category.toLowerCase().includes(term)) : products;

  const lines = basket.flatMap((line) => {
    const product = byId.get(line.id);
    return product ? [{ product, qty: line.qty }] : [];
  });
  const total = lines.reduce((sum, l) => sum + l.product.price_cents * l.qty, 0);
  const itemCount = lines.reduce((sum, l) => sum + l.qty, 0);

  function qtyInBasket(id: string) {
    return basket.find((l) => l.id === id)?.qty ?? 0;
  }

  function add(product: SellableProduct) {
    setBasket((current) => {
      const existing = current.find((l) => l.id === product.id);
      if (existing) {
        return current.map((l) => (l.id === product.id ? { ...l, qty: Math.min(l.qty + 1, product.stock_qty) } : l));
      }
      if (current.length >= MAX_LINES) return current;
      return [...current, { id: product.id, qty: 1 }];
    });
  }

  function setQty(product: SellableProduct, qty: number) {
    const next = Math.max(1, Math.min(qty, product.stock_qty));
    setBasket((current) => current.map((l) => (l.id === product.id ? { ...l, qty: next } : l)));
  }

  function remove(id: string) {
    setBasket((current) => current.filter((l) => l.id !== id));
  }

  return (
    <Grid>
      <Card title="Products" description="Only products with stock are listed." padding="none">
        <FilterBar>
          <div className="w-full lg:w-72">
            <Field id="pos-search" label="Search products" hideLabel>
              <Input
                id="pos-search"
                type="search"
                placeholder="Search products"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoComplete="off"
              />
            </Field>
          </div>
        </FilterBar>
        <Table label="Products in stock">
          <THead>
            <tr>
              <Th>Product</Th>
              <Th align="right">Price</Th>
              <Th srOnly>Actions</Th>
            </tr>
          </THead>
          <TBody>
            {shown.length === 0 ? (
              <TableEmpty colSpan={3}>No products match “{search.trim()}”.</TableEmpty>
            ) : (
              shown.map((p) => {
                const inBasket = qtyInBasket(p.id);
                const left = p.stock_qty - inBasket;
                return (
                  <Tr key={p.id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <div className="relative size-10 shrink-0 overflow-hidden rounded-md border border-border bg-surface-muted">
                          {p.image ? <Image src={p.image} alt="" fill sizes="40px" className="object-cover" /> : null}
                        </div>
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-medium text-fg">{p.name}</span>
                          <Muted>
                            {p.category} · {p.stock_qty} in stock
                          </Muted>
                        </div>
                      </div>
                    </Td>
                    <Td align="right" nowrap>
                      {formatMoney(p.price_cents, currency)}
                    </Td>
                    <Td align="right">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => add(p)}
                        disabled={left <= 0}
                        aria-label={left <= 0 ? `All ${p.name} stock is in the basket` : `Add ${p.name} to the basket`}
                      >
                        Add
                      </Button>
                    </Td>
                  </Tr>
                );
              })
            )}
          </TBody>
        </Table>
      </Card>

      <Card title="Basket" description={itemCount === 1 ? "1 item" : `${itemCount} items`}>
        <form action={formAction} className="flex flex-col gap-5">
          {state.error ? <Notice tone="danger">{state.error}</Notice> : null}

          {lines.length === 0 ? (
            <p className="text-body text-fg-muted">The basket is empty. Add products from the list to start a sale.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {lines.map(({ product, qty }) => (
                <li key={product.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium text-fg">{product.name}</span>
                    <Muted>{formatMoney(product.price_cents, currency)} each</Muted>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setQty(product, qty - 1)}
                      disabled={qty <= 1}
                      aria-label={`One less ${product.name}`}
                    >
                      −
                    </Button>
                    <span className="w-8 text-center text-body tabular-nums" aria-live="polite">
                      {qty}
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setQty(product, qty + 1)}
                      disabled={qty >= product.stock_qty}
                      aria-label={`One more ${product.name}`}
                    >
                      +
                    </Button>
                  </div>
                  <span className="w-24 text-right text-body tabular-nums">{formatMoney(product.price_cents * qty, currency)}</span>
                  <Button variant="ghost" size="sm" onClick={() => remove(product.id)} aria-label={`Remove ${product.name} from the basket`}>
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center justify-between border-t border-border pt-4">
            <span className="text-body font-medium text-fg">Total</span>
            <span className="font-heading text-heading font-semibold text-fg tabular-nums">{formatMoney(total, currency)}</span>
          </div>

          <FormStack>
            <Field id="pos-customer_name" label="Customer name" hint="Optional. Shown on the sale.">
              <Input
                id="pos-customer_name"
                name="customer_name"
                maxLength={120}
                autoComplete="off"
                hasHint
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </Field>
            <ChoiceGroup
              name="payment_method"
              label="Payment method"
              value={payment}
              onChange={(v) => setPayment(v as typeof payment)}
              options={[
                { value: "cash", label: "Cash" },
                { value: "card", label: "Card" },
              ]}
            />
          </FormStack>

          <HiddenField name="items" value={JSON.stringify(lines.map((l) => ({ product_id: l.product.id, qty: l.qty })))} />

          <Button type="submit" fullWidth loading={pending} disabled={lines.length === 0}>
            {pending ? "Recording sale…" : "Record sale"}
          </Button>
        </form>
      </Card>
    </Grid>
  );
}
