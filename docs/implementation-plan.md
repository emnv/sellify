# Sellify Stores: implementation plan

## Context
The repo has only `sellify-plan.md` (the trial brief). The brief assumes there is already a Sellify backend (POS, inventory, repairs, buybacks). There isn't one. The user wants **every deliverable in the brief completed**, and any backend we have to add **kept clearly separate**, so they can tell the stand-in apart from the brief's deliverables.

### Separation rule: "Sellify Core (stand-in)" vs. brief deliverables
The **Core stand-in** is the thinnest backend the brief depends on:
- Inventory (products + parts)
- POS sale
- Sales list
- Repair prices and repair tickets
- Buyback prices and buybacks
- Shop settings

No dashboard and no extras.

How it stays separate:
- **Code:** `src/core/**` (lib + components specific to Core) and routes under `src/app/(backend)/core/**`. Brief deliverables live in `src/stores/**`, `src/app/(backend)/store/**`, `src/app/(store)/**`, plus the shared UI in `src/components/ui/**`.
- **Database:** `supabase/migrations/*_core_*.sql` (shops, catalog, products, sales, repairs, buybacks) and `*_stores_*.sql` (stores, design history, domains). Stores code only touches Core through a small interface in `src/core/api.ts`: read products/prices/stock, `record_sale`, `create_repair_ticket`, `create_buyback`. That file is the single seam to swap for the real Sellify.
- **Sidebar:** Core pages are grouped under a "Sellify Core (stand-in)" section.
- **Docs:** `docs/CORE-STANDIN.md` lists exactly what is stand-in and why the brief needs it.
- **Part 1 still applies to Core pages**, because they count as "existing pages" in the five-random-pages check.

Decisions confirmed with the user:
- **Stack:** Next.js (App Router) + TypeScript + Tailwind, Supabase (Postgres, Auth, Storage, RLS), deployed on Vercel.
- **Services:** Resend for email, Stripe Checkout in test mode, and OpenAI for the AI customizer.
- **Store addresses:** a domain the user owns, with Vercel nameservers and a wildcard. Set through the `STORES_ROOT_DOMAIN` env var. Stores live at `<slug>.<root>` and the backend at `app.<root>`.
- **GitHub:** the user creates an empty repo. Claude connects to it through the GitHub MCP server and the `gh` CLI, using a project-only token.
- **No account-level credentials.** The claude.ai Supabase and Vercel connectors and the user's global CLI logins must not be used. All credentials live in gitignored files inside this project.

---

## Phase 0: Project-local tooling config (done first, then hand over to the user)

