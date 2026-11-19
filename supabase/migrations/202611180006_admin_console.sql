-- Admin console: platform overview, order and booking lookup for support, and managing the admin
-- team from the app. Requires 202611180005_launch_readiness.sql to have been run first.
--
-- Only an admin can add admins, so the very first one is still added in the SQL editor:
--   insert into public.admins (user_id) select id from auth.users where email = 'you@example.com';
--
-- Every function checks is_admin() itself and is security definer, so admins read through these
-- functions instead of through wider table policies (which would make every admin's own order
-- history screen download the whole platform's orders).

-- ---------------------------------------------------------------------------
-- 1. Overview numbers. "Today" is counted in East Africa Time.
-- ---------------------------------------------------------------------------
create or replace function public.admin_overview()
returns table (
  restaurants_waiting integer,
  restaurants_live integer,
  restaurants_changes_requested integer,
  orders_today integer,
  orders_in_progress integer,
  tables_today integer,
  sales_last_7_days bigint
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_today date := (now() at time zone 'Africa/Dar_es_Salaam')::date;
begin
  if not public.is_admin() then
    raise exception 'Only Fork admins can see the overview' using errcode = '42501';
  end if;
  return query select
    (select count(*)::integer from public.restaurants r where r.approval_status = 'pending'),
    (select count(*)::integer from public.restaurants r where r.approval_status = 'approved' and r.is_active),
    (select count(*)::integer from public.restaurants r where r.approval_status = 'rejected'),
    (select count(*)::integer from public.orders o where (o.created_at at time zone 'Africa/Dar_es_Salaam')::date = v_today),
    (select count(*)::integer from public.orders o where o.status::text in ('pending', 'accepted', 'preparing', 'ready', 'delivered')),
    (select count(*)::integer from public.reservations b where b.reservation_date = v_today and b.status::text in ('pending', 'confirmed')),
    -- Completed orders, whichever way they were paid (pickup orders are paid at the counter).
    (select coalesce(sum(o.total), 0)::bigint from public.orders o where o.status::text = 'completed' and o.updated_at >= now() - interval '7 days');
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Find orders and bookings to help a customer or restaurant. Read only: status changes stay
--    with the restaurant. Matches the reference, customer name, restaurant name, or phone digits.
-- ---------------------------------------------------------------------------
create or replace function public.admin_find_requests(p_search text default '', p_limit integer default 40)
returns table (
  kind text,
  reference text,
  restaurant_id bigint,
  restaurant_name text,
  customer_name text,
  customer_phone text,
  status text,
  created_at timestamptz,
  fulfillment text,
  total integer,
  payment_status text,
  payment_method text,
  booking_date date,
  booking_time time,
  guest_count integer
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_search text := btrim(coalesce(p_search, ''));
  v_digits text := regexp_replace(coalesce(p_search, ''), '\D', '', 'g');
  v_limit integer := least(greatest(coalesce(p_limit, 40), 1), 100);
begin
  if not public.is_admin() then
    raise exception 'Only Fork admins can look up orders and bookings' using errcode = '42501';
  end if;
  return query
  select matches.* from (
    select 'order'::text, o.reference, o.restaurant_id, r.name, o.guest_name, o.guest_phone, o.status::text, o.created_at,
           o.fulfillment::text, o.total, o.payment_status::text, o.payment_method::text, null::date, null::time, null::integer
      from public.orders o
      join public.restaurants r on r.id = o.restaurant_id
     where v_search = ''
        or o.reference ilike '%' || v_search || '%'
        or o.guest_name ilike '%' || v_search || '%'
        or r.name ilike '%' || v_search || '%'
        or (length(v_digits) >= 4 and regexp_replace(o.guest_phone, '\D', '', 'g') like '%' || v_digits || '%')
    union all
    select 'booking'::text, b.reference, b.restaurant_id, r.name, b.guest_name, b.guest_phone, b.status::text, b.created_at,
           null::text, null::integer, null::text, null::text, b.reservation_date, b.reservation_time, b.guest_count
      from public.reservations b
      join public.restaurants r on r.id = b.restaurant_id
     where v_search = ''
        or b.reference ilike '%' || v_search || '%'
        or b.guest_name ilike '%' || v_search || '%'
        or r.name ilike '%' || v_search || '%'
        or (length(v_digits) >= 4 and regexp_replace(b.guest_phone, '\D', '', 'g') like '%' || v_digits || '%')
  ) matches
  order by 8 desc
  limit v_limit;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. The admin team
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_admins()
returns table (user_id uuid, account text, added_at timestamptz, is_me boolean)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'Only Fork admins can see the admin team' using errcode = '42501';
  end if;
  return query
    select a.user_id,
           coalesce(nullif(u.email, ''), case when coalesce(u.phone, '') <> '' then '+' || u.phone end, 'Account ' || left(a.user_id::text, 8)),
           a.created_at,
           a.user_id = auth.uid()
      from public.admins a
      join auth.users u on u.id = a.user_id
     order by a.created_at;
end;
$$;

-- Adds the account that signs in with this email or phone number. Returns how the account is shown.
create or replace function public.admin_add_admin(p_account text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_input text := btrim(coalesce(p_account, ''));
  v_digits text := regexp_replace(coalesce(p_account, ''), '\D', '', 'g');
  v_user uuid;
  v_label text;
begin
  if not public.is_admin() then
    raise exception 'Only Fork admins can add admins' using errcode = '42501';
  end if;
  if v_input = '' then
    raise exception 'Enter the email or phone number the person signs in with' using errcode = '22023';
  end if;

  if position('@' in v_input) > 0 then
    select u.id, u.email into v_user, v_label from auth.users u where lower(u.email) = lower(v_input) limit 1;
  else
    -- Supabase stores phones as digits with the country code: 0712 345 678 is 255712345678.
    if v_digits like '00%' then v_digits := substr(v_digits, 3);
    elsif v_digits like '0%' then v_digits := '255' || substr(v_digits, 2);
    elsif length(v_digits) = 9 then v_digits := '255' || v_digits;
    end if;
    select u.id, '+' || u.phone into v_user, v_label from auth.users u where u.phone = v_digits limit 1;
  end if;

  if v_user is null then
    raise exception 'No Fork account signs in with %. Ask them to create an account in the app first.', v_input using errcode = 'FB005';
  end if;
  insert into public.admins (user_id) values (v_user) on conflict (user_id) do nothing;
  return v_label;
end;
$$;

create or replace function public.admin_remove_admin(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Only Fork admins can remove admins' using errcode = '42501';
  end if;
  -- Serialize removals so two admins removing each other at once cannot leave Fork with none.
  lock table public.admins in share row exclusive mode;
  if not exists (select 1 from public.admins a where a.user_id = p_user_id) then
    return;
  end if;
  if (select count(*) from public.admins) <= 1 then
    raise exception 'Fork needs at least one admin. Add someone else before removing this account.' using errcode = 'FB006';
  end if;
  delete from public.admins a where a.user_id = p_user_id;
end;
$$;

revoke execute on function public.admin_overview() from public, anon;
revoke execute on function public.admin_find_requests(text, integer) from public, anon;
revoke execute on function public.admin_list_admins() from public, anon;
revoke execute on function public.admin_add_admin(text) from public, anon;
revoke execute on function public.admin_remove_admin(uuid) from public, anon;
grant execute on function public.admin_overview() to authenticated;
grant execute on function public.admin_find_requests(text, integer) to authenticated;
grant execute on function public.admin_list_admins() to authenticated;
grant execute on function public.admin_add_admin(text) to authenticated;
grant execute on function public.admin_remove_admin(uuid) to authenticated;
