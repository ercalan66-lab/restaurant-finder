-- Rename the app from Fork to Kwetu in text people see: error messages from the admin functions
-- and the "your restaurant is now live" notification. Requires 202611200001_api_access_grants.sql.
-- Each function below is copied unchanged from the migration named above it except for the
-- brand name, so "create or replace" keeps its existing grants. Safe to run more than once.

-- From 202611180005_launch_readiness.sql (1 text change)
create or replace function public.admin_review_restaurant(p_restaurant_id bigint, p_approve boolean, p_reason text default '')
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Only Kwetu admins can review restaurants' using errcode = '42501';
  end if;
  if not p_approve and coalesce(btrim(p_reason), '') = '' then
    raise exception 'Tell the owner what needs to change' using errcode = '22023';
  end if;
  update public.restaurants
     set approval_status = case when p_approve then 'approved'::public.approval_status else 'rejected'::public.approval_status end,
         rejection_reason = case when p_approve then '' else btrim(p_reason) end
   where id = p_restaurant_id;
  if not found then
    raise exception 'Restaurant % not found', p_restaurant_id using errcode = '22023';
  end if;
end;
$$;

-- From 202611180005_launch_readiness.sql (1 text change)
create or replace function public.admin_update_listing(p_restaurant_id bigint, p_rating numeric, p_tag text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Only Kwetu admins can edit ratings and tags' using errcode = '42501';
  end if;
  if p_rating is null or p_rating < 0 or p_rating > 5 then
    raise exception 'Rating must be between 0 and 5' using errcode = '22023';
  end if;
  update public.restaurants set rating = round(p_rating, 1), tag = left(btrim(coalesce(p_tag, '')), 24)
   where id = p_restaurant_id;
end;
$$;

-- From 202611180005_launch_readiness.sql (1 text change)
create or replace function public.notify_restaurant_review()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_tokens text[];
begin
  if tg_op = 'INSERT' or (new.approval_status = 'pending' and old.approval_status is distinct from new.approval_status) then
    if new.approval_status <> 'pending' then return new; end if;
    select array_agg(t.token) into v_tokens from public.push_tokens t join public.admins a on a.user_id = t.user_id;
    perform public.send_push(v_tokens, 'Restaurant to review', new.name || ' · ' || new.area,
      jsonb_build_object('url', '/admin', 'restaurantId', new.id));
  elsif old.approval_status is distinct from new.approval_status then
    select array_agg(token) into v_tokens from public.push_tokens where user_id = new.owner_id;
    perform public.send_push(v_tokens, new.name,
      case new.approval_status
        when 'approved' then 'Your restaurant is now live on Kwetu.'
        else 'Your restaurant needs changes before it can go live: ' || new.rejection_reason end,
      jsonb_build_object('url', '/owner', 'restaurantId', new.id));
  end if;
  return new;
end;
$$;

-- From 202611180006_admin_console.sql (1 text change)
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
    raise exception 'Only Kwetu admins can see the overview' using errcode = '42501';
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

-- From 202611180006_admin_console.sql (1 text change)
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
    raise exception 'Only Kwetu admins can look up orders and bookings' using errcode = '42501';
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

-- From 202611180006_admin_console.sql (1 text change)
create or replace function public.admin_list_admins()
returns table (user_id uuid, account text, added_at timestamptz, is_me boolean)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'Only Kwetu admins can see the admin team' using errcode = '42501';
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

-- From 202611180006_admin_console.sql (2 text changes)
create or replace function public.admin_add_admin(p_account text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_input text := btrim(coalesce(p_account, ''));
  v_digits text := regexp_replace(coalesce(p_account, ''), '\D', '', 'g');
  v_user uuid;
  v_label text;
begin
  if not public.is_admin() then
    raise exception 'Only Kwetu admins can add admins' using errcode = '42501';
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
    raise exception 'No Kwetu account signs in with %. Ask them to create an account in the app first.', v_input using errcode = 'FB005';
  end if;
  insert into public.admins (user_id) values (v_user) on conflict (user_id) do nothing;
  return v_label;
end;
$$;

-- From 202611180006_admin_console.sql (3 text changes)
create or replace function public.admin_remove_admin(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Only Kwetu admins can remove admins' using errcode = '42501';
  end if;
  -- Serialize removals so two admins removing each other at once cannot leave Kwetu with none.
  lock table public.admins in share row exclusive mode;
  if not exists (select 1 from public.admins a where a.user_id = p_user_id) then
    return;
  end if;
  if (select count(*) from public.admins) <= 1 then
    raise exception 'Kwetu needs at least one admin. Add someone else before removing this account.' using errcode = 'FB006';
  end if;
  delete from public.admins a where a.user_id = p_user_id;
end;
$$;
