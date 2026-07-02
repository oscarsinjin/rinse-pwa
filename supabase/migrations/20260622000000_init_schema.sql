-- Rinse marketplace core schema: profiles, orders, dispatch, payments, ratings.
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('customer', 'partner', 'driver');
create type public.approval_status as enum ('pending', 'approved', 'suspended', 'rejected');
create type public.partner_type as enum ('home', 'laundromat');
create type public.vehicle_type as enum ('bike', 'car', 'van', 'bakkie');
create type public.service_category as enum ('everyday', 'formal_delicate');
create type public.order_status as enum (
  'pending_match',
  'confirmed',
  'pickup_dispatching',
  'picked_up',
  'washing',
  'ready_for_delivery',
  'out_for_delivery',
  'delivered',
  'cancelled'
);
create type public.trip_leg as enum ('pickup', 'delivery');
create type public.trip_status as enum ('pending', 'offered', 'accepted', 'en_route', 'completed', 'cancelled');
create type public.offer_status as enum ('offered', 'accepted', 'declined', 'expired');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');
create type public.payment_method as enum ('card', 'eft');
create type public.payout_status as enum ('pending', 'processing', 'paid', 'failed');
create type public.rating_target as enum ('partner', 'driver', 'service');

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles (one row per auth user, role fixed at signup)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Creates a profile (and role-specific profile row) whenever a phone-OTP signup completes.
-- Expects auth.signInWithOtp({ phone, options: { data: { role: 'customer' | 'partner' | 'driver', full_name } } }).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  signup_role public.user_role := coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'customer');
begin
  insert into public.profiles (id, role, full_name, phone)
  values (new.id, signup_role, new.raw_user_meta_data ->> 'full_name', new.phone);

  if signup_role = 'partner' then
    insert into public.partner_profiles (user_id) values (new.id);
  elsif signup_role = 'driver' then
    insert into public.driver_profiles (user_id, vehicle_type)
    values (new.id, (new.raw_user_meta_data ->> 'vehicle_type')::public.vehicle_type);
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- addresses (customer pickup/delivery locations)
-- ---------------------------------------------------------------------------
create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  label text,
  line1 text not null,
  line2 text,
  suburb text,
  city text,
  province text,
  postal_code text,
  lat double precision not null,
  lng double precision not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index addresses_customer_id_idx on public.addresses (customer_id);

-- ---------------------------------------------------------------------------
-- partner_profiles (home partners + laundromats)
-- ---------------------------------------------------------------------------
create table public.partner_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  business_name text,
  partner_type public.partner_type not null default 'home',
  status public.approval_status not null default 'pending',
  lat double precision,
  lng double precision,
  service_radius_km numeric not null default 8,
  rating_avg numeric not null default 0,
  rating_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger partner_profiles_set_updated_at
  before update on public.partner_profiles
  for each row execute function public.set_updated_at();

create table public.partner_availability (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_profiles (user_id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  unique (partner_id, weekday, start_time, end_time)
);

create index partner_availability_partner_id_idx on public.partner_availability (partner_id);

-- ---------------------------------------------------------------------------
-- driver_profiles
-- ---------------------------------------------------------------------------
create table public.driver_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  vehicle_type public.vehicle_type,
  vehicle_make text,
  vehicle_model text,
  vehicle_plate text,
  status public.approval_status not null default 'pending',
  is_online boolean not null default false,
  current_lat double precision,
  current_lng double precision,
  rating_avg numeric not null default 0,
  rating_count integer not null default 0,
  acceptance_rate numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger driver_profiles_set_updated_at
  before update on public.driver_profiles
  for each row execute function public.set_updated_at();

-- Public-safe views so customers can see who they're matched with without
-- exposing full partner/driver rows (location, contact, etc.) via RLS.
create view public.partner_public as
  select user_id, business_name, partner_type, rating_avg, rating_count
  from public.partner_profiles
  where status = 'approved';

create view public.driver_public as
  select user_id, vehicle_type, rating_avg, rating_count
  from public.driver_profiles
  where status = 'approved';

-- ---------------------------------------------------------------------------
-- service_tiers (admin-managed catalogue; category drives partner routing)
-- ---------------------------------------------------------------------------
create table public.service_tiers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category public.service_category not null,
  base_price numeric not null,
  price_per_kg numeric,
  turnaround_hours integer not null default 24,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id),
  address_id uuid not null references public.addresses (id),
  service_tier_id uuid not null references public.service_tiers (id),
  partner_id uuid references public.partner_profiles (user_id),
  status public.order_status not null default 'pending_match',
  scheduled_for timestamptz,
  subtotal numeric not null default 0,
  service_fee numeric not null default 0,
  total numeric not null default 0,
  payment_status public.payment_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_customer_id_idx on public.orders (customer_id);
