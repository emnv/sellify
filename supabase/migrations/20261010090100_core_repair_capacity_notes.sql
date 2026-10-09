-- =============================================================================
-- Repairs: several bookings per slot (shops.repair_slot_capacity) and a notes
-- history instead of one overwritten notes field. SELLIFY CORE (stand-in).
-- =============================================================================

-- A slot is full when it holds `repair_slot_capacity` active tickets, so the
-- one-per-slot unique index goes; capacity is enforced in book_online_repair.
drop index if exists public.repair_tickets_slot_uniq;
create index if not exists repair_tickets_slot_idx on public.repair_tickets (shop_id, scheduled_at)
  where status <> 'cancelled' and scheduled_at is not null;

-- Public slot picker: only FULL slots are returned (still no customer data).
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
  join public.shops sh on sh.id = t.shop_id
  where s.id = private.published_store_id(p_key)
    and t.status <> 'cancelled'
    and t.scheduled_at >= p_from and t.scheduled_at < p_to
    and p_to - p_from <= interval '31 days'
  group by t.scheduled_at, sh.repair_slot_capacity
  having count(*) >= sh.repair_slot_capacity;
$$;

-- Atomic online booking (service role only): serialises bookings for the same
-- shop + slot with an advisory lock, checks capacity, inserts. Returns the
-- ticket id, or null when the slot is full. Price/labels are computed by the
-- caller from the database (src/core/api-bookings.ts), never from the client.
create or replace function public.book_online_repair(
  p_shop_id uuid, p_model_id integer, p_repair_type_id smallint,
  p_device_label text, p_repair_label text, p_quoted_price_cents integer,
  p_scheduled_at timestamptz, p_customer_name text, p_customer_phone text, p_customer_email text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_capacity smallint;
  v_taken integer;
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_shop_id::text || '|' || p_scheduled_at::text, 0));
  select repair_slot_capacity into v_capacity from public.shops where id = p_shop_id;
  if v_capacity is null then
    raise exception 'shop not found' using errcode = 'P0002';
  end if;
  select count(*) into v_taken from public.repair_tickets
  where shop_id = p_shop_id and scheduled_at = p_scheduled_at and status <> 'cancelled';
  if v_taken >= v_capacity then
    return null;
  end if;
  insert into public.repair_tickets (
    shop_id, model_id, repair_type_id, device_label, repair_label, quoted_price_cents,
    scheduled_at, status, source, customer_name, customer_phone, customer_email
  ) values (
    p_shop_id, p_model_id, p_repair_type_id, p_device_label, p_repair_label, p_quoted_price_cents,
    p_scheduled_at, 'booked', 'online', p_customer_name, p_customer_phone, p_customer_email
  ) returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.book_online_repair(uuid, integer, smallint, text, text, integer, timestamptz, text, text, text) from public, anon, authenticated;
grant execute on function public.book_online_repair(uuid, integer, smallint, text, text, integer, timestamptz, text, text, text) to service_role;

-- Notes history for repair tickets (append-only for members).
create table public.repair_ticket_notes (
  id         bigint generated always as identity primary key,
  ticket_id  uuid not null references public.repair_tickets (id) on delete cascade,
  shop_id    uuid not null references public.shops (id) on delete cascade,
  body       text not null check (length(trim(body)) between 1 and 2000),
  author_id  uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index repair_ticket_notes_ticket_idx on public.repair_ticket_notes (ticket_id, created_at);
create index repair_ticket_notes_shop_idx on public.repair_ticket_notes (shop_id);
alter table public.repair_ticket_notes enable row level security;

create policy "members read ticket notes" on public.repair_ticket_notes
  for select to authenticated using (private.is_shop_member(shop_id));
-- The ticket must belong to the same shop; the author is always the caller.
create policy "members add ticket notes" on public.repair_ticket_notes
  for insert to authenticated with check (
    private.is_shop_member(shop_id)
    and author_id = (select auth.uid())
    and exists (select 1 from public.repair_tickets t where t.id = ticket_id and t.shop_id = repair_ticket_notes.shop_id)
  );
revoke all on public.repair_ticket_notes from anon;
revoke update, delete, truncate, references, trigger on public.repair_ticket_notes from authenticated;

-- Keep existing single notes as the first history entry.
insert into public.repair_ticket_notes (ticket_id, shop_id, body, created_at)
select id, shop_id, notes, updated_at from public.repair_tickets where notes is not null and length(trim(notes)) > 0;
