-- Admin restaurant page (2026-11-28): everything about one restaurant in one call, for the admin
-- console: the owner's account details, order counts and sales, and its latest orders.
-- (Its details, menu, photos and location come from the restaurants and menu_items tables, which
-- admins can already read.) Requires 202611280002_admin_tools.sql. Safe to run more than once.

create or replace function public.admin_restaurant_activity(p_restaurant_id bigint)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_today date := (now() at time zone 'Africa/Dar_es_Salaam')::date;
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Only Kwetu admins can see restaurant activity' using errcode = '42501';
  end if;
  if not exists (select 1 from public.restaurants r where r.id = p_restaurant_id) then
    raise exception 'Restaurant % not found', p_restaurant_id using errcode = '22023';
  end if;

  select jsonb_build_object(
    'owner', (
      select jsonb_build_object(
        'name', u.raw_user_meta_data ->> 'full_name',
        'email', nullif(u.email, ''),
        'phone', case when coalesce(u.phone, '') = '' then null else '+' || u.phone end,
        'registeredPhone', u.raw_user_meta_data ->> 'phone',
        'createdAt', u.created_at,
        'lastSignInAt', u.last_sign_in_at)
        from public.restaurants r join auth.users u on u.id = r.owner_id
       where r.id = p_restaurant_id),
    'stats', (
      select jsonb_build_object(
        'ordersTotal', count(*),
        'ordersToday', count(*) filter (where (o.created_at at time zone 'Africa/Dar_es_Salaam')::date = v_today),
        'inProgress', count(*) filter (where o.status::text in ('pending', 'accepted', 'preparing', 'ready', 'delivered')),
        'waitingLong', count(*) filter (where o.status::text = 'pending' and o.created_at < now() - interval '15 minutes'),
        'completed', count(*) filter (where o.status::text = 'completed'),
        'cancelled', count(*) filter (where o.status::text = 'cancelled'),
        'declined', count(*) filter (where o.status::text = 'declined'),
        'salesTotal', coalesce(sum(o.total) filter (where o.status::text = 'completed'), 0),
        'sales7Days', coalesce(sum(o.total) filter (where o.status::text = 'completed' and o.updated_at >= now() - interval '7 days'), 0),
        'lastOrderAt', max(o.created_at))
        from public.orders o
       where o.restaurant_id = p_restaurant_id),
    'orders', coalesce((
      select jsonb_agg(to_jsonb(latest) order by latest.created_at desc)
        from (
          select o.reference, o.restaurant_id, r.name as restaurant_name, o.guest_name as customer_name,
                 o.guest_phone as customer_phone, o.status::text as status, o.created_at,
                 o.fulfillment::text as fulfillment, o.total, o.payment_status::text as payment_status,
                 o.payment_method::text as payment_method
            from public.orders o join public.restaurants r on r.id = o.restaurant_id
           where o.restaurant_id = p_restaurant_id
           order by o.created_at desc
           limit 50
        ) latest), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
revoke execute on function public.admin_restaurant_activity(bigint) from public, anon;
grant execute on function public.admin_restaurant_activity(bigint) to authenticated;