create index orders_partner_id_idx on public.orders (partner_id);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  category text not null,
  quantity integer not null default 1,
  notes text,
  photo_url text
);

create index order_items_order_id_idx on public.order_items (order_id);

-- Each order has up to two driver legs: pickup (customer -> partner) and
-- delivery (partner -> customer), dispatched independently. Each leg has its
-- own pickup confirmation (photo + optional PIN, at the leg's origin) and
-- delivery confirmation (proof photo, at the leg's destination).
create table public.order_trips (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  leg public.trip_leg not null,
  driver_id uuid references public.driver_profiles (user_id),
  status public.trip_status not null default 'pending',
  pickup_photo_url text,
  pickup_pin text,
  picked_up_at timestamptz,
  delivery_photo_url text,
  delivered_at timestamptz,
  dispatched_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (order_id, leg)
);

create index order_trips_order_id_idx on public.order_trips (order_id);
create index order_trips_driver_id_idx on public.order_trips (driver_id);

-- ---------------------------------------------------------------------------
-- dispatch_offers (nearest-first, timed accept/decline for partners + drivers)
-- ---------------------------------------------------------------------------
create table public.dispatch_offers (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders (id) on delete cascade,
  order_trip_id uuid references public.order_trips (id) on delete cascade,
  candidate_id uuid not null references public.profiles (id),
  distance_km numeric,
  status public.offer_status not null default 'offered',
  offered_at timestamptz not null default now(),
  expires_at timestamptz not null,
  responded_at timestamptz,
  check (
    (order_id is not null and order_trip_id is null) or
    (order_id is null and order_trip_id is not null)
  )
);

create index dispatch_offers_candidate_id_idx on public.dispatch_offers (candidate_id);
create index dispatch_offers_order_id_idx on public.dispatch_offers (order_id);
create index dispatch_offers_order_trip_id_idx on public.dispatch_offers (order_trip_id);

-- ---------------------------------------------------------------------------
-- ratings (customer rates partner, driver, and service separately)
-- ---------------------------------------------------------------------------
create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  rater_id uuid not null references public.profiles (id),
  target public.rating_target not null,
  ratee_id uuid references public.profiles (id),
  stars smallint not null check (stars between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (order_id, target)
);

create index ratings_ratee_id_idx on public.ratings (ratee_id);

-- ---------------------------------------------------------------------------
-- payments (PayFast) + payouts (EFT cash-out for partners/drivers)
-- ---------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id),
  provider text not null default 'payfast',
  provider_reference text,
  method public.payment_method,
  amount numeric not null,
  status public.payment_status not null default 'pending',
  raw_itn jsonb,
  created_at timestamptz not null default now()
);

create index payments_order_id_idx on public.payments (order_id);

create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  bank_name text not null,
  account_holder text not null,
  account_number text not null,
  branch_code text not null,
  created_at timestamptz not null default now()
);

create index bank_accounts_owner_id_idx on public.bank_accounts (owner_id);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id),
  bank_account_id uuid not null references public.bank_accounts (id),
  amount numeric not null,
  status public.payout_status not null default 'pending',
  requested_at timestamptz not null default now(),
  paid_at timestamptz
);

