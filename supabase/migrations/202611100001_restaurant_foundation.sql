create extension if not exists pgcrypto;

create type public.order_status as enum ('pending', 'accepted', 'preparing', 'ready', 'completed', 'declined');
create type public.reservation_status as enum ('pending', 'confirmed', 'declined', 'completed');
create type public.fulfillment_type as enum ('Pickup', 'Delivery');

create table public.restaurants (
  id bigint primary key,
  owner_id uuid references auth.users(id) on delete set null,
  name text not null,
  cuisine text not null,
  area text not null,
  address text not null,
  description text not null default '',
  phone text not null default '',
  email text not null default '',
  opens_at time not null default '08:00',
  closes_at time not null default '22:00',
  map_url text not null default '',
  facilities text[] not null default '{}',
  cover_url text,
  gallery_urls text[] not null default '{}',
  rating numeric(2,1) not null default 0 check (rating between 0 and 5),
  distance_km numeric(7,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id bigint not null references public.restaurants(id) on delete cascade,
  name text not null,
  ingredients text not null default '',
  price integer not null check (price > 0),
  photo_url text,
  available_from time not null default '08:00',
  available_until time not null default '22:00',
  in_stock boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  restaurant_id bigint not null references public.restaurants(id),
  customer_id uuid references auth.users(id) on delete set null default auth.uid(),
  guest_name text not null,
  guest_phone text not null,
  guest_email text not null default '',
  fulfillment public.fulfillment_type not null,
  delivery_address text not null default '',
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  total integer not null check (total >= 0),
  status public.order_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  restaurant_id bigint not null references public.restaurants(id),
  customer_id uuid references auth.users(id) on delete set null default auth.uid(),
  guest_name text not null,
  guest_phone text not null,
  guest_email text not null default '',
  reservation_date date not null,
  reservation_time time not null,
  guest_count integer not null check (guest_count between 1 and 30),
  status public.reservation_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index restaurants_owner_id_idx on public.restaurants(owner_id);
create index menu_items_restaurant_id_idx on public.menu_items(restaurant_id);
create index orders_restaurant_id_created_at_idx on public.orders(restaurant_id, created_at desc);
create index orders_customer_id_created_at_idx on public.orders(customer_id, created_at desc);
create index reservations_restaurant_id_created_at_idx on public.reservations(restaurant_id, created_at desc);
create index reservations_customer_id_created_at_idx on public.reservations(customer_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger restaurants_updated_at before update on public.restaurants for each row execute function public.set_updated_at();
create trigger menu_items_updated_at before update on public.menu_items for each row execute function public.set_updated_at();
create trigger orders_updated_at before update on public.orders for each row execute function public.set_updated_at();
create trigger reservations_updated_at before update on public.reservations for each row execute function public.set_updated_at();

alter table public.restaurants enable row level security;
alter table public.menu_items enable row level security;
alter table public.orders enable row level security;
alter table public.reservations enable row level security;

create policy "active restaurants are public" on public.restaurants for select using (is_active or owner_id = auth.uid());
create policy "owners create restaurants" on public.restaurants for insert to authenticated with check (owner_id = auth.uid());
create policy "owners update restaurants" on public.restaurants for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owners delete restaurants" on public.restaurants for delete to authenticated using (owner_id = auth.uid());

create policy "menu is public" on public.menu_items for select using (
  exists (select 1 from public.restaurants r where r.id = restaurant_id and (r.is_active or r.owner_id = auth.uid()))
);
create policy "owners create menu items" on public.menu_items for insert to authenticated with check (
  exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid())
);
create policy "owners update menu items" on public.menu_items for update to authenticated using (
  exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid())
) with check (
  exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid())
);
create policy "owners delete menu items" on public.menu_items for delete to authenticated using (
  exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid())
);

create policy "anyone submits orders" on public.orders for insert to anon, authenticated with check (customer_id is null or customer_id = auth.uid());
create policy "customers and owners view orders" on public.orders for select to authenticated using (
  customer_id = auth.uid() or exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid())
);
create policy "owners update orders" on public.orders for update to authenticated using (
  exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid())
);

create policy "anyone submits reservations" on public.reservations for insert to anon, authenticated with check (customer_id is null or customer_id = auth.uid());
create policy "customers and owners view reservations" on public.reservations for select to authenticated using (
  customer_id = auth.uid() or exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid())
);
create policy "owners update reservations" on public.reservations for update to authenticated using (
  exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid())
);

insert into public.restaurants (id, name, cuisine, area, address, description, phone, email, opens_at, closes_at, facilities, rating, distance_km)
values
  (1, 'The Baobab Table', 'African', 'Masaki', 'Haile Selassie Road, Masaki', 'A vibrant celebration of East African cooking.', '+255 712 555 101', 'hello@baobabtable.co.tz', '11:00', '23:00', array['Wi-Fi', 'Parking'], 4.9, 0.8),
  (2, 'Olive & Ember', 'Italian', 'Oyster Bay', 'Toure Drive, Oyster Bay', 'Seasonal antipasti, sourdough pizza, and handmade pasta.', '+255 712 555 102', 'tables@oliveandember.co.tz', '12:00', '23:00', array['Garden seating', 'Parking'], 4.8, 1.4),
  (3, 'Koi House', 'Asian', 'City Centre', 'Ohio Street, City Centre', 'Sushi, donburi bowls, and inventive small plates.', '+255 712 555 103', 'reserve@koihouse.co.tz', '12:00', '22:30', array['Wi-Fi'], 4.7, 2.1),
  (4, 'Morning Ritual', 'Cafe', 'Mikocheni', 'Mwai Kibaki Road, Mikocheni', 'Coffee, pastries, and all-day brunch.', '+255 712 555 104', 'coffee@morningritual.co.tz', '06:30', '18:00', array['Wi-Fi', 'Outdoor seating'], 4.6, 0.5),
  (5, 'Spice Route', 'Indian', 'Upanga', 'United Nations Road, Upanga', 'Regional Indian flavors and fresh local ingredients.', '+255 712 555 105', 'karibu@spiceroute.co.tz', '11:30', '23:00', array['Parking'], 4.8, 3.2),
  (6, 'Luna Trattoria', 'Italian', 'Msasani', 'Kimweri Avenue, Msasani', 'Handmade pasta and neighborhood Italian classics.', '+255 712 555 106', 'ciao@lunatrattoria.co.tz', '17:00', '23:00', array['Outdoor seating'], 4.5, 1.8),
  (7, 'Kariakoo Flame', 'African', 'Kariakoo', 'Msimbazi Street, Kariakoo', 'Grilled meats, biryani, and Tanzanian plates.', '+255 712 555 107', 'orders@kariakooflame.co.tz', '10:00', '22:00', array['Family seating'], 4.6, 3.4),
  (8, 'Harbour House', 'African', 'Kivukoni', 'Kivukoni Front, Dar es Salaam', 'Fresh seafood and coastal cooking.', '+255 712 555 108', 'reservations@harbourhouse.co.tz', '12:00', '23:30', array['Harbour view', 'Parking'], 4.7, 2.8)
on conflict (id) do nothing;
