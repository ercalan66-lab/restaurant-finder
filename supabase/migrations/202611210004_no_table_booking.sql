-- Table booking was removed from Kwetu (2026-11-21). New bookings are refused, so an older version of
-- the app cannot create a booking that no restaurant would see any more. Past bookings stay in the table
-- as a record. To bring booking back, grant insert again and restore the app screens from git history.
revoke insert on public.reservations from anon, authenticated;
