# Sellify Stores: a 10-minute explainer

A talk track for walking someone through how the app is built. Times are cumulative. Lines in
*italics* are suggested things to say; **Show:** lines are what to open on screen.

---

## 0:00 – 0:45 · What we built

*"Sellify Stores lets a phone repair shop publish its own online store from inside Sellify in a
few clicks. The store has three tabs, Shop, Repair and Sell, all reading live from the shop's
Sellify data. The owner can change the design, pick one of three templates, use an AI designer,
and connect their own domain. To prove it works, I built a demo shop, FixIt Galway, entirely
through the backend, and it's live."*

**Show:** https://sellify-lemon.vercel.app/s/fixit-galway, then the backend at `/store`.

*"The brief assumed an existing Sellify backend with inventory, repairs and buybacks. There
isn't one here, so I built the thinnest possible stand-in, which I call **Sellify Core**, and
kept it clearly separate, so it can be swapped for the real system."*

---

## 0:45 – 2:30 · The stack, and why

| Layer | Choice | Why |
|---|---|---|
| App | **Next.js 16** (App Router, Server Components, Server Actions), **TypeScript**, **React 19** | One codebase for the backend, the public stores and the API. Server Actions let forms post straight to typed server functions. |
| Styling | **Tailwind CSS 4** with design tokens | The design system lives in `globals.css` as tokens (see Standards). |
| Data and auth | **Supabase**: Postgres, Auth, Storage, Row Level Security | Real SQL for money and stock (transactions, locks); RLS so the database itself enforces "a shop only sees its own data". |
| Validation | **zod** | Every form and server action re-validates its input on the server. |
| Payments | **Stripe Checkout** (test mode) + webhooks, **Stripe Connect** (direct charges) | Hosted, PCI-safe checkout; each shop can be paid into its own account. |
| Email | **Resend** | Booking, buyback and order confirmations. |
| AI | **OpenAI**, Structured Outputs | The AI may only return design settings that match a schema. |
| Hosting | **Vercel** (+ Vercel REST API for custom domains, Vercel Cron) | Preview and production deploys from GitHub, wildcard and custom domains, automatic HTTPS. |
| Tests | **Vitest** (unit + integration against the real database), **Playwright** (end-to-end) | 150 tests. |

*"One Next.js 16 point worth mentioning: Cache Components is on. Pages are a fast static shell,
and anything per-user or live (stock, bookings) streams in behind `<Suspense>`. Shop data is
never cached, so a POS sale shows as sold out online straight away."*

---

## 2:30 – 5:00 · Architecture and patterns

### 1. Three apps in one, split by route groups
**Show:** `src/app/`

```
src/app/(auth)/      login, sign-up, onboarding
src/app/(backend)/   the shop's Sellify backend: /store/* (Stores editor) and /core/* (Core stand-in)
src/app/(store)/     the public store: /s/[key]/… (Shop, Repair, Sell, basket, order)
src/app/(preview)/   the owner's draft rendered with the real store components
src/proxy.ts         routing by host: app host, <slug>.<root>, or a custom domain
```

*"`proxy.ts` (Next 16's replacement for middleware) looks at the hostname. On a store subdomain
or a verified custom domain it rewrites the request to the same store routes. Today we serve
stores at `/s/<slug>`, and switching to subdomains is one environment variable."*

### 2. The Core seam
**Show:** `src/core/api.ts` (top comment), then `docs/CORE-STANDIN.md`

*"Everything stand-in lives in `src/core` and in `*_core_*` migrations. Store features reach Core
**only** through three files: `api.ts` for reads, `api-bookings.ts` for repairs and buybacks,
and `api-orders.ts` for orders and stock. To plug in the real Sellify, you reimplement those
three files and nothing else changes."*

### 3. Draft → validated → published
**Show:** `src/lib/store/config.ts` (the `storeConfigSchema`), then `publishStore()` in `src/stores/store.ts`

*"A store's look and content is one JSON config, defined by one zod schema split into `theme` and
`content`. The editor, the preview, publish, the public renderer and the AI all use that same
schema. Edits only ever touch `draft_config`. Publishing validates the draft and copies it to
`published_config` on the server. Shop members can't write the published columns at all; I
removed that permission in the database, so nobody can skip validation by calling the API
directly."*

### 4. Public data comes through narrow SQL functions
**Show:** `supabase/migrations/20261009100000_stores_public_api.sql`

*"Anonymous visitors can't read any table. The public store calls functions like
`public_products(key)`. Each one resolves a **published** store by slug or verified domain and
returns only that shop's public fields. So even an application bug can't leak another shop's
data, because the database won't hand it out."*

### 5. Server-side truth for money
*"Rule: the browser never sends a price. Baskets hold product ids and quantities only. Every
price is re-read from the database at checkout, in the Stripe session and in the webhook. Stock
changes happen in SQL functions that lock the rows (`record_pos_sale`, `reserve_online_sale`,
`finalize_online_sale`). The feature I'll show you in a minute is the clearest example."*

---

## 5:00 – 6:15 · Standards

1. **A design system enforced by tooling, not by good intentions** (Part 1 of the brief).
   - **Brand guideline:** `docs/brand/sellify-platform.md`.
   - **Tokens:** `src/app/globals.css` removes Tailwind's default palette and sizes, so off-brand
     classes don't render.
   - **Shared components:** `src/components/ui` has about 30, with fixed variants.
   - **ESLint:** in `eslint.config.mjs`, it fails on a raw `<button>`, `<input>` or `<table>`, hex
     colours, made-up sizes and inline styles in backend pages.
   - **Part 1 check:** `e2e/part1-consistency.spec.ts` opens every backend page and fails if any
     pill, button, title, input or page spacing differs. This is the brief's "open five random
     pages" check, automated.
   - **Rules for AI tools:** `CLAUDE.md`.
