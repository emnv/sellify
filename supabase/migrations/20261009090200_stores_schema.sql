-- =============================================================================
-- SELLIFY STORES (brief deliverable)
-- One online store per shop. Edits go to draft_config; Publish copies it to
-- published_config. Public pages only ever read published_config, through
-- security definer RPCs added with the store renderer.
-- =============================================================================

create table public.stores (
  id               uuid primary key default gen_random_uuid(),
  shop_id          uuid not null unique references public.shops (id) on delete cascade,
  slug             text not null unique
                     check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$'
                            and slug !~ '--'
                            and slug not in ('app', 'www', 'api', 'admin', 'store', 'stores',
                                             'mail', 'static', 'assets', 'cdn', 'help',
                                             'support', 'status', 'sellify', 'dashboard')),
  is_published     boolean not null default false,
  template         text not null default 'clean' check (template in ('clean', 'bold', 'local')),
  draft_config     jsonb not null default '{}',
  published_config jsonb,
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (not is_published or published_config is not null)
);
create trigger stores_updated_at before update on public.stores
  for each row execute function public.set_updated_at();

-- Previous design (theme) states, so AI changes can be undone.
create table public.store_design_history (
  id         bigint generated always as identity primary key,
  store_id   uuid not null references public.stores (id) on delete cascade,
  theme      jsonb not null,
  template   text not null check (template in ('clean', 'bold', 'local')),
  prompt     text check (prompt is null or length(prompt) <= 1000),
  created_at timestamptz not null default now()
);
create index store_design_history_store_idx on public.store_design_history (store_id, id desc);

create table public.store_domains (
  id           uuid primary key default gen_random_uuid(),
  store_id     uuid not null references public.stores (id) on delete cascade,
  domain       text not null unique
                 check (domain = lower(domain)
                        and domain ~ '^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$'),
  status       text not null default 'pending' check (status in ('pending', 'verified', 'active', 'error')),
  verification jsonb,
  last_error   text,
  checked_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index store_domains_store_idx on public.store_domains (store_id);

-- Is the caller a member of the shop that owns this store?
create or replace function public.is_store_member(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.stores s
    join public.shop_members m on m.shop_id = s.shop_id
    where s.id = p_store_id
      and m.user_id = (select auth.uid())
  );
$$;
revoke execute on function public.is_store_member(uuid) from public, anon;
grant execute on function public.is_store_member(uuid) to authenticated;

alter table public.stores               enable row level security;
alter table public.store_design_history enable row level security;
alter table public.store_domains        enable row level security;

create policy "members manage their store" on public.stores
  for all to authenticated
  using (public.is_shop_member(shop_id))
  with check (public.is_shop_member(shop_id));

create policy "members manage design history" on public.store_design_history
  for all to authenticated
  using (public.is_store_member(store_id))
  with check (public.is_store_member(store_id));

-- Domain rows are written by server code (after calling the Vercel API) with
-- the service role; members can read them.
create policy "members read their domains" on public.store_domains
  for select to authenticated using (public.is_store_member(store_id));

revoke all on public.stores, public.store_design_history, public.store_domains from anon;
revoke insert, update, delete on public.store_domains from authenticated;

-- ---------------------------------------------------------------------------
-- Media bucket (product photos, store logos and banners)
-- Object paths start with the shop id: <shop_id>/<kind>/<file>.
-- Public read (images are shown on public stores); members-only write.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shop-media', 'shop-media', true, 5242880,
        array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

-- First path segment as a shop id, or null if it is not a uuid.
create or replace function public.media_path_shop_id(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(p_name, '/', 1)::uuid
  end;
$$;

create policy "members upload shop media" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'shop-media' and public.is_shop_member(public.media_path_shop_id(name)));
create policy "members update shop media" on storage.objects
  for update to authenticated
  using (bucket_id = 'shop-media' and public.is_shop_member(public.media_path_shop_id(name)))
  with check (bucket_id = 'shop-media' and public.is_shop_member(public.media_path_shop_id(name)));
create policy "members delete shop media" on storage.objects
  for delete to authenticated
  using (bucket_id = 'shop-media' and public.is_shop_member(public.media_path_shop_id(name)));
