"use client";

import { useActionState, useState } from "react";
import { Card, Field, FormActions, FormRow, FormStack, Input, Notice, Select, SubmitButton } from "@/components/ui";
import { saveBuybackPrice, type BuybackPriceFormState } from "./actions";

export type PriceFormBrand = {
  id: number;
  name: string;
  models: Array<{ id: number; name: string; storage: Array<{ gb: number; label: string }> }>;
};

type Props = {
  /** The device catalog, with storage labels already formatted on the server. */
  brands: PriceFormBrand[];
};

export function BuybackPriceForm({ brands }: Props) {
  const [state, formAction] = useActionState<BuybackPriceFormState, FormData>(saveBuybackPrice, {});

  return (
    <Card title="Add or update a price" description="Saving a model and storage that already has a price replaces it.">
      <form action={formAction}>
        <FormStack>
          {state.saved ? <Notice tone="success">Price saved for {state.saved}.</Notice> : null}
          {state.error ? <Notice tone="danger">{state.error}</Notice> : null}
          {/* Remount on every response: model state and field defaults start from what the server returned. */}
          <PriceFields key={state.nonce ?? 0} brands={brands} state={state} />
          <FormActions>
            <SubmitButton pendingText="Saving…">Save price</SubmitButton>
          </FormActions>
        </FormStack>
      </form>
    </Card>
  );
}

function PriceFields({ brands, state }: Props & { state: BuybackPriceFormState }) {
  const v = state.values;
  const err = state.fieldErrors ?? {};
  const [modelId, setModelId] = useState(v?.model_id ?? "");
  const model = brands.flatMap((b) => b.models).find((m) => String(m.id) === modelId);

  return (
    <FormRow>
      <Field id="model_id" label="Model" required error={err.model_id}>
        <Select
          id="model_id"
          name="model_id"
          required
          defaultValue={modelId}
          onChange={(e) => setModelId(e.target.value)}
          placeholder="Choose a model"
          invalid={!!err.model_id}
        >
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
      <Field id="storage_gb" label="Storage" required error={err.storage_gb}>
        <Select
          key={modelId}
          id="storage_gb"
          name="storage_gb"
          required
          disabled={!model}
          defaultValue={model && v?.model_id === modelId ? v.storage_gb : ""}
          placeholder={model ? "Choose storage" : "Choose a model first"}
          invalid={!!err.storage_gb}
        >
          {model?.storage.map((s) => (
            <option key={s.gb} value={s.gb}>
              {s.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="base_price" label="Base price" required hint="What you pay for one in perfect condition." error={err.base_price}>
        <Input
          id="base_price"
          name="base_price"
          inputMode="decimal"
          prefix="€"
          required
          placeholder="0.00"
          defaultValue={v?.base_price ?? ""}
          invalid={!!err.base_price}
          hasHint
        />
      </Field>
    </FormRow>
  );
}
