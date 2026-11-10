# Fork restaurant finder

An Expo SDK 58 restaurant discovery, reservation, and food-ordering app backed by Supabase.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and add the Supabase project URL and publishable key.
3. In the Supabase SQL editor, run `supabase/migrations/202611100001_restaurant_foundation.sql`.
4. Start the app with `npx expo start`.

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
- [ ] Customer order and reservation tracking screen
- [ ] Rating, price, distance, and availability filters
- [ ] Native date/time booking controls and capacity validation
- [ ] Push notifications
- [ ] Mobile money/card payments
- [ ] Automated tests, accessibility audit, and real-device QA

## Validation

```bash
npx expo lint
npx tsc --noEmit
npx expo-doctor
```
