# Kwetu – Google Play Console answers

Copy each part into the matching place in Play Console. Images are in this folder:
`icon-512.png` (app icon) and `feature-graphic-1024x500.png` (feature graphic).

Web pages (live once GitHub Pages is turned on):

- Privacy policy: https://ercalan66-lab.github.io/restaurant-finder/
- Delete account: https://ercalan66-lab.github.io/restaurant-finder/delete-account.html

---

## 1. Store listing (Grow users → Store presence → Main store listing)

**App name** (max 30 characters)

```
Kwetu – Find Restaurants
```

**Short description** (max 80 characters)

```
Find restaurants near you, browse menus and order food. Pay in cash.
```

**Full description** (max 4000 characters)

```
Kwetu helps you find great local restaurants and order a meal in a few taps.

FIND FOOD NEAR YOU
• See restaurants near you, with how far away they are and whether they are open now.
• Search for a restaurant or for a dish, like pilau, chips mayai or pizza.
• Browse rows of top-rated, popular and new foods and restaurants.
• Filter by price, rating and distance.

SEE THE FULL MENU
• Menus with photos, prices and serving times, grouped by category.
• Some restaurants also share their full menu as a PDF.
• Photos of the restaurant, opening hours, phone number and directions.

ORDER EASILY, PAY IN CASH
• Order for delivery or pick-up, straight from the menu.
• The restaurant confirms your order, and you get a notification when it is ready.
• No card needed: you pay the restaurant in cash when you receive your food.

SAVE AND REVIEW
• Save your favourite restaurants and dishes with a tap.
• Rate and review a restaurant after your order is completed.

FOR RESTAURANT OWNERS
• List your restaurant and manage your menu, photos and opening hours.
• Receive orders and get alerts on your phone when a new order arrives.

YOUR PRIVACY
• Your location stays on your phone. It is only used to show distances.
• We do not sell your data or show ads.
• Optional two-step sign-in keeps your account safe.
• Delete your account at any time from the app.

Kwetu works in English and Kiswahili, with a light and dark theme.
```

### Kiswahili translation (Store listing → Manage translations → add "Swahili – sw")

**Short description**

```
Pata migahawa karibu nawe, tazama menyu na uagize chakula. Lipa kwa taslimu.
```

**Full description**

```
Kwetu inakusaidia kupata migahawa mizuri ya karibu na kuagiza chakula kwa miguso michache.

PATA CHAKULA KARIBU NAWE
• Ona migahawa iliyo karibu nawe, umbali wake na kama iko wazi sasa.
• Tafuta mgahawa au chakula, kama pilau, chipsi mayai au pizza.
• Pitia safu za vyakula na migahawa bora, maarufu na mipya.
• Chuja kwa bei, ukadiriaji na umbali.

ONA MENYU KAMILI
• Menyu zenye picha, bei na saa za kuhudumia, zikiwa zimepangwa kwa makundi.
• Migahawa mingine pia inaweka menyu yake kamili kama PDF.
• Picha za mgahawa, saa za kufungua, namba ya simu na maelekezo ya njia.

AGIZA KWA URAHISI, LIPA KWA TASLIMU
• Agiza kuletewa au kuchukua mwenyewe, moja kwa moja kutoka kwenye menyu.
• Mgahawa unathibitisha oda yako, na unapata taarifa ikiwa tayari.
• Huhitaji kadi: unalipa mgahawa kwa taslimu unapopokea chakula chako.

HIFADHI NA TOA MAONI
• Hifadhi migahawa na vyakula unavyopenda kwa mguso mmoja.
• Kadiria na toa maoni kuhusu mgahawa baada ya oda yako kukamilika.

KWA WAMILIKI WA MIGAHAWA
• Weka mgahawa wako na usimamie menyu, picha na saa za kufungua.
• Pokea oda na upate taarifa kwenye simu yako oda mpya inapoingia.

FARAGHA YAKO
• Eneo lako linabaki kwenye simu yako. Linatumika tu kuonyesha umbali.
• Hatuuzi taarifa zako wala kuonyesha matangazo.
• Kuingia kwa hatua mbili (si lazima) kunalinda akaunti yako.
• Futa akaunti yako wakati wowote ndani ya programu.

Kwetu inapatikana kwa Kiswahili na Kiingereza, ikiwa na mandhari ya mwanga na giza.
```

