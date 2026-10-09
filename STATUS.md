# Project status

Last updated: 2026-10-09 · Branch `main` · **All phases done; live in production.**

- **Production:** https://sellify-lemon.vercel.app (backend). Every push to `main` deploys automatically.
- **Demo store:** https://sellify-lemon.vercel.app/s/fixit-galway
- **Demo owner login:** `DEMO_EMAIL` / `DEMO_PASSWORD` in your local `.env`.
- **Plan:** [docs/implementation-plan.md](docs/implementation-plan.md) · **Brief:** [sellify-plan.md](sellify-plan.md)

## Progress

| Phase | What | Status |
|---|---|---|
| 0 | Project-local tooling (MCP, CLI tokens, env) | ✅ |
| 1 | Foundation, Core stand-in data model, auth, onboarding | ✅ |
| 2 | Part 1: brand guideline, shared UI kit, every backend page, enforcement | ✅ |
| 3 | 2.1 Publish + 2.5 Editing (draft, preview, publish, host routing) | ✅ |
| 4 | 2.3 Repair tab + 2.4 Sell tab (+ emails) | ✅ |
| 5 | 2.2 Shop tab + Stripe checkout + webhook | ✅ |
| 6 | 2.6 Three templates (Clean, Bold, Local) | ✅ (built into the renderer) |
| 7 | 2.8 Custom domain (ownership TXT proof + Vercel API) | ✅ (not live-tested with a real domain) |
| 8 | 2.7 AI customizer | ✅ code · ⚠️ OpenAI account has no credits, so not live-tested |
| 9 | 2.9 Demo store "FixIt Galway", built through the backend UI | ✅ live |
| — | Deployment (Vercel env, Supabase auth URLs, Stripe webhook) | ✅ |

## Verified on production (2026-10-09)

- **Repair:** Apple → iPhone 12 → Screen replacement shows **€129** and "Same-day repair
  available". Booked Thu 14:00, and the ticket appears in Repair tickets.
- **Sell:** Galaxy S21 128GB with a cracked screen shows **€140**. Accepting creates a buyback.
- **Shop:** clear case → basket → Stripe test card → order confirmed. The sale shows as Online,
  Paid, and stock went from 20 to 19.
- **Emails:** sending runs but isn't delivered to these addresses (see Open items).

## Added 2026-10-10 (your yes-to-all)

- **Checkout:** stock held for the 30-minute payment window. It is released on expiry, cancel or the daily cron. Limits: 3 open checkouts per visitor (keyed hash of the network address) and 50 per store.
- **Phone and fulfilment:** phone collected at Stripe Checkout. Customers choose **collection or delivery**; the delivery fee is set in Settings → Online orders, and the address is collected by Stripe (IE and GB).
- **Stripe Connect:** shops connect their own account in Settings → Online payments. These are direct charges, because the platform account is in Australia and destination charges can't pay out across regions. `PLATFORM_FEE_BPS` sets the platform fee. **Connect isn't enabled on the Stripe account yet**, so unconnected shops are charged on the platform account (`PLATFORM_CHARGES_FALLBACK`, default on).
- **Repairs:** "Repairs per time slot" setting; bookings are atomic per slot. The ticket list shows upcoming first (Upcoming / Past / All), and notes are kept as a history.
- **Domains:** owner-only. The `www.` address is added as a 308 redirect to the bare domain. Domains are re-checked daily.
- **Crons** (`vercel.json`, daily): `/api/cron/reservations` at 04:00 UTC and `/api/cron/domains` at 06:00 UTC, both protected by `CRON_SECRET`.
- **Demo store:** delivery at €5 and 2 repairs per slot, set through the UI with `demo/configure-orders.mjs`. A delivery order was tested live and paid.

## Where things are

