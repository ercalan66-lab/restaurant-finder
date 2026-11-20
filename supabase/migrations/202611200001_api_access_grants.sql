-- Explicit API access for the app's two database roles: anon (guests) and authenticated (signed-in
-- users). Requires 202611180006_admin_console.sql to have been run first.
--
-- Older Supabase projects gave these roles full access to every new table in the public schema
-- automatically, and the earlier migrations relied on that: they only narrowed access
-- (202611180002 and 202611180003 revoke table-wide rights and grant single columns instead).
-- Newer projects grant nothing by default, so without this file the app cannot even list
-- restaurants ("permission denied for table restaurants"). Row-level security still decides which
-- rows each person sees; these grants only allow the operations the app performs.
-- Safe to run more than once, and harmless on older projects.

-- Restaurants: everyone browses them. Owners' insert and update rights are per column
-- (202611180002 and 202611180005), so they are not widened here.
grant select on public.restaurants to anon, authenticated;

-- Menus: everyone reads them; owners manage their own dishes (policies in 202611100001).
grant select on public.menu_items to anon, authenticated;
grant insert, update, delete on public.menu_items to authenticated;

-- Orders and bookings: guests and signed-in customers place them. Reading and status changes stay
-- limited to the columns granted in 202611180003 and 202611180005.
grant insert on public.orders, public.reservations to anon, authenticated;

-- push_tokens and admins get no direct access: the app reaches them only through security definer
-- functions (register_push_token, is_admin, the admin_* functions).

-- Functions guests call directly, plus is_admin(), which row-level policies call for every visitor.
-- New functions used to be executable by everyone by default; say so explicitly in case that changes too.
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.slot_availability(bigint, date) to anon, authenticated;
grant execute on function public.request_statuses(text[]) to anon, authenticated;
grant execute on function public.cancel_request(text, text) to anon, authenticated;
grant execute on function public.pay_order(text, text, text) to anon, authenticated;
