-- Restaurants can add photos of their printed menu (2026-11-26): the quickest way for an owner to share
-- a menu is to photograph each page. Customers open them full screen on the restaurant page.
-- The photos live in the existing restaurant-photos bucket under "<restaurant id>/menu-pages/", which
-- the bucket's policies already allow for that restaurant's owner. Safe to run more than once.

alter table public.restaurants add column if not exists menu_photo_urls text[] not null default '{}';

-- Owners edit their listing column by column (see 202611180002), so they need this column too.
grant update (menu_photo_urls) on public.restaurants to authenticated;

-- At most 8 menu pages, the same limit the app shows.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'restaurants_menu_photo_limit') then
    alter table public.restaurants
      add constraint restaurants_menu_photo_limit check (cardinality(menu_photo_urls) <= 8) not valid;
  end if;
end $$;
