-- Fix orders SELECT policy so INSERT...RETURNING succeeds for the inserting customer.
--
-- Root cause: the previous `orders_select_participant` policy called
-- is_order_participant(), a SECURITY DEFINER function that re-queries
-- public.orders. SECURITY DEFINER functions execute against the pre-statement
-- snapshot, so they cannot see a row inserted in the *same* statement.
-- PostgREST's .select().single() appends RETURNING *, which evaluates the
-- SELECT policy immediately after the INSERT — and the function returned false,
-- causing "new row violates row-level security policy".
--
-- Fix: split into three direct policies.
--   • customer/partner: plain column equality (no function, no snapshot issue).
--   • driver: new order_has_driver_access() which only queries order_trips /
--     dispatch_offers, never re-queries orders, so it is safe here.

-- Driver-only access check. Queries only order_trips + dispatch_offers so it
-- never re-queries orders and avoids both the snapshot issue and RLS recursion.
create or replace function public.order_has_driver_access(target_order_id uuid)
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
    where t.order_id = target_order_id
      and d.candidate_id = auth.uid()
      and d.status = 'offered'
  );
$$;

drop policy if exists orders_select_participant on public.orders;

create policy orders_select_customer on public.orders
  for select using (customer_id = auth.uid());

create policy orders_select_partner on public.orders
  for select using (partner_id = auth.uid());

create policy orders_select_driver on public.orders
  for select using (public.order_has_driver_access(id));
