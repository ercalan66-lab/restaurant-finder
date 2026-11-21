-- Two-step sign-in (2026-11-21): after the password, a 6-digit code from an authenticator app
-- (Supabase MFA, TOTP; free and on by default in every project). Admins must use it; customers and
-- restaurant owners can turn it on in Settings → Profile.
--
-- A session that passed the code step has the JWT claim aal = 'aal2'. Below, the database:
--   1. gives admin powers only to aal2 sessions;
--   2. once an account has a verified authenticator, refuses its private data and changes to sessions
--      that typed only the password (aal1), so a stolen password alone is not enough.
-- Safe to run more than once.

-- ---------------------------------------------------------------------------
-- 1. True when this session may act for its account: it passed the code step, or the account has no
--    authenticator. Visitors who are not signed in pass (they have no account to protect).
-- ---------------------------------------------------------------------------
create or replace function public.two_step_ok()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified');
$$;
grant execute on function public.two_step_ok() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Admins: powers only after the code step. is_admin() is used by every admin_* function and by the
--    policies that let admins see hidden restaurants and reviews.
--    is_admin_account() only says whether the signed-in account is listed, so the admin console can
--    ask for the code (or for setting one up) before granting access.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
     and exists (select 1 from public.admins where user_id = auth.uid());
$$;

create or replace function public.is_admin_account()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke execute on function public.is_admin_account() from public, anon;
grant execute on function public.is_admin_account() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Restrictive policies: they are added to (ANDed with) the existing ones. Public reads such as
--    restaurants and menus stay open; private reads and every change need two_step_ok().
-- ---------------------------------------------------------------------------
do $$
declare
  v record;
begin
  for v in select * from (values
    ('public', 'restaurants', 'insert'), ('public', 'restaurants', 'update'), ('public', 'restaurants', 'delete'),
    ('public', 'menu_items', 'insert'), ('public', 'menu_items', 'update'), ('public', 'menu_items', 'delete'),
    ('public', 'orders', 'select'), ('public', 'orders', 'update'),
    ('public', 'reservations', 'select'), ('public', 'reservations', 'update'),
    ('public', 'push_tokens', 'select'),
    ('storage', 'objects', 'insert'), ('storage', 'objects', 'update'), ('storage', 'objects', 'delete')
  ) as t(schema_name, table_name, command)
  loop
    if not exists (select 1 from pg_policies where schemaname = v.schema_name and tablename = v.table_name and policyname = 'two-step sign-in ' || v.command) then
      execute format('create policy %I on %I.%I as restrictive for %s to authenticated %s',
        'two-step sign-in ' || v.command, v.schema_name, v.table_name, v.command,
        case v.command
          when 'insert' then 'with check ((select public.two_step_ok()))'
          when 'update' then 'using ((select public.two_step_ok())) with check ((select public.two_step_ok()))'
          else 'using ((select public.two_step_ok()))'
        end);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Functions that act for the signed-in account (they bypass the policies above, so they check too).
--    Same as before apart from the two_step_ok() check at the top.
-- ---------------------------------------------------------------------------
create or replace function public.register_push_token(p_token text, p_platform text default '')
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in before registering a device for notifications';
  end if;
  if not public.two_step_ok() then
    raise exception 'Enter the code from your authenticator app first.' using errcode = '42501';
  end if;
  insert into public.push_tokens (token, user_id, platform, updated_at)
  values (p_token, auth.uid(), coalesce(p_platform, ''), now())
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end;
$$;

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Sign in before deleting your account' using errcode = '42501';
  end if;
  if not public.two_step_ok() then
    raise exception 'Enter the code from your authenticator app first.' using errcode = '42501';
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
