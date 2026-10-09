"use client";

import { useActionState, useState } from "react";
import { ImageUploader } from "@/components/media/image-uploader";
import { Button, Card, Field, FormActions, FormRow, FormStack, HiddenField, Input, Notice, Select, Switch, Textarea } from "@/components/ui";
import type { CatalogBrand, RepairType } from "@/core/catalog";
import { centsToInput } from "@/lib/money";
import { saveProduct, type ProductFormState } from "./actions";

type ProductValues = {
  id?: string;
  name: string;
  description: string | null;
  category: string;
  condition: string | null;
  sku: string | null;
  price_cents: number | null;
  stock_qty: number;
  visible_online: boolean;
  images: string[];
  model_id: number | null;
  repair_type_id: number | null;
};

type Props = {
  shopId: string;
  product?: ProductValues;
  brands: CatalogBrand[];
  repairTypes: RepairType[];
  categories: ReadonlyArray<{ value: string; singular: string }>;
  conditions: ReadonlyArray<{ value: string; label: string }>;
};

export function ProductForm({ shopId, product, brands, repairTypes, categories, conditions }: Props) {
  const [state, formAction, pending] = useActionState<ProductFormState, FormData>(saveProduct, {});
  const v = state.values;
  // Uncontrolled + defaultValue: React 19 resets forms after an action, back to
  // defaultValue, which is the submitted value from state.
  const [category, setCategory] = useState(v?.category ?? product?.category ?? "accessory");
  const err = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {product?.id ? <HiddenField name="id" value={product.id} /> : null}
      {state.error ? <Notice tone="danger">{state.error}</Notice> : null}

      <Card title="Details">
        <FormStack>
          <Field id="name" label="Name" required error={err.name}>
            <Input id="name" name="name" required maxLength={120} defaultValue={v?.name ?? product?.name} invalid={!!err.name} placeholder="iPhone 13 128GB, Midnight" />
          </Field>
          <FormRow>
            <Field id="category" label="Category" required error={err.category}>
              <Select id="category" name="category" defaultValue={category} onChange={(e) => setCategory(e.target.value)} invalid={!!err.category}>
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.singular}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="condition" label="Condition" error={err.condition}>
              <Select id="condition" name="condition" defaultValue={v?.condition ?? product?.condition ?? ""} placeholder="Not set">
                {conditions.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
          </FormRow>
          <Field id="description" label="Description" hint="Shown on the product page of your online store." error={err.description}>
            <Textarea id="description" name="description" maxLength={4000} defaultValue={v?.description ?? product?.description ?? ""} hasHint />
          </Field>
          <Field id="sku" label="SKU" hint="Your own stock code. Optional." error={err.sku}>
            <Input id="sku" name="sku" maxLength={60} defaultValue={v?.sku ?? product?.sku ?? ""} hasHint />
          </Field>
        </FormStack>
      </Card>

      <Card title="Price and stock">
        <FormStack>
          <FormRow>
            <Field id="price" label="Price" required error={err.price}>
              <Input id="price" name="price" inputMode="decimal" prefix="€" required defaultValue={v?.price ?? centsToInput(product?.price_cents)} invalid={!!err.price} placeholder="0.00" />
            </Field>
            <Field id="stock" label="In stock" required error={err.stock}>
              <Input id="stock" name="stock" type="number" min={0} step={1} required defaultValue={v?.stock ?? product?.stock_qty ?? 0} invalid={!!err.stock} />
            </Field>
          </FormRow>
          <Switch
            id="visible_online"
            name="visible_online"
            label="Show in online store"
            description="Hidden products stay in your inventory and POS."
            defaultChecked={v?.visible_online ?? product?.visible_online ?? true}
          />
        </FormStack>
      </Card>

      {category === "part" ? (
        <Card title="Repair part" description="Links this part to a repair. When it is in stock, your Repair tab shows “Same-day repair available”.">
          <FormRow>
            <Field id="model_id" label="Fits model" required error={err.model_id}>
              <Select id="model_id" name="model_id" defaultValue={v?.model_id ?? product?.model_id?.toString() ?? ""} placeholder="Choose a model" invalid={!!err.model_id}>
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
            <Field id="repair_type_id" label="Used for" required error={err.repair_type_id}>
              <Select id="repair_type_id" name="repair_type_id" defaultValue={v?.repair_type_id ?? product?.repair_type_id?.toString() ?? ""} placeholder="Choose a repair" invalid={!!err.repair_type_id}>
                {repairTypes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </Field>
          </FormRow>
        </Card>
      ) : null}

      <Card title="Photos">
        <ImageUploader shopId={shopId} folder="products" name="images" label="Product photos" defaultValue={v?.images ?? product?.images ?? []} />
        {err.images ? <p className="mt-2 text-small text-danger-fg">{err.images}</p> : null}
      </Card>

      <FormActions>
        <Button href="/core/inventory" variant="secondary">
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          {product?.id ? "Save changes" : "Add product"}
        </Button>
      </FormActions>
    </form>
  );
}
