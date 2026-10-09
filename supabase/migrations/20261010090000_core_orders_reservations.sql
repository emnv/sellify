-- =============================================================================
-- Online orders: stock reservation during checkout, delivery/collection, and
-- per-shop payouts (Stripe Connect). SELLIFY CORE (stand-in) + Stores settings.
-- =============================================================================

-- Shop: fulfilment options, delivery fee, Stripe Connect account, repair capacity.
alter table public.shops
  add column collection_enabled     boolean  not null default true,
  add column delivery_enabled       boolean  not null default false,
  add column delivery_fee_cents     integer  not null default 0 check (delivery_fee_cents between 0 and 100000),
  add column stripe_account_id      text unique check (stripe_account_id is null or stripe_account_id ~ '^acct_[A-Za-z0-9]+$'),
  add column stripe_charges_enabled boolean  not null default false,
  add column stripe_details_submitted boolean not null default false,
  add column repair_slot_capacity   smallint not null default 1 check (repair_slot_capacity between 1 and 10),
  add constraint shops_fulfilment_check check (collection_enabled or delivery_enabled);

-- Members may change the shop profile and these settings, never the Stripe
-- account fields (written by the server after talking to Stripe).
revoke update on public.shops from authenticated;
grant update (name, email, phone, address, notification_email,
              collection_enabled, delivery_enabled, delivery_fee_cents, repair_slot_capacity)
  on public.shops to authenticated;

-- Sale: how the order is fulfilled and the stock hold.
alter table public.sales
  add column fulfilment         text check (fulfilment in ('collection', 'delivery')),
  add column delivery_fee_cents integer not null default 0 check (delivery_fee_cents >= 0),
  add column shipping_address   jsonb,
  add column reserved_until     timestamptz;
create index sales_reserved_idx on public.sales (reserved_until) where status = 'pending' and reserved_until is not null;

-- ---------------------------------------------------------------------------
-- Reserve stock for a pending online sale (service role only).
-- Decrements stock now, so a POS sale can't sell the same unit during payment.
-- Returns false (and changes nothing) when any line lacks stock.
-- ---------------------------------------------------------------------------
create or replace function public.reserve_online_sale(p_sale_id uuid, p_minutes integer default 31)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale public.sales%rowtype;
  v_short boolean;
begin
  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found or v_sale.status <> 'pending' or v_sale.channel <> 'online' then
    return false;
  end if;
  if v_sale.reserved_until is not null then
    return true; -- already reserved (idempotent)
  end if;

  perform 1 from public.products p
  where p.id in (select product_id from public.sale_items where sale_id = p_sale_id)
  order by p.id
  for update;

  select exists (
    select 1 from public.sale_items i
    left join public.products p on p.id = i.product_id and p.shop_id = v_sale.shop_id
    where i.sale_id = p_sale_id and (p.id is null or p.stock_qty < i.qty)
  ) into v_short;
  if v_short then
    return false;
  end if;

  update public.products p
  set stock_qty = p.stock_qty - i.qty
  from public.sale_items i
  where i.sale_id = p_sale_id and p.id = i.product_id;

  update public.sales
  set reserved_until = now() + make_interval(mins => greatest(p_minutes, 1))
  where id = p_sale_id;
  return true;
end;
$$;

-- Give reserved stock back and cancel the pending sale (expired or abandoned
-- checkout). No-op for anything that isn't a reserved pending sale.
create or replace function public.release_online_sale(p_sale_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale public.sales%rowtype;
begin
  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found or v_sale.status <> 'pending' or v_sale.reserved_until is null then
    return false;
  end if;

  perform 1 from public.products p
  where p.id in (select product_id from public.sale_items where sale_id = p_sale_id)
  order by p.id
  for update;

  update public.products p
  set stock_qty = p.stock_qty + i.qty
  from public.sale_items i
  where i.sale_id = p_sale_id and p.id = i.product_id;

  update public.sales set status = 'cancelled', reserved_until = null where id = p_sale_id;
  return true;
end;
$$;

-- Payment completed. Reserved sale → just mark paid (stock already taken).
-- Released/expired or never-reserved sale → take stock now if it's still
-- there; otherwise return false so the caller refunds.
create or replace function public.finalize_online_sale(p_sale_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale public.sales%rowtype;
  v_short boolean;
begin
  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found then
    raise exception 'sale not found' using errcode = 'P0002';
  end if;
  if v_sale.status = 'paid' then
    return true; -- idempotent: Stripe can deliver the same event twice
  end if;
  if v_sale.status = 'refunded' then
    return false;
  end if;

  if v_sale.status = 'pending' and v_sale.reserved_until is not null then
    update public.sales set status = 'paid', paid_at = now(), reserved_until = null where id = p_sale_id;
    return true;
  end if;

  -- pending without a reservation, or cancelled after the hold expired:
  -- the customer has paid, so try to take the stock now.
  perform 1 from public.products p
  where p.id in (select product_id from public.sale_items where sale_id = p_sale_id)
  order by p.id
  for update;

  select exists (
    select 1 from public.sale_items i
    left join public.products p on p.id = i.product_id and p.shop_id = v_sale.shop_id
    where i.sale_id = p_sale_id and (p.id is null or p.stock_qty < i.qty)
  ) into v_short;

  if v_short then
    update public.sales set status = 'cancelled', reserved_until = null where id = p_sale_id;
    return false;
  end if;

  update public.products p
  set stock_qty = p.stock_qty - i.qty
  from public.sale_items i
  where i.sale_id = p_sale_id and p.id = i.product_id;

  update public.sales set status = 'paid', paid_at = now(), reserved_until = null where id = p_sale_id;
  return true;
end;
$$;

-- Backstop for the cron job: release every reservation past its hold.
create or replace function public.release_expired_reservations(p_grace_minutes integer default 5)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_count integer := 0;
begin
  for v_id in
    select id from public.sales
    where status = 'pending' and reserved_until is not null
      and reserved_until < now() - make_interval(mins => p_grace_minutes)
  loop
    if public.release_online_sale(v_id) then
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.reserve_online_sale(uuid, integer)',
    'public.release_online_sale(uuid)',
    'public.finalize_online_sale(uuid)',
    'public.release_expired_reservations(integer)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
