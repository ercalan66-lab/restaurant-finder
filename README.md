# Fork restaurant finder

An Expo SDK 58 restaurant discovery, reservation, and food-ordering app backed by Supabase.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and add the Supabase project URL and publishable key.
3. In the Supabase SQL editor, run each file in `supabase/migrations/` in filename order:
   1. `202611100001_restaurant_foundation.sql`
   2. `202611180001_order_payments.sql`
   3. `202611180002_restaurant_onboarding.sql` (also creates the `restaurant-photos` storage bucket)
   4. `202611180003_push_notifications.sql` (enables `pg_net` and the notification triggers)

   Run new migrations before shipping an app build that depends on them. Until they are installed, order sync fails and customers see the bundled sample restaurants with an "Offline" note.
4. Start the app with `npx expo start`. Expo Go includes every native module the app uses, including the photo picker.

## Phone sign-in

Customers and owners can sign in with an SMS code as well as email and password. To turn it on:

1. In the Supabase dashboard, open **Authentication → Sign In / Providers → Phone** and enable it.
2. Connect an SMS provider (Twilio, MessageBird, Vonage, or Textlocal) and paste its credentials there. Each code sent is billed by that provider.
3. For development without SMS costs, add test numbers and fixed codes under the same settings.

Until a provider is configured, the app shows "Phone sign-in is not enabled" when someone requests a code. Numbers typed in local Tanzanian format (`0712 345 678`) are converted to `+255…` automatically.

## Push notifications

| When | Who is notified | Opens |
| --- | --- | --- |
| A new order or booking arrives | The restaurant owner's phones | Owner dashboard |
| An order is accepted, ready, or declined | The customer (guest or signed in) | Profile |
| A booking is confirmed or declined | The customer (guest or signed in) | Profile |

How it works:

- **Customers** are asked for permission when they place an order or booking. The phone's push token is stored with the request, so guests are notified too.
- **Owners** turn alerts on from the card on their dashboard. Each phone is linked to the signed-in account and unlinked on sign-out.
- **Sending:** a database trigger sends the notification to Expo's push service with `pg_net`, so there is no server to deploy. A failed send never blocks the order or booking.
- **Privacy:** push tokens cannot be read back through the API.

One-time setup:

1. **Create an EAS project.** Run `npx eas-cli@latest init` (needs a free Expo account). It adds `extra.eas.projectId` to `app.json`; commit that. Without it the app skips push and the dashboard card says alerts are unavailable.
2. **Use a development build, not Expo Go.** Expo Go on Android has no remote push since SDK 53. Run `npx eas-cli@latest build:configure` once, then `npx eas-cli@latest build --profile development --platform android` (or `ios`). Set `android.package` and `ios.bundleIdentifier` in `app.json` when EAS asks.
3. **Set up Android (Firebase Cloud Messaging):**
   1. Create a Firebase project and add an Android app with the same package name.
   2. Put its `google-services.json` in the project root and set `"android": { "googleServicesFile": "./google-services.json" }`.
   3. In Firebase, generate a service-account private key and upload it with `npx eas-cli@latest credentials` (Android → Google Service Account → FCM V1). Keep that key out of git.
4. **Set up iOS:** a paid Apple Developer account is required. EAS creates the push key during the build.
5. **Run the migration** above.

Delivery receipts from Expo are not checked yet, so tokens from uninstalled apps are not cleaned up automatically.

## Payments

Checkout currently offers **cash on pickup / cash on delivery** only. Every order records `payment_method` and `payment_status` (`unpaid` → `paid`). The restaurant owner marks an order as paid from the dashboard, and the database stamps `paid_at`. Customers cannot submit an order that is already marked paid. Online methods such as mobile money or card can be added later by extending the `payment_method` enum and adding a server-side payment step.

The app keeps a local copy of orders and reservations, so requests still receive a reference when cloud sync is temporarily unavailable. Once the migration is installed, signed-in customers and restaurant owners can access permitted records across devices under Row Level Security.

## Restaurant owners

1. Register in the app and choose **Restaurant owner**.
2. The dashboard opens with a **Set up your restaurant** form. Submitting it creates the restaurant in Supabase, linked to that account (one restaurant per owner).
3. From the dashboard the owner can:
   - edit details, hours, and price per person;
   - upload a cover photo, up to eight gallery photos, and food photos;
   - add, remove, and mark foods in or out of stock;
   - hide or show the restaurant;
   - handle orders and bookings.

Changes are saved to Supabase and appear for every customer. The restaurant list and pages reload whenever a screen is opened.

Ratings, distance, and the promotional tag (for example "Bestseller") cannot be edited by owners. A new restaurant shows **New on Fork** until a rating is set.

The eight demo restaurants (ids 1–8) have no owner. To hand one to a real owner instead of having them create a new listing, run this once in the SQL editor (only if that owner has not created a restaurant yet):

```sql
update public.restaurants set owner_id = 'OWNER_USER_UUID' where id = 1 and owner_id is null;
```

Photos are stored in the public `restaurant-photos` bucket under `<restaurant id>/cover|gallery|menu/`. Only the restaurant's owner can upload or delete files in that folder. Files are limited to 5 MB and to JPEG, PNG, or WebP.

## Data security

- Active restaurant and menu information is public. Hidden restaurants are visible only to their owner.
- Owners can edit only their own restaurant, menu, and photos.
- Customers can read only requests associated with their account.
- Restaurant owners can read and update only requests sent to their restaurant.
- Anonymous customers may submit a request, but cannot query it from the API afterward.
- The mobile app uses only the publishable key. Never place a Supabase secret or service-role key in `.env`.

## Delivery roadmap

- [x] Supabase schema for restaurants, menus, reservations, and orders
- [x] Row Level Security ownership boundaries
- [x] Local-first request submission with cloud synchronization
- [x] Owner restaurant onboarding and database-backed editing
- [x] Restaurant and menu image uploads
- [x] Customer order and reservation tracking screen
- [x] Rating, price, and distance filters
- [ ] Native date/time booking controls and capacity validation
- [x] Push notifications (needs EAS project + development build, see above)
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
