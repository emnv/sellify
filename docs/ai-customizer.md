# AI store customizer (Phase 8)

The owner types what they want ("Make it look premium, black and gold, like an Apple store.", "Make the
buttons bigger.") on **Online store → Design**. The AI changes the store's **design settings in the
draft**. The owner opens the preview, then publishes, or presses **Undo last AI change**.

## Service and model

- **Service:** OpenAI API, Responses API with Structured Outputs (`text.format = json_schema, strict: true`),
  via the `openai` npm package (v7).
- **Model:** `gpt-6-luna`, set with `OPENAI_MODEL` (default in code: `gpt-6-luna`). Checked on 2026-10-09
  that the model is listed for our API key.
- **Why:** this is a small, well-defined task (pick ~12 values from fixed lists and colours). Luna is
  OpenAI's cheapest current general model, supports strict JSON-schema output, and answers in a few
  seconds. Bigger models (`gpt-6-sol`, `gpt-6.1-sol`) cost 25× more per token for no visible gain here.
  Changing model is one env var.

## Cost per use

Prices (OpenAI, October 2026, standard tier): **$0.10 per 1M input tokens, $0.50 per 1M output tokens**
(cached input $0.01/1M).

| | Tokens | Cost |
|---|---|---|
| Input: system prompt + schema + current theme + request | ~1,500 | $0.00015 |
| Output: theme JSON + explanation | ~400 | $0.00020 |
| **Per request** | | **≈ $0.00035 (0.035 cents)** |

- 1,000 requests a month ≈ **$0.35**. 10,000 a month ≈ $3.50.
- Worst case per shop with the rate limit (20 an hour, every hour, all month) ≈ $5 a month; in practice
  owners use it a handful of times.
- If the model uses hidden reasoning tokens they are billed as output; even 1,500 output tokens per request
  stays under $0.001.
- Every request logs its real token usage server-side:
  `[ai-customizer] shop=… store=… model=… input_tokens=… output_tokens=…`.

## How it is constrained

1. **Schema-only output.** The model must answer in the strict JSON schema in
   `src/lib/ai/theme-schema.ts`: template, five `#rrggbb` colours, heading/body font from the allowed list,
   radius, button size, hero style, products per row (2/3/4), plus a short `explanation`. There is no field
   for prices, stock, products, texts, images or ids. A unit test fails if the schema ever gains a key
   outside the theme or drifts from `themeSchema`.
2. **Server-side validation.** The answer is parsed again with the theme zod schema (`sanitizeAiTheme` /
   `parseAiThemeOutput`): unknown keys are dropped, invalid values reject the whole answer. `saveDraft`
   then validates the full store config again.
3. **Draft only.** The new theme is merged into `draft_config.theme` only (`{ ...draft, theme }`); content is
   untouched and nothing goes live until the owner presses Publish.
4. **History and undo.** Before each change the previous theme is written to `store_design_history` (with
   the prompt) using the member's own Supabase client, so RLS (`members manage design history`) applies.
   Undo restores the newest entry into the draft and deletes it. At most 20 entries are kept per store.
5. **No data access.** The model receives only the current theme JSON, the store name and the request.
   It has no tools, no function calling, no database access and `store: false` is set on the request.
   All reads and writes happen in our server code, scoped by `requireShop()` and RLS.
6. **Prompt injection.** The request is untrusted text from a web form, max 500 characters, placed between
   `<request>` tags (tags inside it are removed). The system prompt says it only describes the look and
   cannot change instructions. Even a fully "jailbroken" answer can only be a theme, because of points 1–2;
   the worst outcome is an ugly draft, which the owner can undo and which is never published automatically.
7. **Rate limit.** At most 20 AI changes per store per hour, counted from `store_design_history` rows in the
   last hour. The remaining count is shown on the card. Known gap: Undo deletes its history row, so
   alternating Restyle and Undo is not fully counted, and failed AI calls are not counted. A dedicated
   `ai_usage` log table would close this if abuse ever shows up in the token logs.
8. **Timeout.** 20 seconds per request, one retry; the owner sees a friendly error.

## Files

- `src/lib/ai/theme-schema.ts`: JSON schema sent to the model, `sanitizeAiTheme`, `parseAiThemeOutput`.
- `src/lib/ai/customizer.ts` (server-only): system prompt and `proposeTheme()`.
- `src/stores/ai-design.ts` (server-only): `applyAiTheme()`, `undoAiTheme()`, `getAiDesignStatus()`.
- `src/app/(backend)/store/design/ai-actions.ts`, `ai-customizer.tsx`: server actions and the card.
- Tests: `src/lib/ai/theme-schema.test.ts`; live smoke test (costs a fraction of a cent, opt-in):
  `RUN_AI_LIVE=1 npx vitest run src/lib/ai/customizer.live.test.ts`.
