"use client";

import { useActionState } from "react";
import { Card, Field, FormActions, FormRow, FormStack, Input, Notice, SubmitButton, Textarea } from "@/components/ui";
import { saveShopProfile, type ShopProfileState } from "./actions";

type Props = {
  shop: { name: string; email: string | null; phone: string | null; address: string | null; notification_email: string | null };
};

export function ShopForm({ shop }: Props) {
  const [state, formAction] = useActionState<ShopProfileState, FormData>(saveShopProfile, {});
  const v = state.values;
  const err = state.fieldErrors ?? {};

  return (
    <Card title="Shop details" description="Shown to customers on your online store, receipts and emails.">
      <form action={formAction}>
        <FormStack>
          {state.saved ? <Notice tone="success">Settings saved.</Notice> : null}
          {state.error ? <Notice tone="danger">{state.error}</Notice> : null}
          <Field id="name" label="Shop name" required error={err.name}>
            <Input id="name" name="name" required maxLength={80} defaultValue={v?.name ?? shop.name} invalid={!!err.name} />
          </Field>
          <FormRow>
            <Field id="email" label="Email" error={err.email}>
              <Input id="email" name="email" type="email" maxLength={254} autoComplete="email" defaultValue={v?.email ?? shop.email ?? ""} invalid={!!err.email} />
            </Field>
            <Field id="phone" label="Phone" error={err.phone}>
              <Input id="phone" name="phone" type="tel" maxLength={40} autoComplete="tel" defaultValue={v?.phone ?? shop.phone ?? ""} invalid={!!err.phone} />
            </Field>
          </FormRow>
          <Field id="address" label="Address" error={err.address}>
            <Textarea id="address" name="address" rows={3} maxLength={300} defaultValue={v?.address ?? shop.address ?? ""} invalid={!!err.address} />
          </Field>
          <Field
            id="notification_email"
            label="Notification email"
            hint="Booking, buyback and order emails go here. Leave it empty to use the shop email."
            error={err.notification_email}
          >
            <Input
              id="notification_email"
              name="notification_email"
              type="email"
              maxLength={254}
              defaultValue={v?.notification_email ?? shop.notification_email ?? ""}
              invalid={!!err.notification_email}
              hasHint
            />
          </Field>
          <FormActions>
            <SubmitButton pendingText="Saving…">Save settings</SubmitButton>
          </FormActions>
        </FormStack>
      </form>
    </Card>
  );
}
