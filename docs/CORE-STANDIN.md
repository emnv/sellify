# Sellify Core (stand-in)

The trial brief assumes Sellify already holds each shop's inventory, sales, repair prices and
buyback prices. This repo has no real Sellify to connect to, so it includes the thinnest backend
the brief depends on. Everything in this list is **stand-in**, not a brief deliverable.

| Area | Why the brief needs it | Where it lives |
|---|---|---|
| Shops + membership, onboarding | Each store belongs to one shop; "each store only shows that shop's data" | `shops`, `shop_members`, `create_shop()` |
| Device catalog (brands, models, repair types) | Repair and Sell tabs pick brand → model | `device_brands`, `device_models`, `repair_types` |
| Inventory | Shop tab lists products; parts drive "same-day repair" | `products` |
| POS sale + sales list | "Sell the last iPhone in the shop → sold out online"; online orders appear as sales | `sales`, `sale_items`, `record_pos_sale()`, `finalize_online_sale()` |
| Repair prices + tickets | Repair tab prices and the ticket a booking creates | `repair_prices`, `repair_tickets` |
| Buyback prices + buybacks | Sell tab quote and the buyback a quote creates | `buyback_prices`, `buyback_settings`, `buybacks` |
| Shop settings | Contact details and the notification email | `shops` |

## How it is kept separate

- **Database:** `supabase/migrations/*_core_*.sql`. Store tables are in `*_stores_*.sql`.
- **Code:** `src/core/**` and backend pages under `src/app/(backend)/core/**`. In the sidebar they
  are grouped under *Sellify Core (stand-in)*.
- **The seam:** Stores code reaches Core only through `src/core/api.ts` (reads, and the shop behind
  a published store), `src/core/api-bookings.ts` (repair tickets and buybacks from the store) and
  `src/core/api-orders.ts` (online orders and stock). Swapping in the real Sellify means
  reimplementing those three files.
- **Public reads:** the `public_*` SQL functions (migration `20261009100000_stores_public_api.sql`)
  resolve a published store by slug or verified domain and return only its public data. Anonymous
  visitors can't read any Core table directly.

## Security model

- Row level security on every table. Members read and write only their own shop.
- Anonymous visitors cannot read any Core table directly. Public store pages go through
  security definer functions that take a store slug or host and return only that shop's
  published, visible data.
- Money is never taken from the client. `record_pos_sale()` reads prices from `products`, and
  locks and decrements stock in one transaction. `finalize_online_sale()` is callable only by the
  service role (the Stripe webhook).
