-- =============================================================================
-- SELLIFY CORE (STAND-IN)
-- The thinnest backend the Sellify Stores brief depends on: shops, a device
-- catalog, inventory, sales, repairs and buybacks. In production these tables
-- belong to the real Sellify. Stores code reaches them only through
-- src/core/api.ts. See docs/CORE-STANDIN.md.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Shops and membership
-- ---------------------------------------------------------------------------
create table public.shops (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null check (length(trim(name)) between 1 and 80),
  email              text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone              text check (phone is null or length(phone) <= 40),
  address            text check (address is null or length(address) <= 300),
  -- Where booking / buyback / order emails go. Falls back to `email`.
  notification_email text check (notification_email is null or notification_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  currency           text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  timezone           text not null default 'Europe/Dublin',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create trigger shops_updated_at before update on public.shops
  for each row execute function public.set_updated_at();

create table public.shop_members (
  shop_id    uuid not null references public.shops (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null default 'owner' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  primary key (shop_id, user_id)
);
create index shop_members_user_id_idx on public.shop_members (user_id);

-- Security definer so RLS policies can call it without recursing into
-- shop_members' own policies.
create or replace function public.is_shop_member(p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.shop_members m
    where m.shop_id = p_shop_id
      and m.user_id = (select auth.uid())
  );
$$;
revoke execute on function public.is_shop_member(uuid) from public, anon;
grant execute on function public.is_shop_member(uuid) to authenticated;

-- Onboarding: create a shop and make the caller its owner, atomically.
-- One shop per user in this stand-in.
create or replace function public.create_shop(p_name text, p_email text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_shop uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if exists (select 1 from public.shop_members where user_id = v_uid) then
    raise exception 'user already belongs to a shop' using errcode = '23505';
  end if;

  insert into public.shops (name, email, notification_email)
  values (trim(p_name), nullif(trim(p_email), ''), nullif(trim(p_email), ''))
  returning id into v_shop;

  insert into public.shop_members (shop_id, user_id, role)
  values (v_shop, v_uid, 'owner');

  insert into public.buyback_settings (shop_id) values (v_shop);

  return v_shop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Global device catalog (seeded, read-only for everyone)
-- ---------------------------------------------------------------------------
create table public.device_brands (
  id         smallint generated always as identity primary key,
  name       text not null unique,
  sort_order smallint not null default 0
);

create table public.device_models (
  id              integer generated always as identity primary key,
  brand_id        smallint not null references public.device_brands (id) on delete cascade,
  name            text not null,
  storage_options integer[] not null default '{}',
  release_year    smallint,
  sort_order      smallint not null default 0,
  unique (brand_id, name)
);
create index device_models_brand_id_idx on public.device_models (brand_id);

create table public.repair_types (
  id         smallint generated always as identity primary key,
  name       text not null unique,
  slug       text not null unique,
  sort_order smallint not null default 0
);

-- ---------------------------------------------------------------------------
-- Inventory
-- ---------------------------------------------------------------------------
create table public.products (
  id             uuid primary key default gen_random_uuid(),
  shop_id        uuid not null references public.shops (id) on delete cascade,
  name           text not null check (length(trim(name)) between 1 and 120),
  description    text check (description is null or length(description) <= 4000),
  category       text not null default 'accessory'
                   check (category in ('phone', 'accessory', 'part', 'other')),
  condition      text check (condition in ('new', 'refurbished', 'used')),
  sku            text check (sku is null or length(sku) <= 60),
  price_cents    integer not null check (price_cents >= 0),
  stock_qty      integer not null default 0 check (stock_qty >= 0),
  images         text[] not null default '{}',
  visible_online boolean not null default true,
  -- A part is linked to the repair it is used for. Its stock drives
  -- "Same-day repair available" on the store's Repair tab.
  is_part        boolean not null default false,
  model_id       integer references public.device_models (id) on delete set null,
  repair_type_id smallint references public.repair_types (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (not is_part or (model_id is not null and repair_type_id is not null)),
  check (cardinality(images) <= 8)
);
create index products_shop_id_idx on public.products (shop_id);
create index products_part_lookup_idx on public.products (shop_id, model_id, repair_type_id) where is_part;
create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Sales
-- ---------------------------------------------------------------------------
create table public.sales (
  id                uuid primary key default gen_random_uuid(),
  shop_id           uuid not null references public.shops (id) on delete cascade,
  channel           text not null check (channel in ('pos', 'online')),
  status            text not null default 'pending'
                      check (status in ('pending', 'paid', 'cancelled', 'refunded')),
  payment_method    text check (payment_method in ('cash', 'card', 'stripe')),
  total_cents       integer not null default 0 check (total_cents >= 0),
  customer_name     text check (customer_name is null or length(customer_name) <= 120),
  customer_email    text check (customer_email is null or length(customer_email) <= 254),
  customer_phone    text check (customer_phone is null or length(customer_phone) <= 40),
  stripe_session_id text unique,
  note              text check (note is null or length(note) <= 500),
  created_at        timestamptz not null default now(),
  paid_at           timestamptz
);
create index sales_shop_created_idx on public.sales (shop_id, created_at desc);

create table public.sale_items (
  id               uuid primary key default gen_random_uuid(),
  sale_id          uuid not null references public.sales (id) on delete cascade,
  product_id       uuid references public.products (id) on delete set null,
  -- Snapshots, so the sale still reads correctly after a product changes.
  name             text not null,
  unit_price_cents integer not null check (unit_price_cents >= 0),
  qty              integer not null check (qty > 0)
);
create index sale_items_sale_id_idx on public.sale_items (sale_id);
create index sale_items_product_id_idx on public.sale_items (product_id);

-- POS sale: prices come from the database, never from the caller. Stock is
-- locked and checked, then decremented, in one transaction.
-- p_items: [{ "product_id": uuid, "qty": int }, ...]
create or replace function public.record_pos_sale(
  p_shop_id        uuid,
  p_items          jsonb,
  p_payment_method text default 'card',
  p_customer_name  text default null,
  p_note           text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale  uuid;
  v_total integer := 0;
  v_item  record;
begin
  if not public.is_shop_member(p_shop_id) then
    raise exception 'not a member of this shop' using errcode = '42501';
  end if;
  if p_payment_method not in ('cash', 'card') then
    raise exception 'invalid payment method' using errcode = '22023';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'a sale needs at least one item' using errcode = '22023';
  end if;

  insert into public.sales (shop_id, channel, status, payment_method, customer_name, note, paid_at)
  values (p_shop_id, 'pos', 'paid', p_payment_method,
          nullif(trim(p_customer_name), ''), nullif(trim(p_note), ''), now())
  returning id into v_sale;

  -- Merge duplicate lines, lock rows in a stable order to avoid deadlocks.
  for v_item in
    select p.id, p.name, p.price_cents, p.stock_qty, l.qty
    from (
      select (e ->> 'product_id')::uuid as product_id, sum((e ->> 'qty')::int) as qty
      from jsonb_array_elements(p_items) e
      group by 1
    ) l
    join public.products p on p.id = l.product_id and p.shop_id = p_shop_id
    order by p.id
    for update of p
  loop
    if v_item.qty is null or v_item.qty <= 0 then
      raise exception 'invalid quantity' using errcode = '22023';
    end if;
    if v_item.stock_qty < v_item.qty then
      raise exception 'not enough stock for %', v_item.name using errcode = 'P0001';
    end if;

    update public.products set stock_qty = stock_qty - v_item.qty where id = v_item.id;
    insert into public.sale_items (sale_id, product_id, name, unit_price_cents, qty)
    values (v_sale, v_item.id, v_item.name, v_item.price_cents, v_item.qty);
    v_total := v_total + v_item.price_cents * v_item.qty;
  end loop;

  if (select count(*) from public.sale_items where sale_id = v_sale)
     <> (select count(distinct e ->> 'product_id') from jsonb_array_elements(p_items) e) then
    raise exception 'unknown product in sale' using errcode = '22023';
  end if;

  update public.sales set total_cents = v_total where id = v_sale;
  return v_sale;
end;
$$;
revoke execute on function public.record_pos_sale(uuid, jsonb, text, text, text) from public, anon;
grant execute on function public.record_pos_sale(uuid, jsonb, text, text, text) to authenticated;

-- Online sale, step 2 (called only by the Stripe webhook with the service
-- role): lock stock, decrement and mark paid. Returns false and marks the
-- sale cancelled when stock ran out, so the caller can refund.
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
  if v_sale.status <> 'pending' then
    return false;
  end if;

  perform 1 from public.products p
  where p.id in (select product_id from public.sale_items where sale_id = p_sale_id)
  order by p.id
  for update;

  select exists (
    select 1
    from public.sale_items i
    left join public.products p on p.id = i.product_id
    where i.sale_id = p_sale_id
      and (p.id is null or p.stock_qty < i.qty)
  ) into v_short;

  if v_short then
    update public.sales set status = 'cancelled' where id = p_sale_id;
    return false;
  end if;

  update public.products p
  set stock_qty = p.stock_qty - i.qty
  from public.sale_items i
  where i.sale_id = p_sale_id and p.id = i.product_id;

  update public.sales set status = 'paid', paid_at = now() where id = p_sale_id;
  return true;
end;
$$;
revoke execute on function public.finalize_online_sale(uuid) from public, anon, authenticated;
grant execute on function public.finalize_online_sale(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Repairs
-- ---------------------------------------------------------------------------
create table public.repair_prices (
  id             uuid primary key default gen_random_uuid(),
  shop_id        uuid not null references public.shops (id) on delete cascade,
  model_id       integer not null references public.device_models (id) on delete cascade,
  repair_type_id smallint not null references public.repair_types (id) on delete cascade,
  price_cents    integer not null check (price_cents >= 0),
  duration_min   integer not null default 60 check (duration_min between 15 and 480),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (shop_id, model_id, repair_type_id)
);
create trigger repair_prices_updated_at before update on public.repair_prices
  for each row execute function public.set_updated_at();

create table public.repair_tickets (
  id                 uuid primary key default gen_random_uuid(),
  shop_id            uuid not null references public.shops (id) on delete cascade,
  model_id           integer references public.device_models (id) on delete set null,
  repair_type_id     smallint references public.repair_types (id) on delete set null,
  device_label       text not null check (length(device_label) <= 120),
  repair_label       text not null check (length(repair_label) <= 120),
  quoted_price_cents integer not null check (quoted_price_cents >= 0),
  scheduled_at       timestamptz,
  status             text not null default 'booked'
                       check (status in ('booked', 'in_progress', 'ready', 'collected', 'cancelled')),
  source             text not null check (source in ('walk_in', 'online')),
  customer_name      text not null check (length(trim(customer_name)) between 1 and 120),
  customer_phone     text check (customer_phone is null or length(customer_phone) <= 40),
  customer_email     text check (customer_email is null or length(customer_email) <= 254),
  notes              text check (notes is null or length(notes) <= 2000),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index repair_tickets_shop_created_idx on public.repair_tickets (shop_id, created_at desc);
create index repair_tickets_shop_scheduled_idx on public.repair_tickets (shop_id, scheduled_at)
  where status <> 'cancelled';
create trigger repair_tickets_updated_at before update on public.repair_tickets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Buybacks
-- ---------------------------------------------------------------------------
create table public.buyback_prices (
  id               uuid primary key default gen_random_uuid(),
  shop_id          uuid not null references public.shops (id) on delete cascade,
  model_id         integer not null references public.device_models (id) on delete cascade,
  storage_gb       integer not null check (storage_gb > 0),
  base_price_cents integer not null check (base_price_cents >= 0),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (shop_id, model_id, storage_gb)
);
create trigger buyback_prices_updated_at before update on public.buyback_prices
  for each row execute function public.set_updated_at();

-- Percentage deducted from the base price per failed condition question.
create table public.buyback_settings (
  shop_id                 uuid primary key references public.shops (id) on delete cascade,
  screen_cracked_pct      smallint not null default 30 check (screen_cracked_pct between 0 and 100),
  battery_bad_pct         smallint not null default 15 check (battery_bad_pct between 0 and 100),
  no_power_pct            smallint not null default 50 check (no_power_pct between 0 and 100),
  updated_at              timestamptz not null default now()
);
create trigger buyback_settings_updated_at before update on public.buyback_settings
  for each row execute function public.set_updated_at();

create table public.buybacks (
  id             uuid primary key default gen_random_uuid(),
  shop_id        uuid not null references public.shops (id) on delete cascade,
  model_id       integer references public.device_models (id) on delete set null,
  storage_gb     integer check (storage_gb > 0),
  device_label   text not null check (length(device_label) <= 120),
  -- { "screen_cracked": bool, "battery_ok": bool, "turns_on": bool }
  answers        jsonb not null default '{}',
  offer_cents    integer not null check (offer_cents >= 0),
  handover       text not null default 'drop_in' check (handover in ('drop_in')),
  status         text not null default 'accepted'
                   check (status in ('accepted', 'received', 'paid', 'rejected', 'cancelled')),
  source         text not null check (source in ('walk_in', 'online')),
  customer_name  text not null check (length(trim(customer_name)) between 1 and 120),
  customer_phone text check (customer_phone is null or length(customer_phone) <= 40),
  customer_email text check (customer_email is null or length(customer_email) <= 254),
  notes          text check (notes is null or length(notes) <= 2000),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index buybacks_shop_created_idx on public.buybacks (shop_id, created_at desc);
create trigger buybacks_updated_at before update on public.buybacks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- Members read and write their own shop. Anonymous visitors get nothing from
-- these tables directly; public store pages go through security definer RPCs
-- that return only a published store's visible data.
-- ---------------------------------------------------------------------------
alter table public.shops            enable row level security;
alter table public.shop_members     enable row level security;
alter table public.device_brands    enable row level security;
alter table public.device_models    enable row level security;
alter table public.repair_types     enable row level security;
alter table public.products         enable row level security;
alter table public.sales            enable row level security;
alter table public.sale_items       enable row level security;
alter table public.repair_prices    enable row level security;
alter table public.repair_tickets   enable row level security;
alter table public.buyback_prices   enable row level security;
alter table public.buyback_settings enable row level security;
alter table public.buybacks         enable row level security;

-- Shops: created only through create_shop(); never deleted from the app.
create policy "members read their shop" on public.shops
  for select to authenticated using (public.is_shop_member(id));
create policy "members update their shop" on public.shops
  for update to authenticated using (public.is_shop_member(id)) with check (public.is_shop_member(id));

create policy "members see their shop's members" on public.shop_members
  for select to authenticated using (user_id = (select auth.uid()) or public.is_shop_member(shop_id));

-- Catalog: public reference data.
create policy "catalog is readable" on public.device_brands for select to anon, authenticated using (true);
create policy "catalog is readable" on public.device_models for select to anon, authenticated using (true);
create policy "catalog is readable" on public.repair_types  for select to anon, authenticated using (true);

-- Shop-owned tables: full access for members of that shop.
create policy "members manage products" on public.products
  for all to authenticated using (public.is_shop_member(shop_id)) with check (public.is_shop_member(shop_id));
create policy "members manage repair prices" on public.repair_prices
  for all to authenticated using (public.is_shop_member(shop_id)) with check (public.is_shop_member(shop_id));
create policy "members manage repair tickets" on public.repair_tickets
  for all to authenticated using (public.is_shop_member(shop_id)) with check (public.is_shop_member(shop_id));
create policy "members manage buyback prices" on public.buyback_prices
  for all to authenticated using (public.is_shop_member(shop_id)) with check (public.is_shop_member(shop_id));
create policy "members manage buybacks" on public.buybacks
  for all to authenticated using (public.is_shop_member(shop_id)) with check (public.is_shop_member(shop_id));
create policy "members read buyback settings" on public.buyback_settings
  for select to authenticated using (public.is_shop_member(shop_id));
create policy "members update buyback settings" on public.buyback_settings
  for update to authenticated using (public.is_shop_member(shop_id)) with check (public.is_shop_member(shop_id));

-- Sales are written only by record_pos_sale() / the webhook. Members can read
-- them and change the status (e.g. refund), but not rewrite amounts.
create policy "members read sales" on public.sales
  for select to authenticated using (public.is_shop_member(shop_id));
create policy "members read sale items" on public.sale_items
  for select to authenticated using (
    exists (select 1 from public.sales s where s.id = sale_id and public.is_shop_member(s.shop_id))
  );

-- Column-level grants: lock down what the API roles may touch.
revoke all on public.sales, public.sale_items from anon, authenticated;
grant select on public.sales, public.sale_items to authenticated;
revoke all on public.shops, public.shop_members from anon;
revoke insert, delete on public.shops from authenticated;
revoke insert, update, delete on public.shop_members from authenticated;
revoke insert, update, delete on public.device_brands, public.device_models, public.repair_types from anon, authenticated;
revoke all on public.products, public.repair_prices, public.repair_tickets,
              public.buyback_prices, public.buyback_settings, public.buybacks from anon;
revoke insert, delete on public.buyback_settings from authenticated;

revoke execute on function public.create_shop(text, text) from public, anon;
grant execute on function public.create_shop(text, text) to authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
