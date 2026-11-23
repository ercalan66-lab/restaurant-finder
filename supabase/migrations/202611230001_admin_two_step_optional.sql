-- Two-step sign-in is optional for admins too (2026-11-23), like for customers and restaurant owners.
-- Before, is_admin() needed a session that passed the code step (aal2), so every admin had to set up an
-- authenticator app. Now it uses two_step_ok() (202611210005_two_step_sign_in.sql): an admin without an
-- authenticator gets admin powers with the password alone, and an admin who turned it on still needs the
-- code. Safe to run more than once.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.two_step_ok()
     and exists (select 1 from public.admins where user_id = auth.uid());
$$;
