@AGENTS.md

# Sellify: rules for AI coding tools

Read `STATUS.md` for where the project is. The full plan is in `docs/implementation-plan.md`.

## Building backend pages (Part 1: mandatory)

Every page under `src/app/(backend)/` and `src/app/(auth)/` must look and behave like every other
one. The design rules are in `docs/brand/sellify-platform.md`.

1. **Use only `@/components/ui`.** It provides Button, SubmitButton, Pill, Tag, StatusBadge,
   FilterBar, FilterSearch, FilterPills, Field, Input, Textarea, Select, Switch, Checkbox,
   HiddenField, Table (THead, TBody, Tr, Th, Td, TableEmpty, TableFooter), Card, Modal, Page,
   PageHeader, Grid, DetailList, Notice, EmptyState and Skeleton.
   - Never write raw `<button>`, `<input>`, `<select>`, `<textarea>`, `<table>` or `<dialog>`.
     ESLint fails the build.
   - If a component is missing, add it to `src/components/ui/` with fixed variants, export it from
     `index.ts`, document it in the brand guideline, and then use it. Never create a one-off
     version inside a page.
2. **Use only tokens.** Colours: `primary`, `brand`, `fg`, `fg-muted`, `fg-subtle`, `surface`,
   `border`, `success-fg/bg`, `warning-fg/bg`, `danger-fg/bg`, `info-fg/bg`, `neutral-fg/bg`.
   Type: `text-title`, `text-heading`, `text-body`, `text-small`, `font-heading`.
   - The following are disabled or lint errors: hex colours, `bg-red-500`-style palette classes,
     arbitrary values (`p-[13px]`) and inline `style`.
3. **Page recipe:**
   ```tsx
   <Page>
     <PageHeader title="…" description="…" actions={<Button href="…">Add …</Button>} />
     <Suspense fallback={<Card><Skeleton lines={6} /></Card>}>
       <Content searchParams={searchParams} />   {/* async; calls requireShop() */}
     </Suspense>
   </Page>
   ```
   - Lists: `Card padding="none"` → `FilterBar` → `Table` → `TableFooter`.
   - Forms: one `Card` per topic, `FormStack` / `FormRow`, and `FormActions` with Cancel then the
     primary action.
   - Copy is sentence case. Buttons are verb + object. Errors say what to do. See the
     tone-of-voice section of the guideline.
   - New pages go in `src/app/(backend)/nav.ts`.
4. Check with `npm run lint && npm run typecheck`.

## Next.js 16 with Cache Components

- Anything that reads cookies, auth or shop data must sit inside `<Suspense>`. Pages are a static
  shell plus streamed content.
- `createClient()` from `@/lib/supabase/server` already calls `connection()`. Never put shop data
  in `"use cache"`. Only global reference data (the device catalog, `src/core/catalog.ts`) is
  cached.
- `proxy.ts` replaces middleware. `PageProps<"/route">` and `LayoutProps` are global types.
- React 19 resets a form after its action runs. Give fields `defaultValue={state.values?.x ?? …}`
  so they keep what the user typed.

## Data and security

- Every Server Action and data function calls `requireShop()` first and filters by `shop.id`.
  RLS is the backstop, not the only check.
- Money is integer cents. Use `formatMoney` / `parseMoneyToCents` from `@/lib/money`. Never trust
  a price sent by the client.
- Validate every form with zod on the server.
- `src/core/**` is the **Sellify Core stand-in**. Store features (`src/stores/**`,
  `src/app/(backend)/store/**`, `src/app/(store)/**`) reach Core only through `src/core/api.ts`.
- Schema changes: add a new file in `supabase/migrations/`, run `npx supabase db push --dry-run`,
  then push, then `npm run db:types`. Never edit an applied migration.
- Don't use the service-role client (`@/lib/supabase/admin`) in code a user's request can reach
  without a membership check.
