"use client";

import { useActionState } from "react";
import { Card, Field, FormActions, FormStack, Notice, Select, SubmitButton } from "@/components/ui";
import { saveSlotCapacity, type SlotCapacityFormState } from "./actions";

type Props = { capacity: number; max: number };

export function SlotCapacityForm({ capacity, max }: Props) {
  const [state, formAction] = useActionState<SlotCapacityFormState, FormData>(saveSlotCapacity, {});
  // React 19 resets the form after the action; defaultValue from state keeps the choice.
  const err = state.fieldErrors ?? {};

  return (
    <Card title="Online bookings" description="Your online store stops offering a time once it has this many repairs booked.">
      <form action={formAction}>
        <FormStack>
          {state.error ? <Notice tone="danger">{state.error}</Notice> : null}
          {state.saved ? <Notice tone="success">{state.saved}</Notice> : null}
          <Field id="rprice-slot_capacity" label="Repairs per time slot" hint="How many repairs you can take in the same hour." error={err.capacity}>
            <Select id="rprice-slot_capacity" name="capacity" defaultValue={state.values?.capacity ?? String(capacity)} invalid={!!err.capacity} hasHint>
              {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </Field>
          <FormActions>
            <SubmitButton pendingText="Saving…">Save setting</SubmitButton>
          </FormActions>
        </FormStack>
      </form>
    </Card>
  );
}
