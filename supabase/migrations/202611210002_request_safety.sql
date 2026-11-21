-- Security fixes from the 2026-11-21 review. Requires 202611210001_menu_categories.sql.
--
-- 1. Orders and bookings could be sent already marked "completed" or "confirmed", with any prices,
--    total or date, by anyone with the app's public key. That allowed fake reviews (reviews need a
--    completed visit), fake "Popular foods", and wrong totals shown to restaurants. Now the database
--    sets the starting status, the time, and every price itself; the phone only says what was ordered.
-- 2. Owners could change their map and menu-PDF links to any address after approval. New values must
--    now be a Google Maps link and a file in Kwetu's own menu storage.
-- Safe to run more than once.

-- ---------------------------------------------------------------------------
-- 1a. New orders: status, payment and time are set here; prices and total come from the menu.
-- ---------------------------------------------------------------------------
create or replace function public.prepare_new_order()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_item jsonb;
  v_dish_id uuid;
  v_dish_name text;
  v_price integer;
  v_in_stock boolean;
  v_quantity integer;
  v_items jsonb := '[]'::jsonb;
  v_total bigint := 0;
  v_digits text := regexp_replace(coalesce(new.guest_phone, ''), '\D', '', 'g');
begin
  new.status := 'pending';
  new.payment_status := 'unpaid';
  new.payment_method := 'cash';
  new.payment_reference := null;
  new.paid_at := null;
  new.created_at := now();
  new.updated_at := now();

  if char_length(btrim(coalesce(new.guest_name, ''))) not between 1 and 100
     or char_length(coalesce(new.guest_email, '')) > 200
     or char_length(coalesce(new.delivery_address, '')) > 500
     or length(v_digits) not between 7 and 15 then
    raise exception 'Check your name, phone number, email and address.' using errcode = 'FB010';
  end if;
  if jsonb_typeof(new.items) is distinct from 'array' or jsonb_array_length(new.items) not between 1 and 50 then
    raise exception 'An order needs between 1 and 50 dishes.' using errcode = 'FB010';
  end if;

  for v_item in select value from jsonb_array_elements(new.items) loop
    -- The app sends the dish id; older versions sent only the name.
    v_dish_id := null;
    if jsonb_typeof(v_item) = 'object' and coalesce(v_item ->> 'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      select m.id, m.name, m.price, m.in_stock into v_dish_id, v_dish_name, v_price, v_in_stock
        from public.menu_items m
       where m.id = (v_item ->> 'id')::uuid and m.restaurant_id = new.restaurant_id;
    end if;
    if v_dish_id is null and jsonb_typeof(v_item) = 'object' then
      select m.id, m.name, m.price, m.in_stock into v_dish_id, v_dish_name, v_price, v_in_stock
        from public.menu_items m
       where m.restaurant_id = new.restaurant_id and m.name = v_item ->> 'name'
       order by m.created_at
       limit 1;
    end if;
    if v_dish_id is null then
      raise exception 'The menu has changed. Go back to the restaurant and order again.' using errcode = 'FB011';
    end if;
    if not v_in_stock then
      raise exception '% is sold out right now.', v_dish_name using errcode = 'FB011';
    end if;
    v_quantity := case when coalesce(v_item ->> 'quantity', '') ~ '^[0-9]{1,3}$' then (v_item ->> 'quantity')::integer else 0 end;
    if v_quantity not between 1 and 99 then
      raise exception 'Choose between 1 and 99 of %.', v_dish_name using errcode = 'FB010';
    end if;
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'id', v_dish_id, 'name', v_dish_name, 'price', 'TSh ' || to_char(v_price, 'FM999,999,999,990'), 'quantity', v_quantity));
    v_total := v_total + v_price::bigint * v_quantity;
  end loop;
  new.items := v_items;
  new.total := v_total;

  -- Spam guard: one phone number can have at most 5 orders waiting at one restaurant.
  if (select count(*) from public.orders o
       where o.restaurant_id = new.restaurant_id and o.status::text = 'pending'
         and regexp_replace(o.guest_phone, '\D', '', 'g') = v_digits) >= 5 then
    raise exception 'You already have orders waiting at this restaurant. Wait for them to be answered first.' using errcode = 'FB012';
  end if;
  return new;
end;
$$;
revoke execute on function public.prepare_new_order() from public, anon, authenticated;

create or replace trigger orders_prepare before insert on public.orders
  for each row execute function public.prepare_new_order();

-- ---------------------------------------------------------------------------
-- 1b. New bookings: always start as requests; dates and details are checked.
-- ---------------------------------------------------------------------------
create or replace function public.prepare_new_reservation()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_digits text := regexp_replace(coalesce(new.guest_phone, ''), '\D', '', 'g');
begin
  new.status := 'pending';
  new.created_at := now();
  new.updated_at := now();

  if char_length(btrim(coalesce(new.guest_name, ''))) not between 1 and 100
     or char_length(coalesce(new.guest_email, '')) > 200
     or length(v_digits) not between 7 and 15 then
    raise exception 'Check your name, phone number and email.' using errcode = 'FB010';
  end if;
  if new.reservation_date > current_date + 60 then
    raise exception 'Tables can be booked up to 60 days ahead.' using errcode = 'FB010';
  end if;

  -- Spam guard: one phone number can have at most 3 bookings waiting at one restaurant.
  if (select count(*) from public.reservations r
       where r.restaurant_id = new.restaurant_id and r.status::text = 'pending'
         and regexp_replace(r.guest_phone, '\D', '', 'g') = v_digits) >= 3 then
    raise exception 'You already have bookings waiting at this restaurant. Wait for them to be answered first.' using errcode = 'FB012';
  end if;
  return new;
end;
$$;
revoke execute on function public.prepare_new_reservation() from public, anon, authenticated;

create or replace trigger reservations_prepare before insert on public.reservations
  for each row execute function public.prepare_new_reservation();

-- ---------------------------------------------------------------------------
-- 2. Owner-set links. "not valid" leaves existing rows alone; new and changed values are checked.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'restaurants_map_url_google_maps' and conrelid = 'public.restaurants'::regclass) then
    alter table public.restaurants add constraint restaurants_map_url_google_maps check (
      map_url = ''
      or map_url ~* '^https://(maps\.app\.goo\.gl|goo\.gl/maps|maps\.google\.(com|co\.[a-z]{2}|com\.[a-z]{2}|[a-z]{2})|(www\.)?google\.(com|co\.[a-z]{2}|com\.[a-z]{2}|[a-z]{2})/maps)(/|\?|$)'
    ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'restaurants_menu_pdf_in_storage' and conrelid = 'public.restaurants'::regclass) then
    alter table public.restaurants add constraint restaurants_menu_pdf_in_storage check (
      menu_pdf_url is null
      or menu_pdf_url ~ ('^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/restaurant-menus/' || id::text || '/[^/?#]+$')
    ) not valid;
  end if;
end $$;
