-- Kwetu is cash only (2026-11-21). Customers pay the restaurant in cash: at the counter for pickup,
-- or to the rider when a delivery arrives. The restaurant then confirms it in the app, which marks the
-- order paid and completes it. The simulated in-app mobile money payment is switched off.
-- Safe to run more than once.

-- 1. Nobody can call the old simulated mobile money payment any more.
revoke execute on function public.pay_order(text, text, text) from public, anon, authenticated;

-- 2. Notifications talk about cash, and say thank you when the restaurant completes the order.
--    (Replaces the version from 202611180005_launch_readiness.sql; the orders_notify trigger stays.)
create or replace function public.notify_order_event()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_restaurant public.restaurants%rowtype;
  v_owner_tokens text[];
  v_customer_tokens text[];
  v_amount text := 'TSh ' || to_char(new.total, 'FM999,999,999,990');
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

  if new.status is distinct from old.status then
    if new.status::text = 'cancelled' then
      perform public.send_push(v_owner_tokens, 'Order cancelled · ' || new.reference,
        new.guest_name || ' cancelled their order.', jsonb_build_object('url', '/owner', 'reference', new.reference));
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