2. **Security by default.**
   - Every Server Action calls `requireShop()` and scopes writes to that shop. RLS is the backstop.
   - Stripe webhooks verify their signatures.
   - A custom domain needs a DNS TXT record proving ownership before it can receive traffic.
   - Abuse limits on the public forms and on stock holds.
   - Secrets live only in gitignored files and in Vercel, marked Sensitive.
3. **Accessibility.** Real labels, `aria-pressed` on option buttons, and focus moves to each new
   step. Element ids are unique app-wide; there's a test for that, because Next 16 keeps visited
   pages hidden in the DOM.
4. **Database discipline.** Every change is a new migration file in git, applied as a dry run
   first, with generated TypeScript types.
5. **Tests close to the risk.**
   - Pure maths is unit-tested.
   - RLS, checkout, stock holds and booking capacity are tested against the real database with
     throwaway shops.
   - Playwright covers the end-to-end checks.

---

## 6:15 – 9:30 · Feature walkthrough: the Sell tab's buyback quote

**Why this one:** the brief says *"The customer must not be able to change the price."* This
feature shows how that guarantee holds at every layer.

**Demo first (30 s):** on the live store, Sell → Samsung → Galaxy S21 → 128 GB → screen cracked:
**Yes**, battery OK, turns on. The offer is **€140**: base €200 minus 30% for the cracked screen.

Then follow the request through the code:

### Step 1: the browser only knows what's for sale, not the prices
**Show:** `src/components/store/service-pages.tsx` → `SellPage`, line ~54

```ts
const choices: SellChoice[] = prices.map((p) => ({ brand_id: p.brand_id, brand: p.brand,
  model_id: p.model_id, model: p.model, storage_gb: p.storage_gb }));
```
*"The server loads the shop's buyback prices but strips `base_price_cents` before anything goes
to the client. The page knows which phones the shop buys, never what it pays for them."*

### Step 2: the client asks the server for the offer
**Show:** `src/components/store/sell-flow.tsx`, lines ~55–60

*"When all the answers are in, the client calls the Server Action `getQuote` with the selections
only (ids and yes/no) and shows whatever comes back."*

### Step 3: validate, then compute on the server
**Show:** `src/app/(store)/s/[key]/sell/actions.ts`, `getQuote` at line ~35

- `selectionSchema.safeParse(selection)` comes first: ids must be numbers and answers must be yes or no.
- Then `quoteOnlineBuyback(...)` is called. That's the **Core seam**, not a database call from the UI.

### Step 4: the seam reads prices from the database
**Show:** `src/core/api-bookings.ts`
- `resolveShop` (line ~31): the store must be **published** and its **Sell tab enabled**.
- `quoteFor` (line ~166): reads `buyback_prices` and `buyback_settings` **for that shop only**,
  then calls `computeOffer(...)` (line ~193).

### Step 5: one pure function owns the maths
**Show:** `src/lib/buyback/quote.ts`, `computeOffer`
*"Add up the deductions for each reported problem, cap at 100%, round to whole cents, never go
below zero. It's pure, so the backend, the store and the tests all share exactly the same
maths."*
**Show:** `src/lib/buyback/quote.test.ts`: edge cases like caps, rounding, negative and NaN
input, and the brief's example.

### Step 6: accepting recomputes everything
**Show:** `sell-flow.tsx`, lines ~235–241, then `acceptOffer` in `actions.ts` (line ~95)

```tsx
{/* Selections only. There is deliberately no price field: the server recomputes the offer. */}
```
*"The form posts the selections and the contact details. There is no price field to tamper
with. `acceptOffer` validates again and calls `createOnlineBuyback`, which recomputes the offer
from the database, checks the abuse limits, inserts the buyback for the right shop, and emails
the shop and the customer. If someone edits the page and posts a fake price, it's simply
ignored."*

### Step 7: it lands in Sellify
**Show:** backend → Buybacks: the new buyback, with its condition answers, offer and status.

*"So the price is computed in one place, from data the customer can't touch, and validated at
every boundary. The same pattern runs through repairs (price and slot recomputed on booking)
and checkout (prices, stock and delivery fee re-read, stock held in SQL, webhook-verified)."*

---

## 9:30 – 10:00 · Wrap-up

*"To sum up: Next.js 16 and Supabase on Vercel, with a clear seam between the store feature and
the Core stand-in. A design system enforced by lint and an automated consistency test. Security
pushed down into the database and the server. All of it proven live on the FixIt Galway demo
store. The open items are account-level: enable Stripe Connect, verify an email domain in
Resend, add OpenAI credits, and turn on Vercel Skew Protection."*

---

## If asked

| Question | Short answer |
|---|---|
| *Why Supabase and not an ORM?* | Row Level Security and SQL functions put the security and stock locking in the database, so a bug in app code can't bypass them. |
| *How do you stop overselling?* | `reserve_online_sale` takes the stock when checkout opens; `finalize_online_sale` marks it paid; an expired or abandoned checkout is released; and if stock is gone when payment completes, the customer is refunded automatically. |
| *How do templates keep content?* | A template only swaps the `theme` part of the config; `content` is untouched. |
| *How is the AI kept safe?* | Its output must match a strict schema that only has design fields; it's validated again on the server, written to the draft only, and can be undone. |
| *Custom domains?* | Ownership is proved with a TXT record; then the domain is attached through the Vercel API with `www.` redirecting to it; HTTPS is automatic and status is re-checked daily. |
| *How would this connect to the real Sellify?* | Reimplement `src/core/api.ts`, `api-bookings.ts` and `api-orders.ts`. |
