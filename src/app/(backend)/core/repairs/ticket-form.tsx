"use client";

import { useActionState } from "react";
import { Button, Card, Field, FormActions, FormRow, FormStack, Input, Notice, Select, Textarea } from "@/components/ui";
import type { CatalogBrand, RepairType } from "@/core/catalog";
import { createTicket, type TicketFormState } from "./actions";

type Props = { brands: CatalogBrand[]; repairTypes: RepairType[] };

export function TicketForm({ brands, repairTypes }: Props) {
  const [state, formAction, pending] = useActionState<TicketFormState, FormData>(createTicket, {});
  // React 19 resets the form after the action; defaultValue from state keeps what was typed.
  const v = state.values;
  const err = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state.error ? <Notice tone="danger">{state.error}</Notice> : null}

      <Card title="Customer">
        <FormStack>
          <Field id="newticket-customer_name" label="Name" required error={err.customer_name}>
            <Input id="newticket-customer_name" name="customer_name" required maxLength={120} autoComplete="off" defaultValue={v?.customer_name} invalid={!!err.customer_name} />
          </Field>
          <FormRow>
            <Field id="newticket-customer_phone" label="Phone" error={err.customer_phone}>
              <Input id="newticket-customer_phone" name="customer_phone" type="tel" maxLength={40} autoComplete="off" defaultValue={v?.customer_phone} invalid={!!err.customer_phone} />
            </Field>
            <Field id="newticket-customer_email" label="Email" error={err.customer_email}>
              <Input id="newticket-customer_email" name="customer_email" type="email" maxLength={254} autoComplete="off" defaultValue={v?.customer_email} invalid={!!err.customer_email} />
            </Field>
          </FormRow>
        </FormStack>
      </Card>

      <Card title="Repair">
        <FormStack>
          <FormRow>
            <Field id="newticket-model_id" label="Model" required error={err.model_id}>
              <Select id="newticket-model_id" name="model_id" required defaultValue={v?.model_id ?? ""} placeholder="Choose a model" invalid={!!err.model_id}>
                {brands.map((b) => (
                  <optgroup key={b.id} label={b.name}>
                    {b.models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </Field>
            <Field id="newticket-repair_type_id" label="Repair" required error={err.repair_type_id}>
              <Select id="newticket-repair_type_id" name="repair_type_id" required defaultValue={v?.repair_type_id ?? ""} placeholder="Choose a repair" invalid={!!err.repair_type_id}>
                {repairTypes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </Field>
          </FormRow>
          <FormRow>
            <Field id="newticket-quoted_price" label="Quoted price" hint="Leave empty to use your repair price." error={err.quoted_price}>
              <Input id="newticket-quoted_price" name="quoted_price" inputMode="decimal" prefix="€" defaultValue={v?.quoted_price} invalid={!!err.quoted_price} placeholder="0.00" hasHint />
            </Field>
            <Field id="newticket-scheduled_at" label="Appointment" hint="Optional. Your shop's local time." error={err.scheduled_at}>
              <Input id="newticket-scheduled_at" name="scheduled_at" type="datetime-local" defaultValue={v?.scheduled_at} invalid={!!err.scheduled_at} hasHint />
            </Field>
          </FormRow>
          <Field id="newticket-notes" label="Notes" hint="Fault details, passcode handover, accessories left with the phone." error={err.notes}>
            <Textarea id="newticket-notes" name="notes" maxLength={2000} defaultValue={v?.notes} invalid={!!err.notes} hasHint />
          </Field>
        </FormStack>
      </Card>

      <FormActions>
        <Button href="/core/repairs" variant="secondary">
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          Create ticket
        </Button>
      </FormActions>
    </form>
  );
}
