-- Owner onboarding, database-backed restaurant editing, and restaurant photos.

-- 1. New restaurants get an id automatically. Demo restaurants use 1-8.
create sequence if not exists public.restaurants_id_seq start with 1000;
alter sequence public.restaurants_id_seq owned by public.restaurants.id;
alter table public.restaurants alter column id set default nextval('public.restaurants_id_seq'::regclass);
grant usage, select on sequence public.restaurants_id_seq to authenticated;

-- 2. Fields the customer list needs.
alter table public.restaurants
  add column price_per_person integer not null default 0 check (price_per_person >= 0),
  add column tag text not null default '';

-- 3. One restaurant per owner account for now.
create unique index restaurants_one_per_owner_idx on public.restaurants(owner_id) where owner_id is not null;

-- 4. Owners may edit their listing, but not its id, rating, distance, or promotional tag.
revoke insert, update on public.restaurants from anon, authenticated;
grant insert (owner_id, name, cuisine, area, address, description, phone, email, opens_at, closes_at, map_url, facilities, cover_url, gallery_urls, price_per_person, is_active)
  on public.restaurants to authenticated;
grant update (name, cuisine, area, address, description, phone, email, opens_at, closes_at, map_url, facilities, cover_url, gallery_urls, price_per_person, is_active)
  on public.restaurants to authenticated;

