-- Admin tools (2026-11-28):
--   1. Orders nobody answers: after 15 minutes the owner is reminded and the admins are alerted;
--      after 30 minutes the order is cancelled and the customer is told. Runs every minute (pg_cron).
--   2. Admins can cancel an order, with a reason the customer and the restaurant see.
--   3. Admins can open an order's full details (dishes, address, email).
--   4. Admins can create and edit a restaurant, its menu and photos, then hand it to the owner's account.
-- Requires the earlier migrations. Safe to run more than once.

-- ---------------------------------------------------------------------------
-- 1. Order bookkeeping
-- ---------------------------------------------------------------------------
alter table public.orders
  add column if not exists cancelled_by text check (cancelled_by in ('customer', 'admin', 'timeout')),
  add column if not exists cancel_reason text not null default '' check (char_length(cancel_reason) <= 300),
  add column if not exists reminded_at timestamptz;
grant select (cancelled_by, cancel_reason) on public.orders to authenticated;

-- Customers cancelling (copied from 202611180005_launch_readiness.sql; now records who cancelled).
create or replace function public.cancel_request(p_reference text, p_phone text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  update public.orders set status = 'cancelled', cancelled_by = 'customer'
   where reference = p_reference and status = 'pending'
     and (customer_id = auth.uid() or (length(v_digits) >= 7 and regexp_replace(guest_phone, '\D', '', 'g') = v_digits));
  if found then return; end if;
  update public.reservations set status = 'cancelled'
   where reference = p_reference and status in ('pending', 'confirmed')
     and (customer_id = auth.uid() or (length(v_digits) >= 7 and regexp_replace(guest_phone, '\D', '', 'g') = v_digits));
  if found then return; end if;
  raise exception 'This request can no longer be cancelled. Please call the restaurant.' using errcode = 'FB003';
end;
$$;

-- Notifications (replaces the version from 202611210003_cash_only.sql; the orders_notify trigger stays).
-- New: different messages when Kwetu cancels an order, or when nobody answered it in time.
create or replace function public.notify_order_event()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_restaurant public.restaurants%rowtype;
  v_owner_tokens text[];
  v_customer_tokens text[];
  v_amount text := 'TSh ' || to_char(new.total, 'FM999,999,999,990');
  v_owner_title text;
  v_owner_body text;
  v_body text;
begin
  select * into v_restaurant from public.restaurants where id = new.restaurant_id;
  select array_agg(token) into v_owner_tokens from public.push_tokens where user_id = v_restaurant.owner_id;

  if tg_op = 'INSERT' then
    perform public.send_push(v_owner_tokens, 'New order · ' || new.reference,
      new.guest_name || ' · ' || new.fulfillment || ' · ' || v_amount,
      jsonb_build_object('url', '/owner', 'reference', new.reference));
    return new;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status::text = 'cancelled' then
    if new.cancelled_by = 'timeout' then
      v_owner_title := 'Order expired · ' || new.reference;
      v_owner_body := 'Nobody answered order ' || new.reference || ' within 30 minutes, so Kwetu cancelled it. Keep alerts on so you never miss an order.';
      v_body := 'Sorry, ' || v_restaurant.name || ' did not answer your order ' || new.reference || ' in time, so it was cancelled. You have not paid anything. Please try another restaurant.';
    elsif new.cancelled_by = 'admin' then
      v_owner_title := 'Order cancelled by Kwetu · ' || new.reference;
      v_owner_body := coalesce(nullif(new.cancel_reason, ''), 'Kwetu cancelled this order.');
      v_body := 'Your order ' || new.reference || ' was cancelled by Kwetu: ' || coalesce(nullif(new.cancel_reason, ''), 'please contact the restaurant.');
    else
      v_owner_title := 'Order cancelled · ' || new.reference;
      v_owner_body := new.guest_name || ' cancelled their order.';
    end if;
    perform public.send_push(v_owner_tokens, v_owner_title, v_owner_body, jsonb_build_object('url', '/owner', 'reference', new.reference));
  else
    v_body := case new.status::text
      when 'accepted' then 'Your order ' || new.reference || ' was accepted.'
      when 'ready' then case new.fulfillment
        when 'Pickup' then 'Your order ' || new.reference || ' is ready for pickup. Please bring ' || v_amount || ' in cash.'
        else 'Your order ' || new.reference || ' is on its way. Please have ' || v_amount || ' in cash for the rider.' end
      -- Only orders from before the cash-only change still pass through "delivered".
      when 'delivered' then 'Your order ' || new.reference || ' has arrived. Please pay the rider ' || v_amount || ' in cash.'
      when 'completed' then 'Thank you! Your order ' || new.reference || ' is complete. You can rate it in Kwetu.'
      when 'declined' then 'Sorry, your order ' || new.reference || ' was declined. Please call the restaurant.'
    end;
  end if;

  if v_body is not null then
    select array_agg(token) into v_customer_tokens from public.push_tokens where user_id = new.customer_id;
    perform public.send_push(array_append(coalesce(v_customer_tokens, '{}'::text[]), new.push_token),
      v_restaurant.name, v_body, jsonb_build_object('url', '/profile', 'reference', new.reference));
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Orders nobody answers (every minute)
-- ---------------------------------------------------------------------------
create or replace function public.handle_waiting_orders()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_order record;
  v_tokens text[];
  v_count integer := 0;
  v_first text;
begin
  -- After 15 minutes: remind the restaurant once, and collect the orders for the admins.
  for v_order in
    update public.orders o set reminded_at = now()
     where o.status = 'pending' and o.reminded_at is null and o.created_at < now() - interval '15 minutes'
    returning o.reference, o.restaurant_id
  loop
    select array_agg(t.token) into v_tokens
      from public.push_tokens t join public.restaurants r on r.owner_id = t.user_id
     where r.id = v_order.restaurant_id;
    perform public.send_push(v_tokens, 'Order waiting · ' || v_order.reference,
      'A customer has waited 15 minutes. Accept or decline order ' || v_order.reference || ' now.',
      jsonb_build_object('url', '/owner', 'reference', v_order.reference));
    v_count := v_count + 1;
    if v_first is null then
      select v_order.reference || ' at ' || r.name into v_first from public.restaurants r where r.id = v_order.restaurant_id;
    end if;
  end loop;

  if v_count > 0 then
    select array_agg(t.token) into v_tokens from public.push_tokens t join public.admins a on a.user_id = t.user_id;
    perform public.send_push(v_tokens, 'Orders waiting',
      case when v_count = 1 then 'Order ' || v_first || ' has waited 15 minutes without an answer.'
        else v_count || ' orders have waited 15 minutes without an answer.' end,
      jsonb_build_object('url', '/admin'));
  end if;

  -- After 30 minutes: cancel. The orders_notify trigger tells the customer and the restaurant.
  update public.orders
     set status = 'cancelled', cancelled_by = 'timeout', cancel_reason = 'The restaurant did not answer within 30 minutes.'
   where status = 'pending' and created_at < now() - interval '30 minutes';
end;
$$;
revoke execute on function public.handle_waiting_orders() from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('kwetu-waiting-orders', '* * * * *', 'select public.handle_waiting_orders()');

-- ---------------------------------------------------------------------------
-- 3. Admins cancel an order, and see its details
-- ---------------------------------------------------------------------------
create or replace function public.admin_cancel_order(p_reference text, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_reason text := left(btrim(coalesce(p_reason, '')), 300);
begin
  if not public.is_admin() then
    raise exception 'Only Kwetu admins can cancel orders' using errcode = '42501';
  end if;
  if v_reason = '' then
    raise exception 'Tell the customer why the order is cancelled' using errcode = '22023';
  end if;
  update public.orders
     set status = 'cancelled', cancelled_by = 'admin', cancel_reason = v_reason
   where reference = p_reference and status::text in ('pending', 'accepted', 'preparing', 'ready', 'delivered');
  if not found then
    raise exception 'This order is already finished, so it cannot be cancelled' using errcode = '22023';
  end if;
end;
$$;
revoke execute on function public.admin_cancel_order(text, text) from public, anon;
grant execute on function public.admin_cancel_order(text, text) to authenticated;

create or replace function public.admin_order_details(p_reference text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_order jsonb;
begin
  if not public.is_admin() then
    raise exception 'Only Kwetu admins can open orders' using errcode = '42501';
  end if;
  select jsonb_build_object(
      'reference', o.reference, 'status', o.status, 'createdAt', o.created_at, 'updatedAt', o.updated_at,
      'restaurantId', r.id, 'restaurantName', r.name, 'restaurantPhone', r.phone,
      'customerName', o.guest_name, 'customerPhone', o.guest_phone, 'customerEmail', o.guest_email,
      'signedIn', o.customer_id is not null,
      'fulfillment', o.fulfillment, 'deliveryAddress', o.delivery_address, 'items', o.items, 'total', o.total,
      'paymentStatus', o.payment_status, 'paymentMethod', o.payment_method, 'paidAt', o.paid_at,
      'cancelledBy', o.cancelled_by, 'cancelReason', o.cancel_reason, 'remindedAt', o.reminded_at)
    into v_order
    from public.orders o join public.restaurants r on r.id = o.restaurant_id
   where o.reference = p_reference;
  if v_order is null then
    raise exception 'Order % not found', p_reference using errcode = '22023';
  end if;
  return v_order;
end;
$$;
revoke execute on function public.admin_order_details(text) from public, anon;
grant execute on function public.admin_order_details(text) to authenticated;

-- The overview gains "waiting 15+ minutes". Its columns change, so it is dropped and created again.
drop function if exists public.admin_overview();
create function public.admin_overview()
returns table (
  restaurants_waiting integer,
  restaurants_live integer,
  restaurants_changes_requested integer,
  orders_today integer,
  orders_in_progress integer,
  orders_waiting_long integer,
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
    (select count(*)::integer from public.orders o where o.status::text = 'pending' and o.created_at < now() - interval '15 minutes'),
    -- Completed orders, whichever way they were paid (pickup orders are paid at the counter).
    (select coalesce(sum(o.total), 0)::bigint from public.orders o where o.status::text = 'completed' and o.updated_at >= now() - interval '7 days');
end;
$$;
revoke execute on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Restaurants set up by admins
-- ---------------------------------------------------------------------------
-- Admins may add and edit any restaurant, its dishes and its files (the owners' own rules stay).
drop policy if exists "admins create restaurants" on public.restaurants;
create policy "admins create restaurants" on public.restaurants for insert to authenticated
  with check ((select public.is_admin()));
drop policy if exists "admins update restaurants" on public.restaurants;
create policy "admins update restaurants" on public.restaurants for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "admins manage menu items" on public.menu_items;
create policy "admins manage menu items" on public.menu_items for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "admins add restaurant files" on storage.objects;
create policy "admins add restaurant files" on storage.objects for insert to authenticated
  with check (bucket_id in ('restaurant-photos', 'restaurant-menus') and (select public.is_admin()));
drop policy if exists "admins read restaurant files" on storage.objects;
create policy "admins read restaurant files" on storage.objects for select to authenticated
  using (bucket_id in ('restaurant-photos', 'restaurant-menus') and (select public.is_admin()));
drop policy if exists "admins remove restaurant files" on storage.objects;
create policy "admins remove restaurant files" on storage.objects for delete to authenticated
  using (bucket_id in ('restaurant-photos', 'restaurant-menus') and (select public.is_admin()));

-- The account that owns a restaurant (email, or phone for SMS accounts), for the admin console.
create or replace function public.admin_restaurant_owner(p_restaurant_id bigint)
returns text language plpgsql stable security definer set search_path = '' as $$
declare
  v_label text;
begin
  if not public.is_admin() then
    raise exception 'Only Kwetu admins can see restaurant owners' using errcode = '42501';
  end if;
  select coalesce(nullif(u.email, ''), '+' || u.phone) into v_label
    from public.restaurants r join auth.users u on u.id = r.owner_id
   where r.id = p_restaurant_id;
  return v_label;
end;
$$;
revoke execute on function public.admin_restaurant_owner(bigint) from public, anon;
grant execute on function public.admin_restaurant_owner(bigint) to authenticated;

-- Hands a restaurant to an existing account (found by email or phone number) and lets that account
-- open the restaurant dashboard. Returns the account as shown in the console.
create or replace function public.admin_assign_owner(p_restaurant_id bigint, p_account text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_input text := btrim(coalesce(p_account, ''));
  v_digits text := regexp_replace(coalesce(p_account, ''), '\D', '', 'g');
  v_user uuid;
  v_label text;
  v_name text;
  v_tokens text[];
begin
  if not public.is_admin() then
    raise exception 'Only Kwetu admins can hand restaurants to owners' using errcode = '42501';
  end if;
  select r.name into v_name from public.restaurants r where r.id = p_restaurant_id;
  if v_name is null then
    raise exception 'Restaurant % not found', p_restaurant_id using errcode = '22023';
  end if;

  if position('@' in v_input) > 0 then
    select u.id, u.email into v_user, v_label from auth.users u where lower(u.email) = lower(v_input) limit 1;
  elsif length(v_digits) >= 9 then
    -- Local numbers: 0712… and 712… become 255712…
    if v_digits like '0%' then v_digits := '255' || substr(v_digits, 2);
    elsif length(v_digits) = 9 then v_digits := '255' || v_digits;
    end if;
    select u.id, coalesce(nullif(u.email, ''), '+' || u.phone) into v_user, v_label
      from auth.users u
     where u.phone = v_digits or regexp_replace(coalesce(u.raw_user_meta_data ->> 'phone', ''), '\D', '', 'g') = v_digits
     order by (u.phone = v_digits) desc nulls last, u.created_at
     limit 1;
  end if;
  if v_user is null then
    raise exception 'No Kwetu account uses %. Ask the owner to create an account in the app first.', v_input using errcode = 'P0002';
  end if;
  if exists (select 1 from public.restaurants r where r.owner_id = v_user and r.id <> p_restaurant_id) then
    raise exception 'That account already manages another restaurant.' using errcode = '23505';
  end if;

  update public.restaurants set owner_id = v_user where id = p_restaurant_id;
  -- The restaurant dashboard opens only for restaurant-owner accounts.
  update auth.users
     set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'owner')
   where id = v_user;

  select array_agg(t.token) into v_tokens from public.push_tokens t where t.user_id = v_user;
  perform public.send_push(v_tokens, v_name,
    'Kwetu has set up ' || v_name || ' for you. Open your restaurant dashboard to see orders and edit the menu.',
    jsonb_build_object('url', '/owner', 'restaurantId', p_restaurant_id));
  return v_label;
end;
$$;
revoke execute on function public.admin_assign_owner(bigint, text) from public, anon;
grant execute on function public.admin_assign_owner(bigint, text) to authenticated;

-- Approving needs an owner, so someone receives the restaurant's orders.
-- (Copied from 202611200002_rename_to_kwetu.sql with that one check added.)
create or replace function public.admin_review_restaurant(p_restaurant_id bigint, p_approve boolean, p_reason text default '')
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Only Kwetu admins can review restaurants' using errcode = '42501';
  end if;
  if not p_approve and coalesce(btrim(p_reason), '') = '' then
    raise exception 'Tell the owner what needs to change' using errcode = '22023';
  end if;
  if p_approve and exists (select 1 from public.restaurants r where r.id = p_restaurant_id and r.owner_id is null) then
    raise exception 'Hand this restaurant to its owner before approving it, so someone receives its orders.' using errcode = '22023';
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
