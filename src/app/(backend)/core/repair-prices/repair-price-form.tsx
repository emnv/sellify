"use client";

import { useActionState } from "react";
import { Card, Field, FormActions, FormRow, FormStack, Input, Notice, Select, SubmitButton } from "@/components/ui";
import type { CatalogBrand, RepairType } from "@/core/catalog";
import { saveRepairPrice, type RepairPriceFormState } from "./actions";

type Props = { brands: CatalogBrand[]; repairTypes: RepairType[] };

export function RepairPriceForm({ brands, repairTypes }: Props) {
  const [state, formAction] = useActionState<RepairPriceFormState, FormData>(saveRepairPrice, {});
  // React 19 resets the form after the action; defaultValue from state keeps what was typed.
  const v = state.values;
  const err = state.fieldErrors ?? {};

  return (
    <Card title="Add or update a price" description="Adding a model and repair that already has a price updates it.">
      <form action={formAction}>
        <FormStack>
          {state.error ? <Notice tone="danger">{state.error}</Notice> : null}
          {state.saved ? <Notice tone="success">{state.saved}</Notice> : null}
          <FormRow>
            <Field id="rprice-model_id" label="Model" required error={err.model_id}>
              <Select id="rprice-model_id" name="model_id" required defaultValue={v?.model_id ?? ""} placeholder="Choose a model" invalid={!!err.model_id}>
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
            <Field id="rprice-repair_type_id" label="Repair" required error={err.repair_type_id}>
              <Select id="rprice-repair_type_id" name="repair_type_id" required defaultValue={v?.repair_type_id ?? ""} placeholder="Choose a repair" invalid={!!err.repair_type_id}>
                {repairTypes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </Field>
          </FormRow>
          <FormRow>
            <Field id="rprice-price" label="Price" required error={err.price}>
              <Input id="rprice-price" name="price" inputMode="decimal" prefix="€" required defaultValue={v?.price ?? ""} invalid={!!err.price} placeholder="0.00" />
            </Field>
            <Field id="rprice-duration" label="Time needed (minutes)" hint="From 15 to 480 minutes." error={err.duration}>
              <Input id="rprice-duration" name="duration" type="number" min={15} max={480} step={5} required defaultValue={v?.duration ?? "60"} invalid={!!err.duration} hasHint />
            </Field>
          </FormRow>
          <FormActions>
            <SubmitButton pendingText="Saving…">Save price</SubmitButton>
          </FormActions>
        </FormStack>
      </form>
    </Card>
  );
}
