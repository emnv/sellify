# Project status

Last updated: 2026-10-09 · Branch `main`

The full plan is in [docs/implementation-plan.md](docs/implementation-plan.md), and the brief is in [sellify-plan.md](sellify-plan.md).

## Progress

| Phase | What | Status |
|---|---|---|
| 0 | Project-local tooling (MCP, CLI tokens, env) | ✅ Done |
| 1 | Foundation + Core stand-in data model, auth, onboarding | ✅ Done |
| 2 | Part 1: Sellify brand guideline, shared UI components, all backend pages | ✅ Done |
| 3 | 2.1 Publish + 2.5 Editing (host routing, store settings, draft/preview/publish) | ⏭️ **Next** |
| 4 | 2.3 Repair tab + 2.4 Sell tab (+ emails) | ⬜ Not started |
| 5 | 2.2 Shop tab + Stripe checkout + webhook | ⬜ Not started |
| 6 | 2.6 Three templates (Clean, Bold, Local) | ⬜ Not started |
| 7 | 2.8 Custom domain (Vercel API) | ⬜ Not started |
| 8 | 2.7 AI customizer | ⬜ Not started |
| 9 | 2.9 Demo store "FixIt Galway", built through the UI | ⬜ Not started |
| — | Deployment to Vercel (env vars, Stripe webhook, auth redirect URLs) | ⬜ Not started |

## What exists now (Phase 2: Part 1)

- **Brand guideline:** `docs/brand/sellify-platform.md` (colours with codes, type, spacing, corners,
  shadows, layout, components, logo, tone of voice). **Rules for AI tools:** `CLAUDE.md`.
- **Tokens:** `src/app/globals.css`. Tailwind's default palette, sizes, radii and shadows are
  removed; only Sellify tokens exist. Primary buttons use the darker teal `#0F766E`, because
  Sellify's `#14B8A6` with white text fails contrast (reason in the guideline).
- **Shared components:** `src/components/ui`, about 30 (Button, Pill, ChoiceGroup, StatusBadge,
  FilterBar, Field/Input/Select, Table, Card, Modal, PageHeader, AppShell, …). No `className` or
  `style` props.
- **Enforcement:** ESLint fails on raw controls, hex colours, palette classes, arbitrary values and
  inline styles in backend pages. `npm run test:e2e` opens all 10 backend pages and fails if
  pills, buttons, titles, inputs or page spacing differ (passing).
- **Backend pages (all built from the kit):** login, sign-up, onboarding; Core stand-in:
  - Inventory (list, add, edit, delete, photo upload)
  - Point of sale
  - Sales (list, detail)
  - Repair tickets (list, new walk-in, detail with status)
  - Repair prices
  - Buybacks (list, detail with status)
  - Buyback prices + condition deductions
  - Settings
- **Helpers:**
  - `src/lib/money.ts`
  - `src/lib/datetime.ts` (shop timezone)
  - `src/core/catalog.ts` (cached device catalog)
  - `src/components/media/image-uploader.tsx`
  - `scripts/dev-user.mjs` (create or delete a confirmed test user)
- **Buyback offer formula:** `computeOffer` in `src/core/buybacks.ts`. Deductions are added
  together and capped at 100%. The Sell tab (Phase 4) must use the same function.

## Phase 1 foundation

**Database** (Supabase project `olsshrwrrbjwyuujrhub`, migrations in `supabase/migrations/`, all applied):
- Core stand-in tables:
  - shops, shop_members, `create_shop()`
  - device catalog: 3 brands, 24 models, 6 repair types
  - products
  - sales, sale_items, `record_pos_sale()`, `finalize_online_sale()`
  - repair_prices, repair_tickets
  - buyback_prices, buyback_settings, buybacks
- Stores tables: stores, store_design_history, store_domains.
- Row-level security on every table. Membership helpers live in the `private` schema, so they aren't reachable through the database API.
- `shop-media` storage bucket: public read. Members can write only to `<shop_id>/...`. No SVG uploads.
- Members can write only these columns on `stores`: `slug`, `template`, `draft_config`. Publish columns are written by the server only, with the service role.