-- 5. Bring the demo restaurants up to date with the app's bundled data.
update public.restaurants r set
  price_per_person = v.price,
  tag = v.tag,
  description = v.description,
  cover_url = coalesce(r.cover_url, v.cover),
  gallery_urls = case
    when cardinality(r.gallery_urls) > 0 then r.gallery_urls
    when v.gallery_order = 1 then array[
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=85',
      'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1200&q=85',
      'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=85']
    else array[
      'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=85',
      'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1200&q=85',
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=85']
  end
from (values
  (1, 45000, 'Bestseller', 'A vibrant celebration of East African cooking with fragrant rice, charcoal-grilled seafood, and generous sharing plates.', 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=85', 1),
  (2, 85000, 'Hot spot', 'Seasonal antipasti, blistered sourdough pizza, and handmade pasta in a relaxed garden setting.', 'https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=900&q=85', 2),
  (3, 240000, 'New', 'Precision-cut sushi, warm donburi bowls, and inventive small plates in an intimate dining room.', 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=900&q=85', 1),
  (4, 35000, 'Open early', 'Excellent coffee, flaky pastries, and all-day brunch classics with plenty of plant-forward choices.', 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=900&q=85', 2),
  (5, 65000, 'Popular', 'Bold regional Indian flavors meet fresh local ingredients, from slow curries to smoky tandoor plates.', 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=900&q=85', 1),
  (6, 130000, 'Great value', 'A warm neighborhood trattoria known for silky handmade pasta, simple sauces, and classic tiramisu.', 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=900&q=85', 2),
  (7, 28000, 'Local favorite', 'Busy local dining with grilled meats, biryani, and classic Tanzanian plates.', 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=85', 1),
  (8, 145000, 'Ocean view', 'Fresh seafood and coastal cooking overlooking the harbour.', 'https://images.unsplash.com/photo-1544148103-0773bf10d330?auto=format&fit=crop&w=900&q=85', 2)
) as v(id, price, tag, description, cover, gallery_order)
where r.id = v.id;

-- 6. Demo menus, served during each restaurant's opening hours. Skipped for any
--    restaurant that already has menu items.
insert into public.menu_items (restaurant_id, name, ingredients, price, photo_url, available_from, available_until)
select m.restaurant_id, m.name, m.ingredients, m.price, m.photo_url, r.opens_at, r.closes_at
from (values
  (1, 'Baobab seafood platter', 'Chef signature, prepared fresh to order.', 28000, 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=85'),
  (1, 'Coconut fish curry', 'A guest favorite made with local ingredients.', 34000, 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=85'),
  (1, 'Nyama choma board', 'Perfect for sharing at the table.', 52000, 'https://images.unsplash.com/photo-1544148103-0773bf10d330?auto=format&fit=crop&w=900&q=85'),
  (2, 'Truffle tagliatelle', 'Chef signature, prepared fresh to order.', 28000, 'https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=900&q=85'),
  (2, 'Ember margherita', 'A guest favorite made with local ingredients.', 34000, 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=900&q=85'),
  (2, 'Garden antipasti', 'Perfect for sharing at the table.', 52000, 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=900&q=85'),
  (3, 'Koi sushi selection', 'Chef signature, prepared fresh to order.', 28000, 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=900&q=85'),
  (3, 'Miso salmon bowl', 'A guest favorite made with local ingredients.', 34000, 'https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?auto=format&fit=crop&w=900&q=85'),
  (3, 'Crispy sharing plate', 'Perfect for sharing at the table.', 52000, 'https://images.unsplash.com/photo-1563379926898-05f4575a45d8?auto=format&fit=crop&w=900&q=85'),
  (4, 'Ritual brunch plate', 'Chef signature, prepared fresh to order.', 28000, 'https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=900&q=85'),
  (4, 'Avocado sourdough', 'A guest favorite made with local ingredients.', 34000, 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=900&q=85'),
  (4, 'Pastry selection', 'Perfect for sharing at the table.', 52000, 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=900&q=85'),
  (5, 'Tandoori mixed grill', 'Chef signature, prepared fresh to order.', 28000, 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=900&q=85'),
  (5, 'Coconut prawn curry', 'A guest favorite made with local ingredients.', 34000, 'https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?auto=format&fit=crop&w=900&q=85'),
  (5, 'Family biryani', 'Perfect for sharing at the table.', 52000, 'https://images.unsplash.com/photo-1563379926898-05f4575a45d8?auto=format&fit=crop&w=900&q=85'),
  (6, 'Luna carbonara', 'Chef signature, prepared fresh to order.', 28000, 'https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=900&q=85'),
  (6, 'Burrata pizza', 'A guest favorite made with local ingredients.', 34000, 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=900&q=85'),
  (6, 'Classic tiramisu', 'Perfect for sharing at the table.', 52000, 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=900&q=85'),
  (7, 'Flame nyama choma', 'Chef signature, prepared fresh to order.', 28000, 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=85'),
  (7, 'Kariakoo biryani', 'A guest favorite made with local ingredients.', 34000, 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=85'),
  (7, 'Mishkaki platter', 'Perfect for sharing at the table.', 52000, 'https://images.unsplash.com/photo-1544148103-0773bf10d330?auto=format&fit=crop&w=900&q=85'),
  (8, 'Harbour seafood grill', 'Chef signature, prepared fresh to order.', 28000, 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=85'),
  (8, 'Zanzibar octopus', 'A guest favorite made with local ingredients.', 34000, 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=85'),
  (8, 'Coastal sharing board', 'Perfect for sharing at the table.', 52000, 'https://images.unsplash.com/photo-1544148103-0773bf10d330?auto=format&fit=crop&w=900&q=85')
) as m(restaurant_id, name, ingredients, price, photo_url)
join public.restaurants r on r.id = m.restaurant_id
where not exists (select 1 from public.menu_items existing where existing.restaurant_id = m.restaurant_id);

-- 7. Public photo bucket. Files live under "<restaurant id>/..." and only that
--    restaurant's owner can add or remove them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('restaurant-photos', 'restaurant-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "owners add restaurant photos" on storage.objects for insert to authenticated with check (
  bucket_id = 'restaurant-photos'
  and exists (select 1 from public.restaurants r where r.owner_id = (select auth.uid()) and r.id::text = (storage.foldername(name))[1])
);
create policy "owners read own restaurant photo objects" on storage.objects for select to authenticated using (
  bucket_id = 'restaurant-photos'
  and exists (select 1 from public.restaurants r where r.owner_id = (select auth.uid()) and r.id::text = (storage.foldername(name))[1])
);
create policy "owners remove restaurant photos" on storage.objects for delete to authenticated using (
  bucket_id = 'restaurant-photos'
  and exists (select 1 from public.restaurants r where r.owner_id = (select auth.uid()) and r.id::text = (storage.foldername(name))[1])
);
