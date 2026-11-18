-- Restaurant approval, booking capacity, cancellation, pay-on-delivery, live status for guests,
-- and account deletion. Requires 202611180004_status_values.sql to have been run first.

-- ---------------------------------------------------------------------------
-- 1. Fork admins. Managed in the SQL editor: insert into public.admins (user_id) values ('…');
-- ---------------------------------------------------------------------------
create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
-- No policies: the table is read only through is_admin().

-- Stays executable by anon, because restaurant policies call it for every visitor.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- 2. Restaurant approval and booking capacity
-- ---------------------------------------------------------------------------
create type public.approval_status as enum ('pending', 'approved', 'rejected');

-- Existing restaurants (the demo ones and any already created) stay live; new ones wait for review.
alter table public.restaurants
  add column approval_status public.approval_status not null default 'approved',
  add column rejection_reason text not null default '',
  add column seats_per_slot integer not null default 40 check (seats_per_slot between 1 and 500);
alter table public.restaurants alter column approval_status set default 'pending';

grant insert (seats_per_slot) on public.restaurants to authenticated;
grant update (seats_per_slot) on public.restaurants to authenticated;

drop policy "active restaurants are public" on public.restaurants;
create policy "approved restaurants are public" on public.restaurants for select using (
  (is_active and approval_status = 'approved') or owner_id = (select auth.uid()) or (select public.is_admin())
);

drop policy "menu is public" on public.menu_items;
create policy "menus of approved restaurants are public" on public.menu_items for select using (
  exists (
    select 1 from public.restaurants r
    where r.id = restaurant_id
      and ((r.is_active and r.approval_status = 'approved') or r.owner_id = (select auth.uid()) or (select public.is_admin()))
  )
);

-- Orders and bookings can only be sent to approved, visible restaurants.
drop policy "anyone submits orders" on public.orders;
create policy "anyone submits orders" on public.orders for insert to anon, authenticated with check (
  (customer_id is null or customer_id = (select auth.uid()))
  and payment_status = 'unpaid'
  and paid_at is null
  and exists (select 1 from public.restaurants r where r.id = restaurant_id and r.is_active and r.approval_status = 'approved')
);
drop policy "anyone submits reservations" on public.reservations;
create policy "anyone submits reservations" on public.reservations for insert to anon, authenticated with check (
  (customer_id is null or customer_id = (select auth.uid()))
  and exists (select 1 from public.restaurants r where r.id = restaurant_id and r.is_active and r.approval_status = 'approved')
);

-- A rejected restaurant goes back into review as soon as its owner edits it.
create or replace function public.resubmit_rejected_restaurant()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if old.approval_status = 'rejected' and new.approval_status = 'rejected' and new.owner_id = auth.uid() then
    new.approval_status := 'pending';
    new.rejection_reason := '';
  end if;
  return new;
end;
$$;
create trigger restaurants_resubmit before update on public.restaurants
  for each row execute function public.resubmit_rejected_restaurant();

create or replace function public.admin_review_restaurant(p_restaurant_id bigint, p_approve boolean, p_reason text default '')
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Only Fork admins can review restaurants' using errcode = '42501';
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