Files to create:
| File | Committed? | Purpose |
|---|---|---|
| `.mcp.json` | **No** (gitignored) | Project MCP servers with real values: `supabase` (http `https://mcp.supabase.com/mcp?project_ref=<REF>` + header `Authorization: Bearer <SUPABASE_PAT>`), `vercel` (http `https://mcp.vercel.com`, OAuth only, so no token), `github` (http `https://api.githubcopilot.com/mcp/` + header `Authorization: Bearer <GITHUB_PAT>`) |
| `.mcp.example.json` | Yes | Same file with `<PLACEHOLDER>` values |
| `.claude/settings.json` | Yes | `enabledMcpjsonServers: ["supabase","vercel","github"]`; `permissions.deny: ["mcp__claude_ai_Supabase","mcp__claude_ai_Vercel","mcp__claude_ai_GitHub"]`; `deniedMcpServers: [{serverName:"claude.ai Supabase"},{serverName:"claude.ai Vercel"}]` |
| `.claude/settings.local.json` | **No** | `env` for the CLIs Claude runs: `SUPABASE_ACCESS_TOKEN`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `GH_TOKEN`, `GITHUB_REPO_URL` |
| `.env.local` / `.env.example` | No / Yes | App runtime: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID`, `STORES_ROOT_DOMAIN`, `APP_URL` |
| `.gitignore` | Yes | Ignores `.mcp.json`, `.claude/settings.local.json`, `.env*.local`, `.vercel` |
| `docs/SETUP.md` | Yes | The step-by-step guide below |

Facts verified against the docs:
- `.mcp.json` is project-scoped.
- A project server that uses the same URL as a claude.ai connector takes precedence over that connector.
- Vercel MCP is OAuth only.
- The Supabase MCP accepts a personal access token (PAT) as a Bearer header.
- The Supabase CLI reads `SUPABASE_ACCESS_TOKEN`.
- `gh` prefers `GH_TOKEN` over the stored login.

Git is set up with project-local settings only:
- `git init`
- a repo-local `credential.helper` that resets to empty, then `!gh auth git-credential`, so pushes use `GH_TOKEN` and never the Windows credential manager
- `remote origin = GITHUB_REPO_URL`

The Vercel CLI is always called with `--token $VERCEL_TOKEN`.

**What `docs/SETUP.md` (and my chat message) tells the user to do:**
1. **Supabase:** create a new project in the target org. Copy the project ref, the URL, the anon key and the service-role key. Create a PAT under Account → Access Tokens.
2. **Vercel:** create a token under Account → Tokens, scoped to the target team. Note the team ID. The Vercel project gets created later, from the GitHub repo.
3. **GitHub:** create an empty repo. Create a fine-grained PAT for that repo only with these permissions: Contents RW, Pull requests RW, Issues RW, Metadata R, Workflows RW.
4. **Stripe** (test mode keys), **Resend** (API key plus a verified sender domain, or `onboarding@resend.dev` for testing), **OpenAI** (API key).
5. **Domain:** move it to Vercel nameservers. The wildcard `*.<root>` and `app.<root>` get added to the Vercel project.
6. Fill in `.mcp.json`, `.claude/settings.local.json` and `.env.local`.
7. Reload VS Code / Claude Code, approve the project servers, and run `/mcp` → `vercel` → Authenticate. **Open the auth link in a private window logged into the project's Vercel account**, so it does not use the existing account.
8. Check with `/mcp`: `supabase`, `vercel` and `github` should be connected, and the claude.ai Supabase and Vercel connectors denied.

**I stop after Phase 0 and wait until the user confirms the config is filled in.** Until then I don't touch the claude.ai Supabase or Vercel tools.

---

## Phase 1: Foundation + Core stand-in data model (`*_core_*` migrations, `src/core/`)
- Scaffold with `create-next-app@latest` (TS, Tailwind, App Router, `src/`, ESLint). Add `@supabase/ssr`, `@supabase/supabase-js`, `zod`, `stripe`, `resend`, `openai`, `vitest`, `@playwright/test`.
- Supabase migrations in `supabase/migrations/`, applied with the Supabase CLI or the project MCP:
  - `shops` (name, email, phone, address), `shop_members` (shop_id, user_id, role), helper `is_shop_member(shop_id)` (security definer)
  - Global catalog (seeded): `device_brands`, `device_models` (with `storage_options int[]`), `repair_types`
  - `products` (shop_id, name, description, category, condition, price_cents, stock_qty, images text[], visible_online, is_part, model_id?, repair_type_id?)
  - `sales` (channel `pos|online`, status, totals, customer, stripe_session_id) + `sale_items`; RPC `record_sale(...)` decrements stock atomically and guards `stock_qty >= qty`
  - `repair_prices` (shop_id, model_id, repair_type_id, price_cents) and `repair_tickets` (customer, model, repair type, quoted price, scheduled_at, status, source `walk_in|online`)
  - `buyback_prices` (shop_id, model_id, storage_gb, base_price_cents), `buyback_settings` (shop_id, deduction % for screen cracked / battery not OK / doesn't turn on), `buybacks` (customer, model, storage, answers jsonb, offer_cents, handover, status)
  - `stores` (shop_id unique, slug unique, is_published, template, draft_config jsonb, published_config jsonb, published_at), `store_design_history` (for AI undo), `store_domains` (domain, status, verification jsonb, checked_at)
  - Storage bucket `shop-media`. Object paths are prefixed with `shop_id`, and RLS allows members only.
- RLS on every table: members read and write their own shop. Public (anon) access only through security-definer RPCs that take a store slug/host and return only that shop's published, visible data.
- Supabase clients in `src/lib/supabase/{server,client,admin}.ts`. Admin uses the service role and is server-only.
- Auth: email/password signup → onboarding (create a shop) → backend.

## Phase 2: Part 1, Sellify platform brand + shared components + every backend page
- Based on sellify.market. The scrape found: teal `#14B8A6` (primary button), purple `#9333EA`/`#7C3AED` (brand), Plus Jakarta Sans and Roboto, 4px base unit, 8–12px radius. Download the logo into `public/brand/`.
- `docs/brand/sellify-platform.md`: colours with exact codes (primary, brand, success, warning, error, backgrounds, text), the type scale (page title / section heading / body / small), spacing, radius, shadows, layout (max width, 240px sidebar, standard page = PageHeader → FilterBar → content Card/Table), logo use, and tone of voice for buttons and messages.
- Tokens as Tailwind `@theme` variables in `src/app/globals.css`. Fonts through `next/font`.
- `src/components/ui/`: `Button`, `Pill`/`Tag`, `FilterBar`, `Input` (+Textarea, Field), `Select` (dropdown), `Table`, `Card`, `Modal`, `StatusBadge`, `PageHeader`, plus the shell pieces the pages need (`AppShell`/`Sidebar`, `Switch`). Each component has fixed variants and sizes: no free-form className for colour or size.
- Enforcement: an ESLint `no-restricted-syntax` rule in `src/app/(backend)/**` that bans raw `<button>`, `<input>`, `<select>`, `<table>` and hex colours.
- Core stand-in pages under `src/app/(backend)/core/`, all built from the shared components:
  - Inventory (list, filter, add/edit, photo upload)
  - POS (new sale, which reduces stock)
  - Sales (list, POS and online)
  - Repair tickets (list + status)
  - Repair prices
  - Buybacks (list + status)
  - Buyback prices + condition deductions
  - Settings (shop profile, notification email)
