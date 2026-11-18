# Fork restaurant finder

An Expo SDK 58 restaurant discovery, reservation, and food-ordering app backed by Supabase.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and add the Supabase project URL and publishable key.
3. In the Supabase SQL editor, run each file in `supabase/migrations/` in filename order (`202611100001_restaurant_foundation.sql`, then `202611180001_order_payments.sql`). Run new migrations before shipping an app build that depends on them; otherwise order sync fails.
4. Start the app with `npx expo start`.

## Phone sign-in

Customers and owners can sign in with an SMS code as well as email and password. To turn it on:

1. In the Supabase dashboard, open **Authentication → Sign In / Providers → Phone** and enable it.
2. Connect an SMS provider (Twilio, MessageBird, Vonage, or Textlocal) and paste its credentials there. Each code sent is billed by that provider.
3. For development without SMS costs, add test numbers and fixed codes under the same settings.

Until a provider is configured, the app shows "Phone sign-in is not enabled" when someone requests a code. Numbers typed in local Tanzanian format (`0712 345 678`) are converted to `+255…` automatically.

## Payments

Checkout currently offers **cash on pickup / cash on delivery** only. Every order records `payment_method` and `payment_status` (`unpaid` → `paid`). The restaurant owner marks an order as paid from the dashboard, and the database stamps `paid_at`. Customers cannot submit an order that is already marked paid. Online methods such as mobile money or card can be added later by extending the `payment_method` enum and adding a server-side payment step.

The app keeps a local copy of orders and reservations, so requests still receive a reference when cloud sync is temporarily unavailable. Once the migration is installed, signed-in customers and restaurant owners can access permitted records across devices under Row Level Security.

## Assigning the first restaurant owner

After creating an owner account, copy its user UUID from Supabase Authentication and run this once in the SQL editor:

```sql
update public.restaurants
set owner_id = 'OWNER_USER_UUID'
where id = 1 and owner_id is null;
```

This manual bootstrap is temporary. The next implementation phase replaces it with owner onboarding and restaurant creation.

## Data security

- Active restaurant and menu information is public.
- Customers can read only requests associated with their account.
- Restaurant owners can read and update only requests sent to their restaurant.
- Anonymous customers may submit a request, but cannot query it from the API afterward.
- The mobile app uses only the publishable key. Never place a Supabase secret or service-role key in `.env`.

## Delivery roadmap

- [x] Supabase schema for restaurants, menus, reservations, and orders
- [x] Row Level Security ownership boundaries
- [x] Local-first request submission with cloud synchronization
- [ ] Owner restaurant onboarding and database-backed editing
- [ ] Restaurant and menu image uploads
- [x] Customer order and reservation tracking screen
- [x] Rating, price, and distance filters
- [ ] Native date/time booking controls and capacity validation
- [ ] Push notifications
- [x] Phone (SMS code) sign-in
- [x] Cash payment tracking (owner marks orders paid)
- [ ] Mobile money/card payments
- [ ] Automated tests, accessibility audit, and real-device QA

## Validation

```bash
npx expo lint
npx tsc --noEmit
npx expo-doctor
```