| What | Where |
|---|---|
| Part 1 brand guideline | `docs/brand/sellify-platform.md` |
| AI rules file | `CLAUDE.md` |
| Shared UI kit | `src/components/ui` |
| Demo store guideline + logo | `docs/brand/demo-store-fixit-galway.md`, `docs/brand/fixit-galway-logo.svg` |
| Store config schema (editor, preview, publish, AI) | `src/lib/store/config.ts` |
| Store renderer and templates | `src/components/store/*` |
| Routes | `src/app/(store)/s/[key]` (public), `src/app/(preview)` (draft preview), `src/app/(backend)/store/*` (editor) |
| Core stand-in and the seam | `src/core/*`, `docs/CORE-STANDIN.md` (the seam = `src/core/api*.ts`) |
| AI customizer notes and cost | `docs/ai-customizer.md` |
| Demo build scripts | `demo/make-images.mjs`, `demo/build-fixit-galway.mjs [baseUrl]` |
| Copy env to Vercel | `scripts/vercel-env-sync.mjs` (stores secrets as Sensitive) |

## Tests

| Command | What it runs |
|---|---|
| `npm test` | 150 tests: units, RLS, checkout, repairs integration |
| `npm run test:e2e` | Part 1 consistency across all backend pages, plus a duplicate-id check. Needs the dev server. |
| `RUN_AI_LIVE=1 npx vitest run src/lib/ai/customizer.live.test.ts` | Live AI smoke test (needs OpenAI credits) |

## Open items / decisions

See the end-of-build summary for the full list. Short version:

- [ ] **Emails:** verify a sending domain in Resend and set `EMAIL_FROM`. Until then Resend only
  delivers to the Resend account owner. The same applies to Supabase sign-up emails (built-in
  mailer: 2 per hour).
- [ ] **OpenAI:** add credits, then run the live AI test.
- [ ] **Store domain:** buy a domain for `<slug>.<root>` addresses, or keep `/s/<slug>`.
- [ ] **Stripe Connect:** enable Connect in the Stripe Dashboard (test mode) to accept its terms.
  Then each shop clicks "Connect Stripe" in Settings. Once all shops are connected, set
  `PLATFORM_CHARGES_FALLBACK=false`.
- [ ] **Vercel Skew Protection:** turn it on (Project → Settings → Advanced). It stops a cached page
  from an older deploy talking to the new server for a few minutes after each deploy.

## Continue on another device

1. Clone the repo and run `npm install`, then `npm approve-scripts unrs-resolver` if npm asks.
   Run `npx playwright install chromium` once.
2. Copy the gitignored secret files: `.env`, `.mcp.json`, `.claude/settings.local.json`.
3. Reload VS Code, approve the project MCP servers, then `/mcp` → `vercel` → Authenticate.
   **Note:** the Vercel MCP OAuth login doesn't currently cover this team. The CLI with
   `--token "$VERCEL_TOKEN" --scope "$VERCEL_ORG_ID"` works.
4. Point git at the project token (repo-local only):
   ```bash
   git config --local credential.helper ""
   git config --local --add credential.helper '!f() { test $1 = get && echo username=x-access-token && echo password=$GH_TOKEN; }; f'
   ```
5. Link the CLIs:
   ```bash
   npx supabase link --project-ref "$SUPABASE_PROJECT_REF" -p "$SUPABASE_DB_PASSWORD"
   npx vercel link --project sellify --yes --token "$VERCEL_TOKEN" --scope "$VERCEL_ORG_ID"
   ```
6. Check: `npm run typecheck && npm run lint && npm test && npm run build`.

## Gotchas

- **Next 16 keeps up to 3 visited pages in the DOM, hidden.** Element ids must be unique app-wide;
  the e2e test checks this.
- **After editing `@theme` in `globals.css`,** restart the dev server with a clean `.next`, because
  Turbopack can serve stale CSS. Store theme tokens must stay in `@theme inline`.
- **Database changes:** add a new migration, run `npx supabase db push --dry-run`, then push, then
  `npm run db:types`.
- **Don't run `npm run build` while `npm run dev` is running.** They share `.next`.
