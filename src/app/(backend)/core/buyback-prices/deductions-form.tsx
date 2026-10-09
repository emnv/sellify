"use client";

import { useActionState } from "react";
import { Card, Field, FormActions, FormRow, FormStack, Input, Notice, SubmitButton } from "@/components/ui";
import { saveDeductions, type DeductionsFormState } from "./actions";

type Props = {
  defaults: { screen_cracked_pct: number; battery_bad_pct: number; no_power_pct: number };
};

const FIELDS = [
  { name: "screen_cracked_pct", label: "Screen cracked" },
  { name: "battery_bad_pct", label: "Battery not OK" },
  { name: "no_power_pct", label: "Doesn't turn on" },
] as const;

export function DeductionsForm({ defaults }: Props) {
  const [state, formAction] = useActionState<DeductionsFormState, FormData>(saveDeductions, {});
  const v = state.values;
  const err = state.fieldErrors ?? {};

  return (
    <Card
      title="Condition deductions"
      description="The offer is the base price minus these percentages for each problem the customer reports."
    >
      <form action={formAction}>
        <FormStack>
          {state.saved ? <Notice tone="success">Deductions saved.</Notice> : null}
          {state.error ? <Notice tone="danger">{state.error}</Notice> : null}
          <FormRow cols={3}>
            {FIELDS.map((f) => (
              <Field key={f.name} id={f.name} label={f.label} required error={err[f.name]}>
                <Input
                  id={f.name}
                  name={f.name}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  step={1}
                  required
                  defaultValue={v?.[f.name] ?? defaults[f.name]}
                  invalid={!!err[f.name]}
                  suffix="%"
                />
              </Field>
            ))}
          </FormRow>
          <FormActions>
            <SubmitButton pendingText="Saving…">Save deductions</SubmitButton>
          </FormActions>
        </FormStack>
      </form>
    </Card>
  );
}
