-- Customer reviews: after a completed order or booking, the customer rates the restaurant (1–5 stars and
-- an optional comment). The average of visible reviews becomes the restaurant's rating, and admins can
-- hide abusive reviews. Requires 202611200002_rename_to_kwetu.sql.

-- ---------------------------------------------------------------------------
-- 1. Reviews. One per completed order or booking; written only through submit_review().
-- ---------------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  restaurant_id bigint not null references public.restaurants(id) on delete cascade,
  request_reference text not null unique,
  author_id uuid references auth.users(id) on delete set null,
  -- First name only, copied from the order or booking.
  author_name text not null,
  rating smallint not null check (rating between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 500),
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index reviews_restaurant_id_created_at_idx on public.reviews(restaurant_id, created_at desc);

alter table public.reviews enable row level security;
create policy "visible reviews are public" on public.reviews for select using (not is_hidden or (select public.is_admin()));

-- New Supabase projects grant nothing by default (see 202611200001). Everyone may read reviews, but not
-- which order they came from or which account wrote them.
grant select (id, restaurant_id, author_name, rating, comment, is_hidden, created_at) on public.reviews to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Each restaurant keeps the average of its visible reviews.
-- ---------------------------------------------------------------------------
alter table public.restaurants add column review_count integer not null default 0;

create or replace function public.refresh_restaurant_rating(p_restaurant_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
  v_average numeric;
begin
  select count(*), avg(v.rating) into v_count, v_average
    from public.reviews v where v.restaurant_id = p_restaurant_id and not v.is_hidden;
  -- With no visible reviews, the rating set by an admin (or the demo data) stays.
  update public.restaurants
     set review_count = v_count,
         rating = case when v_count > 0 then round(v_average, 1) else rating end
   where id = p_restaurant_id;
end;
$$;
revoke execute on function public.refresh_restaurant_rating(bigint) from public, anon, authenticated;

create or replace function public.reviews_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.refresh_restaurant_rating(coalesce(new.restaurant_id, old.restaurant_id));
  return null;
end;
$$;
create trigger reviews_refresh_rating after insert or update or delete on public.reviews
  for each row execute function public.reviews_changed();

-- ---------------------------------------------------------------------------
-- 3. Writing a review. The customer proves the order or booking is theirs the same way as cancelling:
--    their account, or the phone number it was placed with. It must be completed.
-- ---------------------------------------------------------------------------
create or replace function public.submit_review(p_reference text, p_phone text, p_rating integer, p_comment text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_comment text := btrim(coalesce(p_comment, ''));
  v_restaurant_id bigint;
  v_name text;
  v_owner uuid;
begin
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'Choose between 1 and 5 stars' using errcode = '22023';
  end if;
  if char_length(v_comment) > 500 then
    raise exception 'Keep the comment under 500 characters' using errcode = '22023';
  end if;

  select o.restaurant_id, o.guest_name into v_restaurant_id, v_name
    from public.orders o
   where o.reference = p_reference and o.status::text = 'completed'
     and (o.customer_id = auth.uid() or (length(v_digits) >= 7 and regexp_replace(o.guest_phone, '\D', '', 'g') = v_digits));
  if v_restaurant_id is null then
    select r.restaurant_id, r.guest_name into v_restaurant_id, v_name
      from public.reservations r
     where r.reference = p_reference and r.status::text = 'completed'
       and (r.customer_id = auth.uid() or (length(v_digits) >= 7 and regexp_replace(r.guest_phone, '\D', '', 'g') = v_digits));
  end if;
  if v_restaurant_id is null then
    raise exception 'Only completed orders and bookings can be reviewed.' using errcode = 'FB007';
  end if;

  select owner_id into v_owner from public.restaurants where id = v_restaurant_id;
  if v_owner is not null and v_owner = auth.uid() then
    raise exception 'Restaurant owners cannot review their own restaurant.' using errcode = 'FB008';
  end if;

  insert into public.reviews (restaurant_id, request_reference, author_id, author_name, rating, comment)
  values (v_restaurant_id, p_reference, auth.uid(), coalesce(nullif(split_part(btrim(v_name), ' ', 1), ''), 'Guest'), p_rating, v_comment)
  on conflict (request_reference) do nothing;
  if not found then
    raise exception 'You already reviewed this visit.' using errcode = 'FB009';
  end if;
end;
$$;
revoke execute on function public.submit_review(text, text, integer, text) from public;
grant execute on function public.submit_review(text, text, integer, text) to anon, authenticated;

-- Which of these orders and bookings already have a review, so the app stops offering "Rate your visit".
-- Returns references only, never review content or personal details.
create or replace function public.reviewed_references(p_references text[])
returns setof text language sql stable security definer set search_path = '' as $$
  select v.request_reference from public.reviews v where v.request_reference = any (p_references[1:200]);
$$;
revoke execute on function public.reviewed_references(text[]) from public;
grant execute on function public.reviewed_references(text[]) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Admins hide or show reviews. Hidden reviews leave the public page and the average.
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_review_hidden(p_review_id uuid, p_hidden boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Only Kwetu admins can hide reviews' using errcode = '42501';
  end if;
  update public.reviews set is_hidden = coalesce(p_hidden, true) where id = p_review_id;
  if not found then
    raise exception 'Review not found' using errcode = '22023';
  end if;
end;
$$;
revoke execute on function public.admin_set_review_hidden(uuid, boolean) from public, anon;
grant execute on function public.admin_set_review_hidden(uuid, boolean) to authenticated;

-- Once a restaurant has reviews, its rating is their average; admins can still change the tag.
-- (Replaces the version in 202611200002_rename_to_kwetu.sql.)
create or replace function public.admin_update_listing(p_restaurant_id bigint, p_rating numeric, p_tag text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Only Kwetu admins can edit ratings and tags' using errcode = '42501';
  end if;
  if p_rating is null or p_rating < 0 or p_rating > 5 then
    raise exception 'Rating must be between 0 and 5' using errcode = '22023';
  end if;
  update public.restaurants
     set rating = case when review_count > 0 then rating else round(p_rating, 1) end,
         tag = left(btrim(coalesce(p_tag, '')), 24)
   where id = p_restaurant_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Account deletion also removes the person's name from their reviews (replaces the version in
--    202611180005_launch_readiness.sql; the only change is the reviews update).
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
  -- Reviews stay (they still count towards the rating) but no longer show the person's name.
  update public.reviews set author_name = 'Former customer', author_id = null where author_id = v_user;
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
