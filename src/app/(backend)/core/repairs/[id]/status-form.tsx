"use client";

import { useActionState } from "react";
import { Card, Field, FormActions, FormStack, HiddenField, Notice, Select, SubmitButton, Textarea } from "@/components/ui";
import { updateTicket, type TicketUpdateState } from "../actions";

type Props = {
  id: string;
  status: string;
  notes: string | null;
  statuses: ReadonlyArray<{ value: string; label: string }>;
};

export function StatusForm({ id, status, notes, statuses }: Props) {
  const [state, formAction] = useActionState<TicketUpdateState, FormData>(updateTicket, {});
  // React 19 resets the form after the action; defaultValue from state keeps what was typed.
  const v = state.values;
  const err = state.fieldErrors ?? {};

  return (
    <Card title="Status" description="Keep the status current so you and your staff know what to do next.">
      <form action={formAction}>
        <HiddenField name="id" value={id} />
        <FormStack>
          {state.error ? <Notice tone="danger">{state.error}</Notice> : null}
          <Field id="ticket-status" label="Status" required error={err.status}>
            <Select id="ticket-status" name="status" defaultValue={v?.status ?? status} invalid={!!err.status}>
              {statuses.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="ticket-notes" label="Notes" hint="Only your staff see these." error={err.notes}>
            <Textarea id="ticket-notes" name="notes" maxLength={2000} defaultValue={v?.notes ?? notes ?? ""} invalid={!!err.notes} hasHint />
          </Field>
          <FormActions>
            <SubmitButton pendingText="Updating…">Update ticket</SubmitButton>
          </FormActions>
        </FormStack>
      </form>
    </Card>
  );
}