- Online Store pages (Phase 3) use the same components.
- `CLAUDE.md` at the root: always use `src/components/ui/*` and tokens, the page-layout recipe, no new one-off styles, and where the brand doc is.

## Phase 3: Online Store, 2.1 Publish + 2.5 Editing (priority 2)
- Host routing in Next middleware/`proxy.ts` (whichever the installed Next version uses):
  - `app.<root>`, `*.vercel.app` and localhost go to the backend.
  - `<slug>.<root>` (also `<slug>.localhost` in dev) or a verified custom domain is rewritten to `src/app/(store)/_s/[host]/...`.
  - The host is resolved through the RPC `resolve_store_host(host)`, which returns only published stores.
- Backend `Online Store` pages (`src/app/(backend)/store/...`):
  - General: store name, slug, logo upload, a **Publish/Unpublish switch**, and the live URL
  - Design: template, colours, fonts
  - Content: banner, about text, contact details, opening hours
  - Tabs: show/hide Shop, Repair, Sell
  - Domain (Phase 7)
  - AI (Phase 8)
- Edits go to `draft_config` only. **Preview** opens `/store/preview` (auth, renders `draft_config`). **Publish** copies draft → `published_config` and sets `is_published`. Public pages only ever read `published_config`.
- Store config schema: one zod schema in `src/lib/store/config.ts`, split into `theme` (design) and `content`. It is the single source used by the editor, preview, publish and AI.

## Phase 4: 2.3 Repair tab + 2.4 Sell tab (priority 3)
- **Repair:**
  - Brand → model → repair type, from the shop's `repair_prices`.
  - Price shown from the DB.
  - "Same-day repair available" when a matching `is_part` product has `stock_qty > 0`.
  - Date/time picker: hourly slots inside opening hours over the next 14 days, minus slots that already have a ticket.
  - Customer name, phone and email.
  - A server action re-validates with zod, re-reads the price, creates the `repair_ticket` (source `online`) and sends Resend emails to the shop and the customer.
- **Sell:**
  - Brand → model → storage, then condition questions (screen cracked? battery OK? turns on?).
  - Quote = `base_price` minus the deductions, computed **server-side** in `src/lib/buyback/quote.ts`. The client only sends its selections, never a price. The price is recomputed on submit.
  - Accept → "drop in to shop" → creates a `buyback`, then emails both sides.
