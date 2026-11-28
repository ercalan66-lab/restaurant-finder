-- Order texts by SMS (2026-11-28), through the same SMS company as the sign-in codes
-- (202611280001_sms_sign_in.sql must be run first: it defines private.send_sms). Push notifications
-- keep working as before; the SMS also reaches people without the app's notifications.
--
--   Customers, in the language they use the app in: order received, ready for pickup / on its way,
--   declined by the restaurant, cancelled by Kwetu or because nobody answered (with the reason).
--   Restaurants, in Kiswahili and English: each new order, and each cancelled order.
--
-- Each SMS costs money (about TSh 16–25), so either kind can be switched off in the SQL editor:
--   update private.sms_settings set order_sms_customers = false;    -- no texts to customers
--   update private.sms_settings set order_sms_restaurants = false;  -- no texts to restaurants
-- Nothing is sent until private.configure_nextsms(...) has stored the SMS company's login.
-- Safe to run more than once.

alter table private.sms_settings
  add column if not exists order_sms_customers boolean not null default true,
  add column if not exists order_sms_restaurants boolean not null default true;

-- The app sends the customer's language with each order ('en' for orders from older app versions).
alter table public.orders
  add column if not exists language text not null default 'en' check (language in ('en', 'sw'));

-- Order texts. Runs after each new order and each status change (next to the push notifications).
create or replace function public.sms_order_event()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_settings private.sms_settings%rowtype;
  v_restaurant public.restaurants%rowtype;
  v_restaurant_phone text;
  v_sw boolean := new.language = 'sw';
  v_amount text := 'TSh ' || to_char(new.total, 'FM999,999,999,990');
  v_reason text := left(coalesce(nullif(btrim(new.cancel_reason), ''), ''), 100);
  v_kind text;
  v_customer text;
  v_owner text;
begin
  select * into v_settings from private.sms_settings s where s.id;
  if v_settings.id is null then
    return new; -- SMS is not set up
  end if;
  select * into v_restaurant from public.restaurants r where r.id = new.restaurant_id;
  -- The restaurant's listed phone, or else the owner's own number.
  select coalesce(nullif(v_restaurant.phone, ''), nullif(u.phone, ''), u.raw_user_meta_data ->> 'phone')
    into v_restaurant_phone from auth.users u where u.id = v_restaurant.owner_id;
  v_restaurant_phone := coalesce(v_restaurant_phone, nullif(v_restaurant.phone, ''));
  v_kind := case new.fulfillment::text when 'Delivery' then 'Kuletewa/Delivery' else 'Kuchukua/Pickup' end;

  if tg_op = 'INSERT' then
    v_customer := case when v_sw
      then 'Kwetu: ' || v_restaurant.name || ' imepokea oda yako ' || new.reference || ' (' || v_amount || '). Tutakutumia SMS ikiwa tayari.'
      else 'Kwetu: ' || v_restaurant.name || ' received your order ' || new.reference || ' (' || v_amount || '). We will text you when it is ready.' end;
    v_owner := 'Kwetu: Oda mpya ' || new.reference || ' · ' || v_kind || ' · ' || v_amount
      || '. Fungua Kwetu uipokee. New order: open Kwetu to accept it.';

  elsif new.status is distinct from old.status then
    if new.status::text = 'ready' and new.fulfillment::text = 'Pickup' then
      v_customer := case when v_sw
        then 'Kwetu: Oda yako ' || new.reference || ' kutoka ' || v_restaurant.name || ' iko tayari, njoo uichukue. Lipa ' || v_amount || ' taslimu.'
        else 'Kwetu: Your order ' || new.reference || ' from ' || v_restaurant.name || ' is ready for pickup. Please bring ' || v_amount || ' in cash.' end;
    elsif new.status::text = 'ready' then
      v_customer := case when v_sw
        then 'Kwetu: Oda yako ' || new.reference || ' kutoka ' || v_restaurant.name || ' iko njiani. Andaa ' || v_amount || ' taslimu kwa msafirishaji.'
        else 'Kwetu: Your order ' || new.reference || ' from ' || v_restaurant.name || ' is on its way. Please have ' || v_amount || ' in cash for the rider.' end;
    elsif new.status::text = 'declined' then
      v_customer := case when v_sw
        then 'Kwetu: Samahani, ' || v_restaurant.name || ' haikuweza kupokea oda yako ' || new.reference || '. Tafadhali jaribu mgahawa mwingine.'
        else 'Kwetu: Sorry, ' || v_restaurant.name || ' could not take your order ' || new.reference || '. Please try another restaurant.' end;
    elsif new.status::text = 'cancelled' then
      if new.cancelled_by = 'timeout' then
        v_customer := case when v_sw
          then 'Kwetu: Samahani, ' || v_restaurant.name || ' haikujibu oda yako ' || new.reference || ' kwa wakati, hivyo imeghairiwa. Hujalipa chochote.'
          else 'Kwetu: Sorry, ' || v_restaurant.name || ' did not answer your order ' || new.reference || ' in time, so it was cancelled. You have not paid anything.' end;
        v_owner := 'Kwetu: Oda ' || new.reference || ' imeghairiwa, haikujibiwa ndani ya dakika 30. Order ' || new.reference || ' expired: not answered in 30 minutes.';
      elsif new.cancelled_by = 'admin' then
        v_customer := case when v_sw
          then 'Kwetu: Oda yako ' || new.reference || ' imeghairiwa. Sababu: ' || coalesce(nullif(v_reason, ''), 'wasiliana na mgahawa.')
          else 'Kwetu: Your order ' || new.reference || ' was cancelled. Reason: ' || coalesce(nullif(v_reason, ''), 'please contact the restaurant.') end;
        v_owner := 'Kwetu: Oda ' || new.reference || ' imeghairiwa na Kwetu. Cancelled by Kwetu: ' || coalesce(nullif(v_reason, ''), '-');
      else
        v_owner := 'Kwetu: Mteja ameghairi oda ' || new.reference || '. The customer cancelled order ' || new.reference || '.';
      end if;
    end if;
  end if;

  if v_customer is not null and v_settings.order_sms_customers then
    perform private.send_sms(new.guest_phone, v_customer);
  end if;
  if v_owner is not null and v_settings.order_sms_restaurants then
    perform private.send_sms(v_restaurant_phone, v_owner);
  end if;
  return new;
end;
$$;
revoke execute on function public.sms_order_event() from public, anon, authenticated;

drop trigger if exists orders_sms on public.orders;
create trigger orders_sms after insert or update of status on public.orders
  for each row execute function public.sms_order_event();
