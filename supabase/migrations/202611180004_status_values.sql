-- New status and payment values. Kept in their own migration because Postgres cannot use a newly
-- added enum value in the same transaction that adds it. Run this before 202611180005.

alter type public.order_status add value if not exists 'delivered' after 'ready';
alter type public.order_status add value if not exists 'cancelled';
alter type public.reservation_status add value if not exists 'cancelled';
alter type public.payment_method add value if not exists 'mpesa';
alter type public.payment_method add value if not exists 'tigo_pesa';
alter type public.payment_method add value if not exists 'airtel_money';
