-- Stock-hold abuse limit: who opened a checkout, as a keyed hash of the
-- client network address (never the raw IP). Lets the server cap how many
-- checkouts one visitor can hold at the same time.
alter table public.sales add column client_hash text check (client_hash is null or client_hash ~ '^[0-9a-f]{32}$');
create index sales_client_hash_pending_idx on public.sales (shop_id, client_hash)
  where status = 'pending' and reserved_until is not null;
