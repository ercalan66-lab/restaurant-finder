-- Payment tracking for food orders. Cash is the only method for now; add online
-- methods later with `alter type public.payment_method add value '...'`.
create type public.payment_method as enum ('cash');
create type public.payment_status as enum ('unpaid', 'paid');

alter table public.orders
  add column payment_method public.payment_method not null default 'cash',
  add column payment_status public.payment_status not null default 'unpaid',
  add column paid_at timestamptz;

-- Customers must not be able to submit an order that is already marked paid.
drop policy "anyone submits orders" on public.orders;
create policy "anyone submits orders" on public.orders for insert to anon, authenticated with check (
  (customer_id is null or customer_id = auth.uid())
  and payment_status = 'unpaid'
  and paid_at is null
);

-- paid_at is maintained by the database whenever the owner changes payment_status.
create or replace function public.set_order_paid_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.payment_status = 'paid' and old.payment_status <> 'paid' then
    new.paid_at = now();
  elsif new.payment_status <> 'paid' then
    new.paid_at = null;
  end if;
  return new;
end;
$$;

create trigger orders_paid_at before update of payment_status on public.orders
  for each row execute function public.set_order_paid_at();
