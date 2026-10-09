"use client";

import { useActionState } from "react";
import { Button, Field, FormStack, Input, Notice } from "@/components/ui";
import { createShop } from "./actions";

export function OnboardingForm({ defaultEmail }: { defaultEmail: string }) {
  const [state, formAction, pending] = useActionState(createShop, {});

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-title font-bold">Set up your shop</h1>
        <p className="text-body text-fg-muted">You can change these details later in Settings.</p>
      </div>
      {state.error ? <Notice tone="danger">{state.error}</Notice> : null}
      <FormStack>
        <Field id="shop-name" label="Shop name" required>
          <Input id="shop-name" name="name" required maxLength={80} defaultValue={state.name} placeholder="FixIt Galway" />
        </Field>
        <Field id="shop-email" label="Shop email" hint="Booking, buyback and order emails go here.">
          <Input id="shop-email" name="email" type="email" defaultValue={state.email ?? defaultEmail} hasHint />
        </Field>
      </FormStack>
      <Button type="submit" fullWidth loading={pending}>
        Create shop
      </Button>
    </form>
  );
}
