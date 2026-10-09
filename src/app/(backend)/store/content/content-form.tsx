"use client";

import { useActionState, useState } from "react";
import { ImageUploader } from "@/components/media/image-uploader";
import {
  Button,
  Card,
  Checkbox,
  Field,
  FormActions,
  FormRow,
  FormStack,
  Input,
  Notice,
  Select,
  Switch,
  Textarea,
} from "@/components/ui";
import type { StoreContent } from "@/lib/store/config";
import { saveContent, type EditorState } from "../actions";

type Day = { key: keyof StoreContent["hours"]; label: string };

export function ContentForm({ shopId, content, days }: { shopId: string; content: StoreContent; days: Day[] }) {
  const [state, action, pending] = useActionState<EditorState, FormData>(saveContent, {});
  const err = state.fieldErrors ?? {};
  const [reviews, setReviews] = useState(() => content.reviews.map((r, i) => ({ ...r, id: `r${i}` })));

  return (
    <form action={action} key={state.nonce}>
      <div className="flex flex-col gap-6">
        {state.saved ? <Notice tone="success">Content saved to your draft. Preview it, then publish.</Notice> : null}
        {state.error ? <Notice tone="danger">{state.error}</Notice> : null}

        <Card title="Banner" description="A strip across the top of every page, for offers and news.">
          <FormStack>
            <Switch id="content-banner.enabled" name="banner.enabled" label="Show the banner" defaultChecked={content.banner.enabled} />
            <Field id="content-banner.text" label="Banner text" error={err["banner.text"]}>
              <Input id="content-banner.text" name="banner.text" maxLength={160} defaultValue={content.banner.text} placeholder="10% off screen repairs this week" />
            </Field>
          </FormStack>
        </Card>

        <Card title="Homepage">
          <FormStack>
            <ImageUploader shopId={shopId} folder="store" name="heroImageUrl" label="Main photo" max={1} defaultValue={content.heroImageUrl ? [content.heroImageUrl] : []} />
            <Field id="content-about" label="About your shop" hint="A few sentences about who you are and what you do." error={err.about}>
              <Textarea id="content-about" name="about" rows={5} maxLength={2000} defaultValue={content.about} hasHint />
            </Field>
          </FormStack>
        </Card>

        <Card title="Contact details" description="Shown in the footer and on the Visit us section. Your address also places the map.">
          <FormStack>
            <FormRow>
              <Field id="content-contact.phone" label="Phone" error={err["contact.phone"]}>
                <Input id="content-contact.phone" name="contact.phone" type="tel" maxLength={40} defaultValue={content.contact.phone} />
              </Field>
              <Field id="content-contact.email" label="Email" error={err["contact.email"]}>
                <Input id="content-contact.email" name="contact.email" type="email" maxLength={254} defaultValue={content.contact.email} invalid={!!err["contact.email"]} />
              </Field>
            </FormRow>
            <Field id="content-contact.address" label="Address" error={err["contact.address"]}>
              <Textarea id="content-contact.address" name="contact.address" rows={3} maxLength={300} defaultValue={content.contact.address} />
            </Field>
          </FormStack>
        </Card>

        <Card title="Opening hours" description="Online repair bookings are only offered inside these hours.">
          <div className="flex flex-col divide-y divide-border">
            {days.map((d) => {
              const h = content.hours[d.key];
              const e = err[`hours.${d.key}`] ?? err[`hours.${d.key}.open`] ?? err[`hours.${d.key}.close`];
              return (
                <div key={d.key} className="grid grid-cols-1 items-center gap-3 py-3 sm:grid-cols-4">
                  <span className="text-body font-medium text-fg">{d.label}</span>
                  <Checkbox id={`content-hours.${d.key}.closed`} name={`hours.${d.key}.closed`} label="Closed" defaultChecked={h.closed} />
                  <Field id={`content-hours.${d.key}.open`} label={`${d.label} opens`} hideLabel error={e}>
                    <Input id={`content-hours.${d.key}.open`} name={`hours.${d.key}.open`} type="time" defaultValue={h.open} invalid={!!e} />
                  </Field>
                  <Field id={`content-hours.${d.key}.close`} label={`${d.label} closes`} hideLabel>
                    <Input id={`content-hours.${d.key}.close`} name={`hours.${d.key}.close`} type="time" defaultValue={h.close} invalid={!!e} />
                  </Field>
                </div>
              );
            })}
          </div>
        </Card>

        <Card
          title="Reviews"
          description="Up to 6 customer reviews. The Local template shows them near the top."
          actions={
            reviews.length < 6 ? (
              <Button variant="secondary" size="sm" onClick={() => setReviews((r) => [...r, { author: "", text: "", rating: 5, id: `n${Date.now()}` }])}>
                Add review
              </Button>
            ) : null
          }
        >
          {reviews.length === 0 ? <p className="text-body text-fg-muted">No reviews yet.</p> : null}
          <div className="flex flex-col gap-6">
            {reviews.map((r, i) => (
              <div key={r.id} className="flex flex-col gap-3 border-b border-border pb-6 last:border-0 last:pb-0">
                <FormRow cols={3}>
                  <Field id={`content-reviews.${i}.author`} label="Name" error={err[`reviews.${i}.author`]}>
                    <Input id={`content-reviews.${i}.author`} name="reviews.author" maxLength={60} defaultValue={r.author} />
                  </Field>
                  <Field id={`content-reviews.${i}.rating`} label="Stars">
                    <Select id={`content-reviews.${i}.rating`} name="reviews.rating" defaultValue={String(r.rating)}>
                      {[5, 4, 3, 2, 1].map((n) => (
                        <option key={n} value={n}>
                          {n} {n === 1 ? "star" : "stars"}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <div className="flex items-end">
                    <Button variant="ghost" size="sm" onClick={() => setReviews((list) => list.filter((x) => x.id !== r.id))}>
                      Remove review
                    </Button>
                  </div>
                </FormRow>
                <Field id={`content-reviews.${i}.text`} label="Review" error={err[`reviews.${i}.text`]}>
                  <Textarea id={`content-reviews.${i}.text`} name="reviews.text" rows={2} maxLength={400} defaultValue={r.text} />
                </Field>
              </div>
            ))}
          </div>
        </Card>

        <FormActions>
          <Button type="submit" loading={pending}>
            Save content
          </Button>
        </FormActions>
      </div>
    </form>
  );
}
