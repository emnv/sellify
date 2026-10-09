"use client";

import { useActionState } from "react";
import { ImageUploader } from "@/components/media/image-uploader";
import { Button, Card, Field, FormActions, FormStack, Input, Notice } from "@/components/ui";
import { createStoreAction, saveGeneral, type EditorState } from "./actions";

export function CreateStoreForm({ defaultSlug, exampleUrl }: { defaultSlug: string; exampleUrl: string }) {
  const [state, action, pending] = useActionState<EditorState, FormData>(createStoreAction, {});
  return (
    <form action={action}>
      <FormStack>
        {state.error ? <Notice tone="danger">{state.error}</Notice> : null}
        <Field id="store-slug" label="Store address" required hint={`Lowercase letters, numbers and dashes. Your store will be at ${exampleUrl.replace("your-address", "…")}`} error={state.fieldErrors?.slug}>
          <Input id="store-slug" name="slug" required defaultValue={defaultSlug} invalid={!!state.fieldErrors?.slug} hasHint />
        </Field>
        <FormActions>
          <Button type="submit" loading={pending}>
            Create store
          </Button>
        </FormActions>
      </FormStack>
    </form>
  );
}

type GeneralProps = { shopId: string; slug: string; storeName: string; tagline: string; logoUrl: string | null; addressPreview: string };

export function GeneralForm({ shopId, slug, storeName, tagline, logoUrl, addressPreview }: GeneralProps) {
  const [state, action, pending] = useActionState<EditorState, FormData>(saveGeneral, {});
  const err = state.fieldErrors ?? {};
  return (
    <Card title="Store details" description="Shown in your store's header and browser tab.">
      <form action={action} key={state.nonce}>
        <FormStack>
          {state.saved ? <Notice tone="success">Saved to your draft. Publish to make it live.</Notice> : null}
          {state.error ? <Notice tone="danger">{state.error}</Notice> : null}
          <Field id="store-storeName" label="Store name" required error={err["content.storeName"]}>
            <Input id="store-storeName" name="storeName" required maxLength={80} defaultValue={storeName} invalid={!!err["content.storeName"]} />
          </Field>
          <Field id="store-tagline" label="Tagline" hint="One line under your name, e.g. “Same-day phone repairs in Galway”." error={err["content.tagline"]}>
            <Input id="store-tagline" name="tagline" maxLength={140} defaultValue={tagline} hasHint />
          </Field>
          <Field
            id="store-slug"
            label="Store address"
            required
            hint={`Changing it breaks links you have already shared. Address: ${addressPreview.replace("ADDRESS", slug)}`}
            error={err.slug}
          >
            <Input id="store-slug" name="slug" required defaultValue={slug} invalid={!!err.slug} hasHint />
          </Field>
          <ImageUploader shopId={shopId} folder="store" name="logoUrl" label="Logo" max={1} defaultValue={logoUrl ? [logoUrl] : []} />
          <FormActions>
            <Button type="submit" loading={pending}>
              Save details
            </Button>
          </FormActions>
        </FormStack>
      </form>
    </Card>
  );
}
