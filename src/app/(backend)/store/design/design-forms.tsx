"use client";

import { useActionState } from "react";
import { Button, Card, ChoiceGroup, ColorInput, Field, FormActions, FormRow, FormStack, Notice, Select } from "@/components/ui";
import type { StoreTheme } from "@/lib/store/config";
import { changeTemplate, saveDesign, type EditorState } from "../actions";

type TemplateOption = { value: string; label: string; description: string };

export function TemplateForm({ current, templates }: { current: string; templates: TemplateOption[] }) {
  const [state, action, pending] = useActionState<EditorState, FormData>(changeTemplate, {});
  return (
    <Card title="Template" description="Switching template changes the look and resets colours and fonts to the template's defaults. Your products, prices and content stay.">
      <form action={action} key={state.nonce}>
        <FormStack>
          {state.saved ? <Notice tone="success">Template changed in your draft. Check the preview, then publish.</Notice> : null}
          {state.error ? <Notice tone="danger">{state.error}</Notice> : null}
          <ChoiceGroup name="template" label="Choose a template" defaultValue={current} options={templates.map((t) => ({ value: t.value, label: t.label }))} />
          <ul className="grid grid-cols-1 gap-3 text-small text-fg-muted sm:grid-cols-3">
            {templates.map((t) => (
              <li key={t.value}>
                <span className="font-medium text-fg">{t.label}:</span> {t.description}
              </li>
            ))}
          </ul>
          <FormActions>
            <Button type="submit" variant="secondary" loading={pending}>
              Use this template
            </Button>
          </FormActions>
        </FormStack>
      </form>
    </Card>
  );
}

type Options = {
  fonts: Array<{ value: string; label: string }>;
  radii: string[];
  buttonSizes: string[];
  heroStyles: string[];
};

const RADIUS_LABELS: Record<string, string> = { none: "Square", small: "Slightly rounded", medium: "Rounded", large: "Very rounded", pill: "Pill" };
const HERO_LABELS: Record<string, string> = { banner: "Big banner with photo", split: "Text and photo side by side", minimal: "Text only" };
const COLOR_FIELDS = [
  { key: "primary", label: "Main colour", hint: "Buttons and links." },
  { key: "accent", label: "Accent", hint: "Badges and the banner." },
  { key: "background", label: "Page background", hint: "" },
  { key: "surface", label: "Cards", hint: "" },
  { key: "text", label: "Text", hint: "" },
] as const;

export function DesignForm({ theme, options }: { theme: StoreTheme; options: Options }) {
  const [state, action, pending] = useActionState<EditorState, FormData>(saveDesign, {});
  const err = state.fieldErrors ?? {};
  return (
    <form action={action} key={`${state.nonce}-${theme.template}`}>
      <div className="flex flex-col gap-6">
        {state.saved ? <Notice tone="success">Design saved to your draft. Preview it, then publish.</Notice> : null}
        {state.error ? <Notice tone="danger">{state.error}</Notice> : null}

        <Card title="Colours" description="Button text switches between black and white automatically so it stays readable.">
          <FormRow cols={3}>
            {COLOR_FIELDS.map((c) => (
              <Field key={c.key} id={`colors.${c.key}`} label={c.label} hint={c.hint || undefined} error={err[`colors.${c.key}`]}>
                <ColorInput id={`colors.${c.key}`} name={`colors.${c.key}`} defaultValue={theme.colors[c.key]} invalid={!!err[`colors.${c.key}`]} />
              </Field>
            ))}
          </FormRow>
        </Card>

        <Card title="Fonts and shapes">
          <FormStack>
            <FormRow>
              <Field id="fonts.heading" label="Heading font">
                <Select id="fonts.heading" name="fonts.heading" defaultValue={theme.fonts.heading}>
                  {options.fonts.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="fonts.body" label="Body font">
                <Select id="fonts.body" name="fonts.body" defaultValue={theme.fonts.body}>
                  {options.fonts.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </FormRow>
            <FormRow>
              <Field id="radius" label="Corners">
                <Select id="radius" name="radius" defaultValue={theme.radius}>
                  {options.radii.map((r) => (
                    <option key={r} value={r}>
                      {RADIUS_LABELS[r] ?? r}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="buttonSize" label="Button size">
                <Select id="buttonSize" name="buttonSize" defaultValue={theme.buttonSize}>
                  {options.buttonSizes.map((b) => (
                    <option key={b} value={b}>
                      {b[0].toUpperCase() + b.slice(1)}
                    </option>
                  ))}
                </Select>
              </Field>
            </FormRow>
            <FormRow>
              <Field id="heroStyle" label="Top of the homepage">
                <Select id="heroStyle" name="heroStyle" defaultValue={theme.heroStyle}>
                  {options.heroStyles.map((h) => (
                    <option key={h} value={h}>
                      {HERO_LABELS[h] ?? h}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="productColumns" label="Products per row (desktop)">
                <Select id="productColumns" name="productColumns" defaultValue={String(theme.productColumns)}>
                  {[2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              </Field>
            </FormRow>
          </FormStack>
        </Card>

        <FormActions>
          <Button type="submit" loading={pending}>
            Save design
          </Button>
        </FormActions>
      </div>
    </form>
  );
}
