-- How often each dish was ordered recently, for "Popular foods" on the home screen.
-- Returns only counts per restaurant and dish name, never who ordered or when.
-- Requires 202611200005_restaurant_location.sql.

create or replace function public.popular_dishes(p_days integer default 30)
returns table (restaurant_id bigint, dish_name text, times_ordered integer)
language sql stable security definer set search_path = '' as $$
  select o.restaurant_id,
         item ->> 'name',
         sum(case when (item ->> 'quantity') ~ '^[0-9]+$' then greatest((item ->> 'quantity')::integer, 1) else 1 end)::integer
    from public.orders o
    cross join lateral jsonb_array_elements(o.items) as item
   where o.created_at >= now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 365))
     and o.status::text not in ('declined', 'cancelled')
     and jsonb_typeof(item) = 'object'
     and coalesce(item ->> 'name', '') <> ''
   group by o.restaurant_id, item ->> 'name'
   order by 3 desc, 2
   limit 100;
$$;

revoke execute on function public.popular_dishes(integer) from public;
grant execute on function public.popular_dishes(integer) to anon, authenticated;
