"use client";

import { useActionState } from "react";
import { Card, Field, FormActions, FormStack, HiddenField, Notice, Select, SubmitButton, Textarea } from "@/components/ui";
import { updateBuyback, type BuybackUpdateState } from "../actions";

type Props = {
  id: string;
  status: string;
  notes: string | null;
  statuses: ReadonlyArray<{ value: string; label: string }>;
};

export function BuybackStatusForm({ id, status, notes, statuses }: Props) {
  const [state, formAction] = useActionState<BuybackUpdateState, FormData>(updateBuyback, {});
  const v = state.values;
  const err = state.fieldErrors ?? {};

  return (
    <Card title="Status" description="Mark the phone received when it is in the shop, and paid once you have paid the customer.">
      <form action={formAction}>
        <HiddenField name="id" value={id} />
        <FormStack>
          {state.error ? <Notice tone="danger">{err.id ?? state.error}</Notice> : null}
          <Field id="status" label="Status" required error={err.status}>
            <Select id="status" name="status" required defaultValue={v?.status ?? status} invalid={!!err.status}>
              {statuses.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="notes" label="Notes" hint="Only your team sees these." error={err.notes}>
            <Textarea id="notes" name="notes" maxLength={2000} defaultValue={v?.notes ?? notes ?? ""} invalid={!!err.notes} hasHint />
          </Field>
          <FormActions>
            <SubmitButton pendingText="Updating…">Update buyback</SubmitButton>
          </FormActions>
        </FormStack>
      </form>
    </Card>
  );
}
