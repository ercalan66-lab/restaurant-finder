-- Menu categories. Every dish belongs to one of Kwetu's fixed food categories, and the app shows a
-- restaurant's menu grouped by them. The keys must match MENU_CATEGORIES in
-- src/data/menu-categories.ts (the names people see, in English and Kiswahili, live in the app).
--
-- Existing dishes get a best guess from their name (same rules as guessCategory() in the app);
-- anything unrecognised becomes 'other', and owners can change it in their dashboard.
-- Safe to run more than once.

alter table public.menu_items add column if not exists category text not null default 'other';

alter table public.menu_items drop constraint if exists menu_items_category_check;
alter table public.menu_items add constraint menu_items_category_check check (category in (
  'pizza', 'burgers', 'chips', 'chicken', 'grill', 'seafood', 'sandwiches', 'rice', 'snacks', 'soups', 'desserts', 'drinks', 'other'
));

-- The order of the checks matters: "seafood grill" is seafood, "chicken burger" is a burger,
-- "sambusa za nyama" is a snack.
update public.menu_items set category = case
  when name ~* '(juice|soda|chai|coffee|kahawa|\mtea\M|smoothie|shake|\mmaji\M|water)' then 'drinks'
  when name ~* '(dessert|cake|keki|ice cream|tiramisu|pudding)' then 'desserts'
  when name ~* '(soup|supu)' then 'soups'
  when name ~* '(pizza|margherita)' then 'pizza'
  when name ~* '(burger|baga)' then 'burgers'
  when name ~* '(sandwich|sandwichi|wrap|rapu|shawarma|sourdough|toast)' then 'sandwiches'
  when name ~* '(chips|chipsi|fries)' then 'chips'
  when name ~* '(rice|\mwali\M|pilau|biriani|biryani|ugali)' then 'rice'
  when name ~* '(sambusa|samosa|mandazi|bhajia|pastry|kebab)' then 'snacks'
  when name ~* '(fish|samaki|seafood|prawn|octopus|pweza|sushi|salmon|calamari|lobster|kamba)' then 'seafood'
  when name ~* '(chicken|kuku|wings)' then 'chicken'
  when name ~* '(nyama|choma|mishkaki|skewer|grill|steak)' then 'grill'
  else 'other'
end
where category = 'other';