**Graphics**

- App icon: `icon-512.png`
- Feature graphic: `feature-graphic-1024x500.png`
- Phone screenshots: at least 2 (up to 8). Take them on your phone once real restaurants are in the app (Power + Volume down). Good screens: home, a restaurant page with its menu, the order screen, saved restaurants.

---

## 2. Store settings (Grow users → Store presence → Store settings)

- **App or game:** App
- **Category:** Food & Drink
- **Tags:** Food delivery, Restaurants, Local
- **Email:** the Kwetu support email (still to create)
- **Website:** https://ercalan66-lab.github.io/restaurant-finder/

---

## 3. App content (Policy → App content)

**Privacy policy:** https://ercalan66-lab.github.io/restaurant-finder/

**App access:** "All or some functionality is restricted". Add instructions:

```
Browsing restaurants and menus works without an account.
Ordering history, reviews and the restaurant owner dashboard need an account.
Test customer account: email <create one> / password <create one>
Open Settings (gear icon, top right of the home screen) → Profile to sign in.
```

Create a separate test account for Google (without two-step sign-in) and put its email and password here.

**Ads:** No, my app does not contain ads.

**Content rating:** fill in the questionnaire.

- Category: All other app types
- Violence, fear, sexuality, bad language, drugs, gambling: No to all
- Does the app allow users to interact or exchange content? **Yes**. Customers post public reviews, and restaurants receive orders.
- Does the app share the user's current physical location with other users? **No**
- Does the app allow users to buy digital goods? **No**. Food is paid in cash to the restaurant.
- Is the app a web browser or search engine? **No**

**Target audience:** 18 and over. Select only "18 and over", which keeps the app out of the children's (Families) rules.

**News app:** No. **COVID-19 app:** No. **Government app:** No. **Financial features:** None. **Health:** None.

**Data safety:** see section 4.

---

## 4. Data safety answers

**Does your app collect or share any of the required user data types?** Yes

**Is all of the user data collected by your app encrypted in transit?** Yes

**Which ways can users request that their data is deleted?**

- "My app provides a way for users to request that their data is deleted": Yes
- Delete account URL: https://ercalan66-lab.github.io/restaurant-finder/delete-account.html

**Data collected.** Kwetu shares no data. The restaurant only receives an order because the customer sends it, and Supabase and Expo are service providers. Google does not count either as "sharing".

| Data type | Collected | Required or optional | Purpose |
|---|---|---|---|
| Personal info → Name | Yes | Required to order | App functionality, Account management |
| Personal info → Email address | Yes | Optional | App functionality, Account management |
| Personal info → User IDs | Yes | Optional (only with an account) | Account management |
| Personal info → Address | Yes | Optional (only for delivery orders) | App functionality |
| Personal info → Phone number | Yes | Required to order | App functionality, Account management |
| Financial info → Purchase history | Yes | Required to order | App functionality |
| Location → Precise location | Yes | Optional (only restaurant owners who tap "Use my current location") | App functionality |
| Photos and videos → Photos | Yes | Optional (only restaurant owners) | App functionality |
| Files and docs | Yes | Optional (only restaurant owners' menu PDF) | App functionality |
| App activity → Other user-generated content | Yes | Optional (reviews) | App functionality |
| Device or other IDs | Yes | Optional (notification token) | App functionality |

For every row:

- **Is this data processed ephemerally?** No
- **Is this data required?** As in the table

Not collected: approximate location, a customer's own location (it stays on the phone), contacts, messages, payment details, health, web browsing, app performance or crash data.

---

## 5. First release notes (Testing → Closed testing → Create release)

```
<en-US>
First version of Kwetu: find restaurants near you, browse menus and order food, paid in cash.
</en-US>
<sw>
Toleo la kwanza la Kwetu: pata migahawa karibu nawe, tazama menyu na uagize chakula, ukilipa kwa taslimu.
</sw>
```