create index payouts_owner_id_idx on public.payouts (owner_id);

-- ---------------------------------------------------------------------------
-- Distance helper for nearest-first dispatch (plain lat/lng, no PostGIS).
-- ---------------------------------------------------------------------------
create function public.haversine_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision
language sql
immutable
as $$
  select 6371 * 2 * asin(sqrt(
    sin(radians(lat2 - lat1) / 2) ^ 2 +
    cos(radians(lat1)) * cos(radians(lat2)) * sin(radians(lng2 - lng1) / 2) ^ 2
  ));
$$;

-- ---------------------------------------------------------------------------
-- RLS helper functions.
--
-- orders and order_trips policies each need to look at the other table (an
-- order's RLS depends on whether you're the assigned driver on one of its
-- trips; a trip's RLS depends on whether you're the customer/partner on its
-- order). Querying across them directly from policy USING clauses creates a
-- cycle: evaluating orders' policy triggers order_trips' policy, which
-- queries orders again, which Postgres detects as infinite recursion.
--
-- security definer functions break the cycle: their internal queries run as
-- the function owner (which owns these tables, so RLS doesn't re-trigger),
-- so the policies that call them only ever evaluate one level deep.
-- ---------------------------------------------------------------------------
-- Driver-side access only (assigned on a trip, or holding a live offer for one).
-- Deliberately excludes the customer_id/partner_id check: those are covered by
-- simple direct policies on `orders` instead (see orders_select_customer/partner
-- below), because a security definer function's internal queries don't see rows
-- inserted earlier in the SAME statement — wrapping the customer's own check in
-- this function would break `INSERT ... RETURNING` when a customer creates an
-- order (the immediate post-insert SELECT-policy check would see no row yet).
create function public.order_has_driver_access(target_order_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.order_trips t
    where t.order_id = target_order_id and t.driver_id = auth.uid()
  )
  or exists (
    select 1 from public.dispatch_offers d
    join public.order_trips t on t.id = d.order_trip_id
    where t.order_id = target_order_id and d.candidate_id = auth.uid() and d.status = 'offered'
  );
$$;

create function public.is_trip_participant(target_trip_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.order_trips t
    join public.orders o on o.id = t.order_id
    where t.id = target_trip_id
      and (t.driver_id = auth.uid() or o.customer_id = auth.uid() or o.partner_id = auth.uid())
  )
  or exists (
    select 1 from public.dispatch_offers d
    where d.order_trip_id = target_trip_id and d.candidate_id = auth.uid() and d.status = 'offered'
  );
$$;

create function public.is_order_counterparty(other_profile_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.orders o
    where (o.customer_id = auth.uid() and other_profile_id = o.partner_id)
       or (o.partner_id = auth.uid() and other_profile_id = o.customer_id)
  )
  or exists (
    select 1 from public.order_trips t
    join public.orders o on o.id = t.order_id
    where (t.driver_id = auth.uid() and other_profile_id = o.customer_id)
       or (o.customer_id = auth.uid() and other_profile_id = t.driver_id)
  );
$$;

-- ---------------------------------------------------------------------------
-- Table-level grants. RLS policies (below) restrict which *rows* anon/
-- authenticated can see; these grants control whether they can touch the
-- table at all, and aren't set up automatically by `supabase db reset`. Also
-- set as the default for any tables added by later migrations. service_role
-- needs this too — it's what the PayFast edge functions use to bypass RLS
-- and write payments/orders directly.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.addresses enable row level security;
alter table public.partner_profiles enable row level security;
alter table public.partner_availability enable row level security;
alter table public.driver_profiles enable row level security;
alter table public.service_tiers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_trips enable row level security;
alter table public.dispatch_offers enable row level security;
alter table public.ratings enable row level security;
alter table public.payments enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.payouts enable row level security;

-- profiles: see your own row, or the counterparty on an order you're part of.
create policy profiles_select_own on public.profiles
  for select using (id = auth.uid());

create policy profiles_select_counterparty on public.profiles
  for select using (public.is_order_counterparty(id));

create policy profiles_update_own on public.profiles
  for update using (id = auth.uid());

-- addresses: owned by the customer; also visible to the partner/driver on a related order.
create policy addresses_all_own on public.addresses
  for all using (customer_id = auth.uid()) with check (customer_id = auth.uid());

create policy addresses_select_for_order on public.addresses
  for select using (
    exists (select 1 from public.orders o where o.address_id = id and public.is_order_participant(o.id))
  );

-- partner_profiles: partner manages their own row; customers can browse approved partners.
create policy partner_profiles_select_own on public.partner_profiles
  for select using (user_id = auth.uid());

create policy partner_profiles_select_approved on public.partner_profiles
  for select using (status = 'approved');

create policy partner_profiles_update_own on public.partner_profiles
  for update using (user_id = auth.uid());

create policy partner_availability_all_own on public.partner_availability
  for all using (partner_id = auth.uid()) with check (partner_id = auth.uid());

create policy partner_availability_select_for_matching on public.partner_availability
  for select using (true);

-- driver_profiles: driver manages their own row.
create policy driver_profiles_select_own on public.driver_profiles
  for select using (user_id = auth.uid());

create policy driver_profiles_select_for_orders on public.driver_profiles
  for select using (
    exists (
      select 1 from public.order_trips t
      join public.orders o on o.id = t.order_id
      where t.driver_id = public.driver_profiles.user_id and o.customer_id = auth.uid()
    )
  );

create policy driver_profiles_update_own on public.driver_profiles
  for update using (user_id = auth.uid());

-- service_tiers: readable by any authenticated user; admin-managed (service role) writes.
create policy service_tiers_select_all on public.service_tiers
  for select using (auth.role() = 'authenticated');

-- orders: customer owns; matched partner can see/update; driver sees via order_trips/dispatch_offers.
create policy orders_select_participant on public.orders
  for select using (public.is_order_participant(id));

create policy orders_insert_customer on public.orders
  for insert with check (customer_id = auth.uid());

create policy orders_update_customer on public.orders
  for update using (customer_id = auth.uid());

create policy orders_update_partner on public.orders
  for update using (partner_id = auth.uid());

-- order_items: visible/insertable by the order's customer; visible to matched partner.
create policy order_items_select on public.order_items
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and (o.customer_id = auth.uid() or o.partner_id = auth.uid())
    )
  );

