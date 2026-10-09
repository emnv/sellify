-- Hardening after the Supabase advisor run.

-- 1. Membership helpers are only needed inside RLS policies. Move them to a
--    schema the Data API does not expose, so they are not callable as RPCs.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

alter function public.is_shop_member(uuid) set schema private;
alter function public.is_store_member(uuid) set schema private;
alter function public.media_path_shop_id(text) set schema private;
grant execute on function private.media_path_shop_id(text) to authenticated;

-- Functions that call the helpers by schema-qualified name need updating.
-- (Policies reference functions by OID, so they follow the move.)
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
  if not private.is_shop_member(p_shop_id) then
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

-- 2. RLS does not apply to TRUNCATE; the API roles never need it (or
--    TRIGGER / REFERENCES) on any public table.
revoke truncate, trigger, references on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke truncate, trigger, references on tables from anon, authenticated;

-- 3. Covering indexes for foreign keys.
create index if not exists buyback_prices_model_id_idx  on public.buyback_prices (model_id);
create index if not exists buybacks_model_id_idx        on public.buybacks (model_id);
create index if not exists products_model_id_idx        on public.products (model_id);
create index if not exists products_repair_type_id_idx  on public.products (repair_type_id);
create index if not exists repair_prices_model_id_idx   on public.repair_prices (model_id);
create index if not exists repair_prices_repair_type_idx on public.repair_prices (repair_type_id);
create index if not exists repair_tickets_model_id_idx  on public.repair_tickets (model_id);
create index if not exists repair_tickets_repair_type_idx on public.repair_tickets (repair_type_id);
