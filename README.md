# Kwetu restaurant finder

An Expo SDK 58 restaurant discovery and food-ordering app backed by Supabase.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and add the Supabase project URL and publishable key.
3. In the Supabase SQL editor, run each file in `supabase/migrations/` in filename order:
   1. `202611100001_restaurant_foundation.sql`
   2. `202611180001_order_payments.sql`
   3. `202611180002_restaurant_onboarding.sql` (also creates the `restaurant-photos` storage bucket)
   4. `202611180003_push_notifications.sql` (enables `pg_net` and the notification triggers)
   5. `202611180004_status_values.sql` (new order, booking, and payment values). Run it on its own and let it finish before the next one: Postgres cannot use new enum values in the transaction that adds them.
   6. `202611180005_launch_readiness.sql` (restaurant approval, booking capacity, cancel, pay on delivery, account deletion)
   7. The rest in filename order: `202611180006_admin_console.sql`, `202611200001_api_access_grants.sql`, `202611200002_rename_to_kwetu.sql`, `202611200003_customer_reviews.sql`, `202611200004_menu_pdf.sql`, `202611200005_restaurant_location.sql`, `202611200006_popular_dishes.sql`, `202611210001_menu_categories.sql` (food categories such as Pizza, Baga and Vinywaji; existing dishes get a best guess from their name), `202611210002_request_safety.sql` (the database sets each new order's status and prices itself, limits waiting requests per phone number, and checks owners' map and menu-PDF links), `202611210003_cash_only.sql` (switches off the old simulated mobile money payment; notifications mention cash), `202611210004_no_table_booking.sql` (table booking was removed; new bookings are refused), `202611210005_two_step_sign_in.sql` and `202611230001_admin_two_step_optional.sql` (see [Two-step sign-in](#two-step-sign-in)), `202611260001_menu_photos.sql` (photos of the printed menu; see [Restaurant owners](#restaurant-owners)), `202611280001_sms_sign_in.sql` (see [Sign-in by SMS](#sign-in-by-sms)), `202611280002_admin_tools.sql` (orders nobody answers, admin cancel and order details, restaurants set up by admins; see [Kwetu admins](#kwetu-admins)).

   Run new migrations before shipping an app build that depends on them. Until they are installed, order sync fails and customers see the bundled sample restaurants with an "Offline" note.
4. Make yourself a Kwetu admin (see [Kwetu admins](#kwetu-admins)) so you can approve new restaurants.
5. Fill in `SUPPORT_EMAIL` in `src/constants/app-info.ts`. It is shown in the privacy policy.
6. Start the app with `npx expo start`. Expo Go runs everything except push notifications on Android, which need a development build.

## Sign-in by SMS

Customers and owners can sign up and sign in with their phone number and a 6-digit code sent by SMS. Email and password remain as a second way in. Supabase creates and checks the codes. A Tanzanian SMS company delivers them: NextSMS (`nextsms.co.tz`) or Beem (`beem.africa`), at about TSh 16–25 per SMS.

- **Sign in:** only numbers that already belong to an account get a code. Accounts created with email keep signing in with email.
- **Sign up with phone:** name, phone number and "I am a customer / restaurant owner". The account is created when the code is confirmed. No password is needed.
- Numbers typed in local Tanzanian format (`0712 345 678`) are converted to `+255…` automatically.

To turn it on:

1. **Open an account with the SMS company** and top it up. Ask them to register the sender name **KWETU**; Tanzanian sender names need approval, which takes a few days. Until then, use their default name (`NEXTSMS` or `INFO`).
2. **Run `supabase/migrations/202611280001_sms_sign_in.sql`** in the SQL editor.
3. **Store the SMS company's login** in the SQL editor (it is kept encrypted in Supabase Vault and never reaches the app):

   ```sql
   -- NextSMS: username and password of the NextSMS account
   select private.configure_sms('nextsms', 'NEXTSMS', 'your-username', 'your-password');
   -- or Beem: API key and secret key from the Beem dashboard
   select private.configure_sms('beem', 'INFO', 'your-api-key', 'your-secret-key');
   ```

   Run it again with `'KWETU'` as the second value once the sender name is approved.
4. **Dashboard → Authentication → Hooks:** add the **Send SMS** hook, type **Postgres**, function `public.send_sms_code`.
5. **Dashboard → Authentication → Sign In / Providers → Phone:** enable it.
6. **Dashboard → Authentication → Rate Limits:** raise "SMS messages per hour" (default 30) before launch.

**Test numbers (no SMS cost):** under **Sign In / Providers → Phone → Test Phone Numbers and OTPs**, add pairs such as `255700000001=123456`. Such a number signs in with that fixed code. Use one for Google Play's reviewer account, and remove the others before launch: anyone who knows a test number and its code can sign in as that user.

**If no SMS arrives,** check the SMS company's replies (kept for six hours) in the SQL editor:

```sql
select created, status_code, content from net._http_response order by created desc limit 5;
```

A 401 means the login is wrong; a balance error means the account needs a top-up.

## Push notifications

| When | Who is notified | Opens |
| --- | --- | --- |
| A new order arrives, or a customer cancels | The restaurant owner's phones | Owner dashboard |
| An order is accepted, ready / on its way, completed, or declined | The customer (guest or signed in) | Profile |
| A new restaurant needs review | Kwetu admins | Admin screen |
| A restaurant is approved or needs changes | Its owner | Owner dashboard |

How it works:

- **Customers** are asked for permission when they place an order. The phone's push token is stored with the order, so guests are notified too.
- **Owners** turn alerts on from the card on their dashboard. Each phone is linked to the signed-in account and unlinked on sign-out.
- **Sending:** a database trigger sends the notification to Expo's push service with `pg_net`, so there is no server to deploy. A failed send never blocks the order.
- **Privacy:** push tokens cannot be read back through the API.

One-time setup:

1. **Create an EAS project.** Run `npx eas-cli@latest init` (needs a free Expo account). It adds `extra.eas.projectId` to `app.json`; commit that. Without it the app skips push and the dashboard card says alerts are unavailable.
2. **Use a development build, not Expo Go.** Expo Go on Android has no remote push since SDK 53. Run `npx eas-cli@latest build:configure` once, then `npx eas-cli@latest build --profile development --platform android` (or `ios`). Set `android.package` and `ios.bundleIdentifier` in `app.json` when EAS asks.
3. **Set up Android (Firebase Cloud Messaging).** Done for Kwetu: Firebase project `kwetu-51b0d`, with Android app `com.kwetutz.app`.
   1. Create a Firebase project and add an Android app with the same package name.
   2. Put its `google-services.json` in the project root and set `"android": { "googleServicesFile": "./google-services.json" }`. The file only holds public identifiers, and Expo says it may be committed.
   3. In Firebase, go to **Project settings → Service accounts → Generate new private key**. Upload that key on expo.dev under **Credentials → Android → com.kwetutz.app → FCM V1 service account key**, or with `npx eas-cli@latest credentials`. That key is secret: keep it out of git.
   4. Rebuild the app. Android phones get no push token until a build includes `google-services.json`.
4. **Set up iOS:** a paid Apple Developer account is required. EAS creates the push key during the build.
5. **Run the migration** above.

Delivery receipts from Expo are not checked yet, so tokens from uninstalled apps are not cleaned up automatically.

## Payments (cash only)

Kwetu takes no payments in the app. Customers pay the restaurant in cash, and the restaurant confirms it:

- **Pickup orders:** the owner taps Accept, Start preparing, and **Ready for pickup**. When the customer has collected the food and paid at the counter, the owner taps **Collected · cash received**.
- **Delivery orders:** the owner taps Accept, Start preparing, and **Out for delivery**. When the customer has the food and the rider has the cash, the owner taps **Delivered · cash received**.

That last step marks the order paid in cash and completes it, and the customer is notified and can rate it. Only the restaurant's owner can do it; customers can never mark an order paid. The old simulated mobile money function `pay_order` is switched off by `202611210003_cash_only.sql`.

The app keeps a local copy of orders, so orders still receive a reference when cloud sync is temporarily unavailable. Customers (including guests) see live status through the `request_statuses` function. The profile refreshes every 15 seconds, and whenever a notification arrives.

## Table booking (removed)

Kwetu used to let customers book a table. That was removed on 2026-11-21: the app has no booking screens, and `202611210004_no_table_booking.sql` makes the database refuse new bookings, including from older app versions. Past bookings stay in the `reservations` table as a record. To bring booking back, restore the screens from git history (before commit "Remove table booking") and grant insert on `public.reservations` again.

## Cancelling

Customers can cancel an order while it is still pending. Cancelling works from the profile, for guests too (they prove it is theirs with the phone number on the order), and the owner is notified. An order that was never sent is simply not sent.

## Kwetu admins

New restaurants start as **waiting for approval** and are hidden from customers until an admin approves them. Restaurants that existed before this change stay live.

To make an account an admin, copy its user UUID from Supabase **Authentication → Users** and run this in the SQL editor:

```sql
insert into public.admins (user_id) values ('YOUR_USER_UUID');
```

The admin console is not shown anywhere customers look. To open it, **press and hold the KWETU logo** at the top of the home screen for 2 seconds, then sign in with the admin account (plus the code from its authenticator app if that admin turned on [two-step sign-in](#two-step-sign-in)). This admin sign-in is separate from the customer account on the phone: signing in or out of one does not affect the other. In the console admins can:

- approve a restaurant, or request changes with a reason the owner sees;
- unpublish a live restaurant;
- set the rating and the tag (for example "Bestseller");
- **set up a restaurant for an owner** (Restaurants → **+ Add a restaurant**, or **Set up & hand over** on a card). They fill in its details, menu, photos and location with the owner's own editing screens. Then they enter the owner's email or phone number under **Owner** to hand it over. The owner must have a Kwetu account; it becomes a restaurant-owner account and gets a notification. A restaurant without an owner cannot be approved, because nobody would receive its orders;
- **open any order** (Orders → **Show details**): the dishes, delivery address, the customer's email, and how the order ended;
- **cancel an order** that is not finished, with a reason. The customer and the restaurant are both notified.

When an owner saves changes to a rejected restaurant, it goes back into review automatically.

**Orders nobody answers** (`202611280002_admin_tools.sql`): a `pg_cron` job runs `handle_waiting_orders()` every minute.

- **After 15 minutes:** the restaurant gets a reminder, the admins get an alert, and the order shows **NO ANSWER** in the Orders tab and on the Overview.
- **After 30 minutes:** the order is cancelled and the customer is told the restaurant did not answer.

To change the times, edit the intervals in `handle_waiting_orders()` and the matching constants in `src/data/admin.ts`. To check that the job runs: `select * from cron.job_run_details order by start_time desc limit 5;`.

## Two-step sign-in

After the password, people can also be asked for a 6-digit code from a free authenticator app such as Google Authenticator or Microsoft Authenticator. This uses Supabase MFA with TOTP, which is free and on by default in every Supabase project. No SMS provider is needed.

- **Admins can turn it on** in the admin console under **Admins → Two-step sign-in**, and turn it off again from the same place. It is optional, as for everyone else.
- **Customers and restaurant owners can turn it on** in **Settings → Profile → Two-step sign-in**, and turn it off again from the same place.
- **To set it up**, tap **Add to my authenticator app**, which opens the installed app. Alternatively, type the setup key into the app, then confirm one code.
- **When signing in**, the code is asked after the password, and also after opening a sign-in or password-reset link from an email.

**What the database enforces** (`202611210005_two_step_sign_in.sql`, `202611230001_admin_two_step_optional.sql`):

- Admin powers (`is_admin()`) need `two_step_ok()`: an admin who turned two-step sign-in on must have passed the code step (JWT claim `aal` = `aal2`); an admin without an authenticator needs only the password.
- Once an account has an authenticator, a password-only session cannot read or change that account's private data. It cannot:
  - read or update orders;
  - edit the restaurant, menu or photos;
  - read devices, register a device for notifications, or delete the account.
- Public reads, such as restaurants and menus, stay open.

**If someone loses the phone with their authenticator app,** remove the authenticator in the Supabase SQL editor. They can then sign in with the password and set it up again. Put their email in the query:

```sql
delete from auth.mfa_factors where user_id = (select id from auth.users where email = 'person@example.com');
```

## Account deletion and privacy

- **Profile → Delete account** calls `delete_my_account`. It deletes the account and hides any restaurant the person owns. It also removes their name, phone number, and address from past orders (and old bookings), which the restaurant keeps as a record, and clears the app's data on the phone. The App Store and Google Play require in-app deletion.
- The privacy policy lives at `/privacy` and is linked from the sign-in screen and the profile.
- The store listings need a public URL for it. Host the web build (for example with EAS Hosting), or publish the same text elsewhere.

## Restaurant owners

1. Register in the app and choose **Restaurant owner**.
2. The dashboard opens with a **Set up your restaurant** form. Submitting it creates the restaurant in Supabase, linked to that account (one restaurant per owner). It stays hidden until a Kwetu admin approves it.
3. The dashboard has four tabs (**Orders**, **Menu**, **Photos**, **Details**) and, until the listing is complete, a **Get your restaurant ready** checklist that opens the right tab for each missing step (main photo, photos of the place, menu photos, dishes, map location). From it the owner can:
   - handle orders;
   - add **photos of the printed menu** (up to eight pages), the quickest way to put a menu online; customers open them full screen;
   - add dishes with just a name, a price and a type (photo and description optional; serving times default to opening hours), and mark them in or out of stock;
   - optionally upload the menu as a PDF;
   - set a main photo and up to eight photos of the place, several at once;
   - edit details, hours, price per person and map location;
   - hide or show the restaurant.

Every photo button offers **Take a photo** (camera) or **Choose from phone**. Menu photos need `202611260001_menu_photos.sql`.

Changes are saved to Supabase and appear for every customer. The restaurant list and pages reload whenever a screen is opened.

Ratings, distance, and the promotional tag (for example "Bestseller") cannot be edited by owners. A new restaurant shows **New on Kwetu** until a rating is set.

The eight demo restaurants (ids 1–8) have no owner. To hand one to a real owner instead of having them create a new listing, run this once in the SQL editor (only if that owner has not created a restaurant yet):

```sql
update public.restaurants set owner_id = 'OWNER_USER_UUID' where id = 1 and owner_id is null;
```

Photos are stored in the public `restaurant-photos` bucket under `<restaurant id>/cover|gallery|menu/`. Only the restaurant's owner can upload or delete files in that folder. Files are limited to 5 MB and to JPEG, PNG, or WebP.

## Data security

- Restaurant and menu information is public once a restaurant is approved and visible. Hidden or unapproved restaurants are visible only to their owner and Kwetu admins, and cannot receive orders.
- Owners can edit only their own restaurant, menu, and photos.
- Customers can read only requests associated with their account.
- Restaurant owners can read and update only requests sent to their restaurant.
- Anonymous customers may submit a request. Afterwards they can read only its status (via `request_statuses`, by reference), and cancel it only with the phone number on the request.
- The mobile app uses only the publishable key. Never place a Supabase secret or service-role key in `.env`.
- New orders always start as waiting requests. The database sets their status and time, and takes every dish's name and price from the menu, so a modified app cannot send a "completed" order (which would allow fake reviews) or change prices. One phone number can have at most 5 orders waiting at a restaurant.
- The app opens an owner's map link only if it is a Google Maps link, and their menu PDF only if it is stored in Kwetu's own `restaurant-menus` bucket; the database checks new values the same way.
- Email links use PKCE: they carry a one-time code that works only on the phone that asked for the email. Links that carry sign-in tokens directly are refused.
- The admin console has its own sign-in, stored separately from the customer account (see [Kwetu admins](#kwetu-admins)). Anyone, admins included, can turn on [two-step sign-in](#two-step-sign-in).
- Android backups are turned off (`allowBackup: false`), so sign-ins saved on the phone cannot be copied out through a backup.
- Before launch, in the Supabase dashboard: remove `exp://**` from **Authentication → URL Configuration → Redirect URLs** (it is only for testing in Expo Go), and set **Authentication → Providers → Email** to a minimum password length of 8 with letters and digits, matching the app's rule.
- No payment details are handled: Kwetu is cash only, and only a restaurant's owner can mark its orders paid.

## Delivery roadmap

- [x] Supabase schema for restaurants, menus, reservations, and orders
- [x] Row Level Security ownership boundaries
- [x] Local-first request submission with cloud synchronization
- [x] Owner restaurant onboarding and database-backed editing
- [x] Restaurant and menu image uploads
- [x] Customer order tracking screen
- [x] Rating, price, and distance filters
- [x] Push notifications (needs EAS project + development build, see above)
- [x] Phone (SMS code) sign-in
- [x] Cash only: paid at the counter or to the rider, confirmed by the restaurant
- [x] Restaurant approval by Kwetu admins
- [x] Customer cancellation and live status
- [x] In-app account deletion and privacy policy
- [ ] Automated tests, accessibility audit, and real-device QA

## Validation

```bash
npx expo lint
npx tsc --noEmit
npx expo-doctor
```