create policy order_items_insert_customer on public.order_items
  for insert with check (
    exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid())
  );

-- order_trips: visible to the order's customer/partner, and the assigned driver.
create policy order_trips_select on public.order_trips
  for select using (public.is_trip_participant(id));

create policy order_trips_update_driver on public.order_trips
  for update using (driver_id = auth.uid());

-- dispatch_offers: a candidate sees and responds only to their own offers.
create policy dispatch_offers_select_own on public.dispatch_offers
  for select using (candidate_id = auth.uid());

create policy dispatch_offers_update_own on public.dispatch_offers
  for update using (candidate_id = auth.uid() and status = 'offered');

-- ratings: order participants can read; customer inserts ratings for their own orders.
create policy ratings_select on public.ratings
  for select using (
    rater_id = auth.uid()
    or ratee_id = auth.uid()
    or exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid())
  );

create policy ratings_insert_customer on public.ratings
  for insert with check (
    rater_id = auth.uid()
    and exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid())
  );

-- payments: order's customer can read (payment writes happen via the PayFast edge function/service role).
create policy payments_select_customer on public.payments
  for select using (
    exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid())
  );

-- bank_accounts / payouts: owner-only.
create policy bank_accounts_all_own on public.bank_accounts
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy payouts_select_own on public.payouts
  for select using (owner_id = auth.uid());

create policy payouts_insert_own on public.payouts
  for insert with check (owner_id = auth.uid());
