-- Every AI customizer request, successful or not, for the per-store rate
-- limit. Separate from store_design_history, which Undo deletes from.
create table public.store_ai_requests (
  id            bigint generated always as identity primary key,
  store_id      uuid not null references public.stores (id) on delete cascade,
  created_at    timestamptz not null default now(),
  input_tokens  integer,
  output_tokens integer
);
create index store_ai_requests_store_created_idx on public.store_ai_requests (store_id, created_at desc);

alter table public.store_ai_requests enable row level security;

create policy "members read their AI requests" on public.store_ai_requests
  for select to authenticated using (private.is_store_member(store_id));
create policy "members record their AI requests" on public.store_ai_requests
  for insert to authenticated with check (private.is_store_member(store_id));

revoke all on public.store_ai_requests from anon;
revoke update, delete, truncate, references, trigger on public.store_ai_requests from authenticated;