- Emails: `src/lib/email/` with plain templates.

## Phase 5: 2.2 Shop tab + checkout (priority 4)
- Product listing, product page (photos, price, stock, "Sold out"), and a basket kept in a cookie or localStorage holding only product IDs and quantities.
- Checkout:
  - A server route re-reads prices and stock from the DB, creates a pending `sale` (channel `online`) and a Stripe Checkout Session (test mode).
  - The webhook `/api/stripe/webhook` verifies the signature, then calls `record_sale`, which decrements stock atomically and marks the sale paid. If stock ran out, it refunds through Stripe and marks the sale cancelled.
  - The order shows in Sales.
- Store pages render dynamically (no caching of stock), so a POS sale shows as sold out immediately.

## Phase 6: 2.6 Three templates (priority 5)
- `src/components/store/templates/{clean,bold,local}/`: **Clean** (white, minimal), **Bold** (dark, large photos), **Local** (friendly; map embed from the address and reviews up front, entered as content).
- All three render the same `published_config.content` and the same live data. Switching only changes `template` and the default theme. Content is kept.

## Phase 7: 2.8 Custom domain (priority 5)
- Connect domain → Vercel REST API: `POST /v10/projects/{id}/domains`.
- Show DNS records from `GET /v6/domains/{domain}/config` and the project-domain verification records (A `76.76.21.21` for an apex domain, CNAME `cname.vercel-dns.com` for a subdomain, plus TXT if verification is needed).
- **Check status** button → `POST /v9/projects/{id}/domains/{domain}/verify` + config check. Status pill: Pending DNS / Verified / Active (HTTPS).
- Vercel issues HTTPS automatically. Remove domain is supported. Host routing picks up verified domains.

## Phase 8: 2.7 AI customizer (priority 6)
- Text box → server action → OpenAI Structured Outputs with a JSON schema that contains **only** the `theme` fields (colours, fonts from an allowed list, radius, button size, layout options, template).
- The result is validated by the theme zod schema and merged into `draft_config.theme` only. The previous theme is pushed to `store_design_history`, which gives **Undo**.
- Follow-up prompts ("make the buttons bigger") send the current theme as context. The preview updates, then the owner publishes.
- Cannot touch prices, stock or other shops: no data access in the prompt or tool, and server-side whitelisting plus a shop_id scope.
- `OPENAI_MODEL` env var. At implementation I check current OpenAI models and pricing, then document the chosen model and cost per use (about 1–2k tokens in and out) in `docs/ai-customizer.md`.

## Phase 9: 2.9 Demo store (priority 2 outcome, done last)
- `docs/brand/demo-store-fixit-galway.md`: a separate guideline (logo SVG, colours, fonts, tone), distinct from Sellify's.
- Sign up as that shop on the **deployed** app and do everything through the backend UI (driven via the browser, not seeded SQL):
  - logo, template, colours, banner, content and hours
  - demo products with photos, repair prices + parts, buyback prices + deductions
  - Publish
- Verify the live store at `fixitgalway.<root>`: book a repair, get a buyback quote, and buy a product with a Stripe test card.

## Deployment
- Push to GitHub after each phase.
- Create the Vercel project from the repo (project-scoped Vercel MCP or a CLI call with the token) and set the env vars.
- Add the domains `app.<root>` and `*.<root>`, and the Stripe webhook pointing at the production URL.

## Verification
- After each phase: `npm run lint`, `npm run typecheck`, `npm run build`.
- Vitest units:
  - buyback quote
  - slot generation
  - store config / AI theme whitelist (rejects price or stock keys)
  - host resolution
  - basket total
- RLS checks: SQL tests with two shops, confirming shop A can't read shop B and anon sees only published data.
- Playwright e2e:
  - publish/unpublish
  - draft vs published
  - template switch keeps content
  - repair booking → ticket + email call
  - buyback with a tampered price → server price wins
  - checkout → webhook (Stripe CLI or a signed test event) → stock reduced + sale shown
  - POS sale → store shows sold out
- Part 1 check: open five random backend pages and confirm identical pill, button and spacing styles (Chrome DevTools screenshots).
- End to end on production: the demo store's three tabs work live.