create or replace function public.admin_update_listing(p_restaurant_id bigint, p_rating numeric, p_tag text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Only Fork admins can edit ratings and tags' using errcode = '42501';
  end if;
  if p_rating is null or p_rating < 0 or p_rating > 5 then
    raise exception 'Rating must be between 0 and 5' using errcode = '22023';
  end if;
  update public.restaurants set rating = round(p_rating, 1), tag = left(btrim(coalesce(p_tag, '')), 24)
   where id = p_restaurant_id;
end;
$$;

revoke execute on function public.admin_review_restaurant(bigint, boolean, text) from public, anon;
revoke execute on function public.admin_update_listing(bigint, numeric, text) from public, anon;
grant execute on function public.admin_review_restaurant(bigint, boolean, text) to authenticated;
grant execute on function public.admin_update_listing(bigint, numeric, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Booking capacity: seats per time slot, enforced on insert
-- ---------------------------------------------------------------------------
create or replace function public.slot_availability(p_restaurant_id bigint, p_date date)
returns table (slot_time time, booked integer)
language sql stable security definer set search_path = '' as $$
  select r.reservation_time, sum(r.guest_count)::integer
    from public.reservations r
   where r.restaurant_id = p_restaurant_id
     and r.reservation_date = p_date
     and r.status in ('pending', 'confirmed')
   group by r.reservation_time;
$$;

create or replace function public.check_reservation_capacity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_capacity integer;
  v_booked integer;
begin
  if new.reservation_date < current_date then
    raise exception 'That date has already passed' using errcode = 'FB002';
  end if;
  -- Serialize bookings for the same slot so two guests cannot take the last seats at once.
  perform pg_advisory_xact_lock(hashtextextended(new.restaurant_id::text || '|' || new.reservation_date::text || '|' || new.reservation_time::text, 0));
  select seats_per_slot into v_capacity from public.restaurants where id = new.restaurant_id;
  select coalesce(sum(guest_count), 0) into v_booked
    from public.reservations
   where restaurant_id = new.restaurant_id
     and reservation_date = new.reservation_date
     and reservation_time = new.reservation_time
     and status in ('pending', 'confirmed');
  if v_booked + new.guest_count > coalesce(v_capacity, 40) then
    raise exception 'Only % seats are left at that time', greatest(coalesce(v_capacity, 40) - v_booked, 0) using errcode = 'FB001';
  end if;
  return new;
end;
$$;
create trigger reservations_capacity before insert on public.reservations
  for each row execute function public.check_reservation_capacity();

-- ---------------------------------------------------------------------------
-- 4. Customer actions that work for guests too (they prove ownership with the order's phone number)
-- ---------------------------------------------------------------------------
alter table public.orders add column payment_reference text;
grant select (payment_reference) on public.orders to authenticated;
-- Owners record cash handed to the rider.
grant update (payment_method) on public.orders to authenticated;

-- Live status for the requests this phone placed. Returns no personal details.
create or replace function public.request_statuses(p_references text[])
returns table (reference text, status text, payment_status text, payment_method text, payment_reference text)
language sql stable security definer set search_path = '' as $$
  select o.reference, o.status::text, o.payment_status::text, o.payment_method::text, o.payment_reference
    from public.orders o where o.reference = any (p_references[1:200])
  union all
  select r.reference, r.status::text, null, null, null
    from public.reservations r where r.reference = any (p_references[1:200]);
$$;

-- Orders can be cancelled while pending; bookings while pending or confirmed.
create or replace function public.cancel_request(p_reference text, p_phone text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  update public.orders set status = 'cancelled'
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

-- Pay a delivered delivery order by mobile money. SIMULATED: a real gateway (Selcom, AzamPay,
-- ClickPesa) would confirm the payment server-side before the order is marked paid.
create or replace function public.pay_order(p_reference text, p_phone text, p_method text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_payment_reference text := 'SIM-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10));
begin
  if p_method not in ('mpesa', 'tigo_pesa', 'airtel_money') then
    raise exception 'Choose M-Pesa, Tigo Pesa or Airtel Money' using errcode = '22023';
  end if;
  update public.orders
     set payment_method = p_method::public.payment_method,
         payment_status = 'paid',
         payment_reference = v_payment_reference,
         status = 'completed'
   where reference = p_reference
     and fulfillment = 'Delivery'
     and status = 'delivered'
     and payment_status = 'unpaid'
     and (customer_id = auth.uid() or (length(v_digits) >= 7 and regexp_replace(guest_phone, '\D', '', 'g') = v_digits));
  if not found then
    raise exception 'This order cannot be paid right now. Only delivered, unpaid delivery orders can be paid in the app.' using errcode = 'FB004';
  end if;
  return v_payment_reference;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Account deletion (required by the App Store and Google Play)
-- ---------------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Sign in before deleting your account' using errcode = '42501';
  end if;
  -- An owner's restaurant is hidden rather than deleted, because past orders still reference it.
  update public.restaurants set is_active = false, owner_id = null where owner_id = v_user;
  -- Restaurants keep their order history, without the customer's personal details.
  update public.orders
     set guest_name = 'Deleted customer', guest_phone = '', guest_email = '', delivery_address = '', push_token = null, customer_id = null
   where customer_id = v_user;
  update public.reservations
     set guest_name = 'Deleted customer', guest_phone = '', guest_email = '', push_token = null, customer_id = null
   where customer_id = v_user;
  delete from public.push_tokens where user_id = v_user;
  delete from public.admins where user_id = v_user;
  begin
    update storage.objects set owner = null where owner = v_user;
  exception when others then
    null; -- Older or newer storage schemas may not have this column; photos simply stay unowned.
  end;
  delete from auth.users where id = v_user;
end;
$$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Notifications for the new events (replaces the functions from 202611180003)
-- ---------------------------------------------------------------------------
create or replace function public.payment_method_label(p_method text)
returns text language sql immutable set search_path = '' as $$
  select case p_method when 'mpesa' then 'M-Pesa' when 'tigo_pesa' then 'Tigo Pesa' when 'airtel_money' then 'Airtel Money' else 'cash' end;
$$;

create or replace function public.notify_order_event()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_restaurant public.restaurants%rowtype;
  v_owner_tokens text[];
  v_customer_tokens text[];
  v_amount text := 'TSh ' || to_char(new.total, 'FM999,999,999,990');
  v_body text;
  v_url text := '/profile';
begin
  select * into v_restaurant from public.restaurants where id = new.restaurant_id;
  select array_agg(token) into v_owner_tokens from public.push_tokens where user_id = v_restaurant.owner_id;

  if tg_op = 'INSERT' then
    perform public.send_push(v_owner_tokens, 'New order · ' || new.reference,
      new.guest_name || ' · ' || new.fulfillment || ' · ' || v_amount,
      jsonb_build_object('url', '/owner', 'reference', new.reference));
    return new;
  end if;

  if new.status is distinct from old.status then
    if new.status::text = 'cancelled' then
      perform public.send_push(v_owner_tokens, 'Order cancelled · ' || new.reference,
        new.guest_name || ' cancelled their order.', jsonb_build_object('url', '/owner', 'reference', new.reference));
    else
      v_body := case new.status::text
        when 'accepted' then 'Your order ' || new.reference || ' was accepted.'
        when 'ready' then case new.fulfillment
          when 'Pickup' then 'Your order ' || new.reference || ' is ready for pickup.'
          else 'Your order ' || new.reference || ' is on its way.' end
        when 'delivered' then 'Your order ' || new.reference || ' has arrived. Pay ' || v_amount || ' in the app by mobile money, or in cash to the rider.'
        when 'declined' then 'Sorry, your order ' || new.reference || ' was declined. Please call the restaurant.'
      end;
      if new.status::text = 'delivered' then
        v_url := '/pay/' || new.reference;
      end if;
      if v_body is not null then
        select array_agg(token) into v_customer_tokens from public.push_tokens where user_id = new.customer_id;
        perform public.send_push(array_append(coalesce(v_customer_tokens, '{}'::text[]), new.push_token),
          v_restaurant.name, v_body, jsonb_build_object('url', v_url, 'reference', new.reference));
      end if;
    end if;
  end if;

  if new.payment_status = 'paid' and old.payment_status is distinct from new.payment_status and new.payment_method::text <> 'cash' then
    perform public.send_push(v_owner_tokens, 'Paid · ' || new.reference,
      v_amount || ' paid by ' || public.payment_method_label(new.payment_method::text) || '.',
      jsonb_build_object('url', '/owner', 'reference', new.reference));
  end if;
  return new;
end;
$$;

drop trigger orders_notify on public.orders;
create trigger orders_notify after insert or update of status, payment_status on public.orders
  for each row execute function public.notify_order_event();

create or replace function public.notify_reservation_event()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_restaurant public.restaurants%rowtype;
  v_owner_tokens text[];
  v_customer_tokens text[];
  v_when text := to_char(new.reservation_date, 'FMDD Mon') || ' at ' || to_char(new.reservation_time, 'HH24:MI');
  v_body text;
begin
  select * into v_restaurant from public.restaurants where id = new.restaurant_id;
  select array_agg(token) into v_owner_tokens from public.push_tokens where user_id = v_restaurant.owner_id;
  if tg_op = 'INSERT' then
    perform public.send_push(v_owner_tokens, 'New booking · ' || new.reference,
      new.guest_name || ' · ' || v_when || ' · ' || new.guest_count || case when new.guest_count = 1 then ' guest' else ' guests' end,
      jsonb_build_object('url', '/owner', 'reference', new.reference));
  elsif new.status is distinct from old.status then
    if new.status::text = 'cancelled' then
      perform public.send_push(v_owner_tokens, 'Booking cancelled · ' || new.reference,
        new.guest_name || ' cancelled their table for ' || v_when || '.', jsonb_build_object('url', '/owner', 'reference', new.reference));
    else
      v_body := case new.status::text
        when 'confirmed' then 'Your table on ' || v_when || ' is confirmed.'
        when 'declined' then 'Sorry, your booking for ' || v_when || ' could not be confirmed. Please call the restaurant.'
      end;
      if v_body is not null then
        select array_agg(token) into v_customer_tokens from public.push_tokens where user_id = new.customer_id;
        perform public.send_push(array_append(coalesce(v_customer_tokens, '{}'::text[]), new.push_token),
          v_restaurant.name, v_body, jsonb_build_object('url', '/profile', 'reference', new.reference));
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- Admins hear about restaurants to review; owners hear the outcome.
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
        when 'approved' then 'Your restaurant is now live on Fork.'
        else 'Your restaurant needs changes before it can go live: ' || new.rejection_reason end,
      jsonb_build_object('url', '/owner', 'restaurantId', new.id));
  end if;
  return new;
end;
$$;
-- Fires on every update (not just "update of approval_status"), because an owner's edit can move a
-- rejected restaurant back to pending inside the resubmit trigger without naming that column.
create trigger restaurants_review_notify after insert or update on public.restaurants
  for each row execute function public.notify_restaurant_review();
