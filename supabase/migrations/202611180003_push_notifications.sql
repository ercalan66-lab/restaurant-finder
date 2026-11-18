-- Push notifications through Expo's push service, sent from the database with pg_net.
-- Owners hear about new orders and bookings; customers hear when theirs is accepted, ready,
-- confirmed, or declined. A failed send never blocks the order or booking itself.

create extension if not exists pg_net with schema extensions;

-- 1. Devices registered by signed-in users (owners, and customers with an account).
create table public.push_tokens (
  token text primary key check (token ~ '^Expo(nent)?PushToken\[.+\]$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null default '',
  updated_at timestamptz not null default now()
);
create index push_tokens_user_id_idx on public.push_tokens(user_id);
alter table public.push_tokens enable row level security;
create policy "users see their own devices" on public.push_tokens for select to authenticated using (user_id = (select auth.uid()));

-- Registration goes through functions so a device that changes accounts moves to the new account.
create or replace function public.register_push_token(p_token text, p_platform text default '')
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in before registering a device for notifications';
  end if;
  insert into public.push_tokens (token, user_id, platform, updated_at)
  values (p_token, auth.uid(), coalesce(p_platform, ''), now())
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end;
$$;

create or replace function public.unregister_push_token(p_token text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.push_tokens where token = p_token and user_id = auth.uid();
end;
$$;

revoke execute on function public.register_push_token(text, text) from public, anon;
revoke execute on function public.unregister_push_token(text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;

-- 2. The device that placed an order or booking, so guests are notified too.
alter table public.orders add column push_token text check (push_token is null or push_token ~ '^Expo(nent)?PushToken\[.+\]$');
alter table public.reservations add column push_token text check (push_token is null or push_token ~ '^Expo(nent)?PushToken\[.+\]$');

-- Device tokens are never readable through the API (otherwise owners could read customers' tokens),
-- and owners may change only the status fields of a request.
revoke select, update on public.orders from anon, authenticated;
grant select (id, reference, restaurant_id, customer_id, guest_name, guest_phone, guest_email, fulfillment, delivery_address, items, total, status, payment_method, payment_status, paid_at, created_at, updated_at)
  on public.orders to authenticated;
grant update (status, payment_status) on public.orders to authenticated;

revoke select, update on public.reservations from anon, authenticated;
grant select (id, reference, restaurant_id, customer_id, guest_name, guest_phone, guest_email, reservation_date, reservation_time, guest_count, status, created_at, updated_at)
  on public.reservations to authenticated;
grant update (status) on public.reservations to authenticated;

-- 3. Sends one message to each token (Expo accepts up to 100 per request).
create or replace function public.send_push(p_tokens text[], p_title text, p_body text, p_data jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  messages jsonb;
begin
  select jsonb_agg(jsonb_build_object('to', t.token, 'title', p_title, 'body', p_body, 'data', p_data, 'sound', 'default', 'priority', 'high'))
    into messages
    from (select distinct unnest(p_tokens) as token) t
    where t.token is not null;
  if messages is null then
    return;
  end if;
  begin
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := messages,
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
    );
  exception when others then
    raise warning 'Push notification not sent: %', sqlerrm;
  end;
end;
$$;
revoke execute on function public.send_push(text[], text, text, jsonb) from public, anon, authenticated;

-- 4. Orders: new order -> owner; accepted / ready / declined -> customer.
create or replace function public.notify_order_event()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_restaurant public.restaurants%rowtype;
  v_tokens text[];
  v_body text;
begin
  select * into v_restaurant from public.restaurants where id = new.restaurant_id;
  if tg_op = 'INSERT' then
    select array_agg(token) into v_tokens from public.push_tokens where user_id = v_restaurant.owner_id;
    perform public.send_push(
      v_tokens,
      'New order · ' || new.reference,
      new.guest_name || ' · ' || new.fulfillment || ' · TSh ' || to_char(new.total, 'FM999,999,999,990'),
      jsonb_build_object('url', '/owner', 'reference', new.reference)
    );
  elsif new.status is distinct from old.status then
    v_body := case new.status
      when 'accepted' then 'Your order ' || new.reference || ' was accepted.'
      when 'ready' then case new.fulfillment
        when 'Pickup' then 'Your order ' || new.reference || ' is ready for pickup.'
        else 'Your order ' || new.reference || ' is ready and on its way.' end
      when 'declined' then 'Sorry, your order ' || new.reference || ' was declined. Please call the restaurant.'
    end;
    if v_body is not null then
      select array_agg(token) into v_tokens from public.push_tokens where user_id = new.customer_id;
      perform public.send_push(
        array_append(coalesce(v_tokens, '{}'::text[]), new.push_token),
        v_restaurant.name,
        v_body,
        jsonb_build_object('url', '/profile', 'reference', new.reference)
      );
    end if;
  end if;
  return new;
end;
$$;

create trigger orders_notify after insert or update of status on public.orders
  for each row execute function public.notify_order_event();

-- 5. Bookings: new booking -> owner; confirmed / declined -> customer.
create or replace function public.notify_reservation_event()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_restaurant public.restaurants%rowtype;
  v_tokens text[];
  v_when text;
  v_body text;
begin
  select * into v_restaurant from public.restaurants where id = new.restaurant_id;
  v_when := to_char(new.reservation_date, 'FMDD Mon') || ' at ' || to_char(new.reservation_time, 'HH24:MI');
  if tg_op = 'INSERT' then
    select array_agg(token) into v_tokens from public.push_tokens where user_id = v_restaurant.owner_id;
    perform public.send_push(
      v_tokens,
      'New booking · ' || new.reference,
      new.guest_name || ' · ' || v_when || ' · ' || new.guest_count || case when new.guest_count = 1 then ' guest' else ' guests' end,
      jsonb_build_object('url', '/owner', 'reference', new.reference)
    );
  elsif new.status is distinct from old.status then
    v_body := case new.status
      when 'confirmed' then 'Your table on ' || v_when || ' is confirmed.'
      when 'declined' then 'Sorry, your booking for ' || v_when || ' could not be confirmed. Please call the restaurant.'
    end;
    if v_body is not null then
      select array_agg(token) into v_tokens from public.push_tokens where user_id = new.customer_id;
      perform public.send_push(
        array_append(coalesce(v_tokens, '{}'::text[]), new.push_token),
        v_restaurant.name,
        v_body,
        jsonb_build_object('url', '/profile', 'reference', new.reference)
      );
    end if;
  end if;
  return new;
end;
$$;

create trigger reservations_notify after insert or update of status on public.reservations
  for each row execute function public.notify_reservation_event();
