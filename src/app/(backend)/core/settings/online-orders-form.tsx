"use client";

import { useActionState } from "react";
import { Card, Field, FormActions, FormStack, Input, Notice, SubmitButton, Switch } from "@/components/ui";
import { centsToInput } from "@/lib/money";
import { saveOnlineOrders, type OnlineOrdersState } from "./actions";

type Props = {
  settings: { collection_enabled: boolean; delivery_enabled: boolean; delivery_fee_cents: number };
  /** Currency symbol shown in the fee field, e.g. "€". */
  currencySymbol: string;
};

export function OnlineOrdersForm({ settings, currencySymbol }: Props) {
  const [state, formAction] = useActionState<OnlineOrdersState, FormData>(saveOnlineOrders, {});
  const v = state.values;
  const err = state.fieldErrors ?? {};

  return (
    <Card title="Online orders" description="How customers get what they buy on your online store. Keep at least one option on.">
      <form action={formAction}>
        <FormStack>
          {state.saved ? <Notice tone="success">Online order settings saved.</Notice> : null}
          {state.error ? <Notice tone="danger">{state.error}</Notice> : null}
          <Switch
            id="pay-collection-enabled"
            name="collection_enabled"
            label="Collection in the shop"
            description="Customers pay online and pick up their order from you."
            defaultChecked={v?.collection_enabled ?? settings.collection_enabled}
          />
          <Switch
            id="pay-delivery-enabled"
            name="delivery_enabled"
            label="Delivery"
            description="Customers give a delivery address in Ireland or the UK when they pay."
            defaultChecked={v?.delivery_enabled ?? settings.delivery_enabled}
          />
          <Field id="pay-delivery-fee" label="Delivery fee" hint="Added to every delivery order. Enter 0 for free delivery." error={err.delivery_fee}>
            <Input
              id="pay-delivery-fee"
              name="delivery_fee"
              inputMode="decimal"
              prefix={currencySymbol}
              maxLength={20}
              defaultValue={v?.delivery_fee ?? centsToInput(settings.delivery_fee_cents)}
              invalid={!!err.delivery_fee}
              hasHint
            />
          </Field>
          <FormActions>
            <SubmitButton pendingText="Saving…">Save online orders</SubmitButton>
          </FormActions>
        </FormStack>
      </form>
    </Card>
  );
}
