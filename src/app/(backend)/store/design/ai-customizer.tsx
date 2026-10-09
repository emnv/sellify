"use client";

import { useActionState } from "react";
import { Button, Card, DetailList, Field, FormActions, FormStack, Notice, SubmitButton, Tag, Textarea } from "@/components/ui";
import { MAX_PROMPT_LENGTH } from "@/lib/ai/theme-schema";
import { STORE_FONTS, TEMPLATES, type StoreTheme } from "@/lib/store/config";
import { restyleWithAi, undoAiRestyle, type AiState } from "./ai-actions";

const RADIUS_LABELS: Record<string, string> = { none: "Square", small: "Slightly rounded", medium: "Rounded", large: "Very rounded", pill: "Pill" };
const COLOR_LABELS = [
  ["primary", "Main"],
  ["accent", "Accent"],
  ["background", "Background"],
  ["surface", "Cards"],
  ["text", "Text"],
] as const;

const fontLabel = (v: string) => STORE_FONTS.find((f) => f.value === v)?.label.replace(/ \(.*\)$/, "") ?? v;

type Props = {
  theme: StoreTheme;
  canUndo: boolean;
  remainingThisHour: number;
};

/** "Describe the look you want" → the AI rewrites the draft theme. Undo restores the previous one. */
export function AiCustomizer({ theme, canUndo, remainingThisHour }: Props) {
  const [restyle, restyleAction] = useActionState<AiState, FormData>(restyleWithAi, {});
  const [undo, undoAction, undoPending] = useActionState<AiState, FormData>(undoAiRestyle, {});

  // Show the outcome of whichever action ran last.
  const latest = (undo.nonce ?? 0) > (restyle.nonce ?? 0) ? undo : restyle;

  return (
    <Card
      title="Design with AI"
      description={`Describe the look you want and the AI changes your colours, fonts and layout in the draft. It can't touch your products, prices or stock. Uses OpenAI; each request costs Sellify well under one cent. ${remainingThisHour} requests left this hour.`}
    >
      <FormStack>
        {latest.error ? <Notice tone="danger">{latest.error}</Notice> : null}
        {latest.message ? (
          <Notice tone="success" title="Draft updated">
            {latest.message} Open the preview to check it, then publish.
          </Notice>
        ) : null}

        <form action={restyleAction} key={restyle.nonce}>
          <FormStack>
            <Field
              id="ai-prompt"
              label="Describe the look you want"
              hint='For example: "Make it look premium, black and gold, like an Apple store." or "Make the buttons bigger."'
            >
              <Textarea
                id="ai-prompt"
                name="prompt"
                rows={3}
                maxLength={MAX_PROMPT_LENGTH}
                required
                hasHint
                defaultValue={restyle.error ? restyle.prompt : ""}
                placeholder="Make it look premium, black and gold, like an Apple store."
              />
            </Field>
            <FormActions>
              <SubmitButton pendingText="Restyling…" disabled={remainingThisHour <= 0}>
                Restyle my store
              </SubmitButton>
            </FormActions>
          </FormStack>
        </form>

        <DetailList
          items={[
            {
              label: "Colours in the draft",
              value: (
                <span className="flex flex-wrap gap-2">
                  {COLOR_LABELS.map(([key, label]) => (
                    <Tag key={key}>
                      {label} {theme.colors[key]}
                    </Tag>
                  ))}
                </span>
              ),
            },
            { label: "Fonts", value: `${fontLabel(theme.fonts.heading)} headings, ${fontLabel(theme.fonts.body)} text` },
            { label: "Template", value: TEMPLATES.find((t) => t.value === theme.template)?.label ?? theme.template },
            { label: "Corners and buttons", value: `${RADIUS_LABELS[theme.radius] ?? theme.radius} corners, ${theme.buttonSize} buttons` },
          ]}
        />

        <form action={undoAction}>
          <FormActions>
            <Button href="/store/preview" variant="secondary" target="_blank" rel="noopener">
              Open preview
            </Button>
            <Button type="submit" variant="secondary" loading={undoPending} disabled={!canUndo}>
              Undo last AI change
            </Button>
          </FormActions>
        </form>
      </FormStack>
    </Card>
  );
}