**App** (Next.js 16.4, App Router, Cache Components on, Tailwind 4):
- Supabase clients: `src/lib/supabase/{server,client,admin,proxy}.ts`. Generated types: `database.types.ts`.
- `src/proxy.ts`: refreshes the session and redirects signed-out visitors to `/login?next=…`.
- Auth: `src/lib/auth.ts` (`getCurrentUser`, `requireUser`) and `src/core/shop.ts` (`getCurrentShop`, `requireShop`).
- Pages:
  - `/login`, `/signup`
  - `/auth/confirm` (email link)
  - `/onboarding` (create shop)
  - `/`: redirects to `/core/inventory` (no dashboard; Phase 3 points it at Online Store)
- `src/lib/safe-next.ts`: guard against open redirects after login.

**Tests:** `npm test` runs 41 tests, and `npm run test:e2e` runs the Part 1 Playwright check (it needs the dev server).
- `src/lib/safe-next.test.ts`: unit tests.
- `tests/rls.test.ts`: integration tests against the real Supabase project. They create two throwaway shops and delete them afterwards.

**Docs:** `docs/CORE-STANDIN.md` explains what is stand-in and why.

## Decisions to remember

- **Cache Components stays on.** It becomes the default in the next Next.js major version. Pages are a static shell, and request data sits behind `<Suspense>` or `loading.tsx`. The server Supabase client calls `connection()`, so shop data is never prerendered or cached.
- **Next.js 16.4 differs from older versions:**
  - `proxy.ts` replaces middleware.
  - `PageProps` / `LayoutProps` are global types created by `next typegen`.
  - Read `node_modules/next/dist/docs/` before using an unfamiliar API (see `AGENTS.md`).
- **No domain yet** (`STORES_ROOT_DOMAIN` is empty), so stores will live at `/s/<slug>`.
- **Database changes:** always add a new migration file. Run `supabase db push --dry-run` first, then `supabase db push`. Never edit migrations that were already applied.
- **Phase 3 rule:** the store renderer must parse `published_config` with the zod config schema on every read, and treat it as untrusted.

## Open items / to do at deploy time

- [ ] **Supabase auth emails** use the built-in mailer, which sends at most 2 per hour. Switch to Resend.
- [ ] **Supabase auth redirect allow-list** is empty. Add the Vercel URL and `http://localhost:3000/**`.
- [ ] **Vercel production URL** is `sellify-everscripts-projects-7be08f94.vercel.app`. The plan names `sellify-lemon.vercel.app`. Confirm which one is public and set `APP_URL`.
- [ ] Stripe webhook endpoint and `STRIPE_WEBHOOK_SECRET` (Phase 5).
- [ ] Choose `OPENAI_MODEL` and document cost per use in `docs/ai-customizer.md` (Phase 8).

## Continue on another device

1. Clone the repo, then run `npm install`.
   - If npm asks about install scripts, run `npm approve-scripts unrs-resolver`.
2. **Copy these gitignored files from the old device.** They hold the secrets and are not in git:
   - `.env`: app runtime keys
   - `.mcp.json`: Supabase and GitHub MCP tokens
   - `.claude/settings.local.json`: CLI tokens (Supabase, Vercel, GitHub) and the database password
3. Reload VS Code. Approve the project MCP servers (`supabase`, `vercel`, `github`), then run `/mcp` → `vercel` → Authenticate.
   - Open the auth link in a private window logged into the project's Vercel account.
4. Point git pushes at the project token (repo-local only):
   ```bash
   git config --local credential.helper ""
   git config --local --add credential.helper '!f() { test $1 = get && echo username=x-access-token && echo password=$GH_TOKEN; }; f'
   ```
5. Link the Supabase CLI:
   ```bash
   npx supabase link --project-ref "$SUPABASE_PROJECT_REF" -p "$SUPABASE_DB_PASSWORD"
   ```
6. Check everything works with `npm run typecheck && npm run lint && npm test && npm run build`. Then run `npm run dev`.
7. To resume, tell Claude: *"Read STATUS.md and docs/implementation-plan.md, then start Phase 3."*
8. For the e2e test, run once: `npx playwright install chromium`.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on http://localhost:3000 |
| `npm run typecheck` | `next typegen` + `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest (unit + RLS integration) |
| `npm run build` | Production build |
| `npm run db:types` | Regenerate `src/lib/supabase/database.types.ts` after a migration |
| `npx supabase db push --dry-run -p "$SUPABASE_DB_PASSWORD"` | Preview pending migrations |
