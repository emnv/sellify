-- =============================================================================
-- SELLIFY STORES: public read API for published stores.
-- Anonymous visitors call only these functions. Each one resolves a store by
-- slug or verified custom domain, refuses unpublished stores, and returns only
-- that shop's public data. Core tables stay closed to anon (see RLS).
-- =============================================================================

-- Store id for a slug (no dot) or a verified/active custom domain; null when
-- the store does not exist or is not published.
create or replace function private.published_store_id(p_key text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.id
  from public.stores s
  where s.is_published
    and (
      (position('.' in p_key) = 0 and s.slug = lower(p_key))
      or s.id = (
        select d.store_id from public.store_domains d
        where d.domain = lower(p_key) and d.status in ('verified', 'active')
      )
    )
  limit 1;
$$;

-- Store header: config, template, slug and the shop's currency/timezone.
create or replace function public.public_store(p_key text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'store_id', s.id,
    'slug', s.slug,
    'template', s.template,
    'config', s.published_config,
    'currency', sh.currency,
    'timezone', sh.timezone
  )
  from public.stores s
  join public.shops sh on sh.id = s.shop_id
  where s.id = private.published_store_id(p_key);
$$;

-- Products shown online. Live stock, never cached.
create or replace function public.public_products(p_key text, p_product_id uuid default null)
returns table (
  id uuid, name text, description text, category text, condition text,
  price_cents integer, stock_qty integer, images text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.name, p.description, p.category, p.condition, p.price_cents, p.stock_qty, p.images
  from public.products p
  join public.stores s on s.shop_id = p.shop_id
  where s.id = private.published_store_id(p_key)
    and p.visible_online
    and not p.is_part
    and (p_product_id is null or p.id = p_product_id)
  order by p.stock_qty = 0, p.updated_at desc
  limit 500;
$$;

-- Repair menu: every model/repair the shop has priced, with whether a part
-- is in stock (for "Same-day repair available").
create or replace function public.public_repair_options(p_key text)
returns table (
  brand_id smallint, brand text, model_id integer, model text, repair_type_id smallint,
  repair text, price_cents integer, duration_min integer, part_in_stock boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.name, m.id, m.name, rt.id, rt.name, rp.price_cents, rp.duration_min,
         exists (
           select 1 from public.products p
           where p.shop_id = rp.shop_id and p.is_part and p.stock_qty > 0
             and p.model_id = rp.model_id and p.repair_type_id = rp.repair_type_id
         )
  from public.repair_prices rp
  join public.stores s on s.shop_id = rp.shop_id
  join public.device_models m on m.id = rp.model_id
  join public.device_brands b on b.id = m.brand_id
  join public.repair_types rt on rt.id = rp.repair_type_id
  where s.id = private.published_store_id(p_key)
  order by b.sort_order, m.sort_order, rt.sort_order;
$$;

-- Appointment times already taken (no customer data), for the slot picker.
create or replace function public.public_booked_slots(p_key text, p_from timestamptz, p_to timestamptz)
returns setof timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select t.scheduled_at
  from public.repair_tickets t
  join public.stores s on s.shop_id = t.shop_id
  where s.id = private.published_store_id(p_key)
    and t.status <> 'cancelled'
    and t.scheduled_at >= p_from and t.scheduled_at < p_to
    and p_to - p_from <= interval '31 days';
$$;

-- Buyback menu: models/storage the shop buys, plus the condition deductions.
create or replace function public.public_buyback_options(p_key text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'prices', coalesce((
      select jsonb_agg(jsonb_build_object(
        'brand_id', b.id, 'brand', b.name, 'model_id', m.id, 'model', m.name,
        'storage_gb', bp.storage_gb, 'base_price_cents', bp.base_price_cents
      ) order by b.sort_order, m.sort_order, bp.storage_gb)
      from public.buyback_prices bp
      join public.device_models m on m.id = bp.model_id
      join public.device_brands b on b.id = m.brand_id
      where bp.shop_id = s.shop_id
    ), '[]'::jsonb),
    'deductions', (
      select jsonb_build_object(
        'screen_cracked_pct', bs.screen_cracked_pct,
        'battery_bad_pct', bs.battery_bad_pct,
        'no_power_pct', bs.no_power_pct
      )
      from public.buyback_settings bs where bs.shop_id = s.shop_id
    )
  )
  from public.stores s
  where s.id = private.published_store_id(p_key);
$$;

revoke execute on function private.published_store_id(text) from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array[
    'public.public_store(text)',
    'public.public_products(text, uuid)',
    'public.public_repair_options(text)',
    'public.public_booked_slots(text, timestamptz, timestamptz)',
    'public.public_buyback_options(text)'
  ] loop
    execute format('revoke execute on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated, service_role', f);
  end loop;
end $$;

-- One booking per appointment time per shop (online and walk-in alike).
create unique index repair_tickets_slot_uniq on public.repair_tickets (shop_id, scheduled_at)
  where status <> 'cancelled' and scheduled_at is not null;

-- Custom-domain lookups by host.
create index if not exists store_domains_domain_status_idx on public.store_domains (domain) where status in ('verified', 'active');
