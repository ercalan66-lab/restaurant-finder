-- Restaurant map positions, so the app can show customers how far each restaurant is from them.
-- The distance is worked out on the customer's phone; their own location is never sent to Kwetu.
-- Requires 202611200004_menu_pdf.sql.

alter table public.restaurants
  add column latitude double precision check (latitude between -90 and 90),
  add column longitude double precision check (longitude between -180 and 180),
  add constraint restaurants_position_complete check ((latitude is null) = (longitude is null));

-- Owners set the position from their dashboard ("Use my current location"); see 202611180002 for
-- why owner-editable columns are granted one by one.
grant insert (latitude, longitude), update (latitude, longitude) on public.restaurants to authenticated;

-- Approximate positions for the demo restaurants: the centre of each neighbourhood in Dar es Salaam,
-- close enough for "1.2 km away" but not for directions. Owners of real restaurants set their own.
update public.restaurants r
   set latitude = v.lat, longitude = v.lng
  from (values
    (1, -6.7445, 39.2805),  -- Masaki
    (2, -6.7625, 39.2870),  -- Oyster Bay
    (3, -6.8125, 39.2895),  -- City Centre
    (4, -6.7590, 39.2535),  -- Mikocheni
    (5, -6.8040, 39.2830),  -- Upanga
    (6, -6.7520, 39.2700),  -- Msasani
    (7, -6.8195, 39.2740),  -- Kariakoo
    (8, -6.8180, 39.2985)   -- Kivukoni
  ) as v(id, lat, lng)
 where r.id = v.id and r.latitude is null;
