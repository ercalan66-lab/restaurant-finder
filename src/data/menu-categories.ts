import { allTranslations, t, type MessageKey } from '@/i18n';

/**
 * Kwetu's food categories, in the order menus are shown. The keys are stored in
 * menu_items.category and must match the check in 202611210001_menu_categories.sql.
 */
export const MENU_CATEGORIES = [
  'pizza', 'burgers', 'chips', 'chicken', 'grill', 'seafood', 'sandwiches', 'rice', 'snacks', 'soups', 'desserts', 'drinks', 'other',
] as const;
export type MenuCategory = (typeof MENU_CATEGORIES)[number];

const ICONS: Record<MenuCategory, string> = {
  pizza: '🍕', burgers: '🍔', chips: '🍟', chicken: '🍗', grill: '🍢', seafood: '🐟', sandwiches: '🌯',
  rice: '🍚', snacks: '🥟', soups: '🍲', desserts: '🍰', drinks: '🥤', other: '🍽️',
};

const labelKey = (category: MenuCategory) => `category.${category}` as MessageKey;

export const isMenuCategory = (value: unknown): value is MenuCategory => (MENU_CATEGORIES as readonly unknown[]).includes(value);
export const toMenuCategory = (value: unknown): MenuCategory => (isMenuCategory(value) ? value : 'other');

/** "Baga" or "Burgers", in the current language. */
export const categoryLabel = (category: MenuCategory) => t(labelKey(category));
export const categoryIcon = (category: MenuCategory) => ICONS[category];
/** Extra words for owners choosing a category, e.g. "Sambusa, mandazi, bhajia". Empty when there are none. */
export const categoryHint = (category: MenuCategory) => t(`categoryHint.${category}` as MessageKey);
/** The category's name in every language, so a search for "baga" or "burger" finds burgers. */
export const categorySearchText = (category: MenuCategory) => (category === 'other' ? '' : allTranslations(labelKey(category)).join(' '));

/** Dishes grouped in the fixed category order. Categories without dishes are left out; order within a group is kept. */
export function groupByCategory<T extends { category: MenuCategory }>(items: T[]): { category: MenuCategory; items: T[] }[] {
  return MENU_CATEGORIES
    .map((category) => ({ category, items: items.filter((item) => item.category === category) }))
    .filter((group) => group.items.length > 0);
}

// Same rules, in the same order, as the update in 202611210001_menu_categories.sql.
const GUESSES: [MenuCategory, RegExp][] = [
  ['drinks', /juice|soda|chai|coffee|kahawa|\btea\b|smoothie|shake|\bmaji\b|water/i],
  ['desserts', /dessert|cake|keki|ice cream|tiramisu|pudding/i],
  ['soups', /soup|supu/i],
  ['pizza', /pizza|margherita/i],
  ['burgers', /burger|baga/i],
  ['sandwiches', /sandwich|sandwichi|wrap|rapu|shawarma|sourdough|toast/i],
  ['chips', /chips|chipsi|fries/i],
  ['rice', /rice|\bwali\b|pilau|biriani|biryani|ugali/i],
  ['snacks', /sambusa|samosa|mandazi|bhajia|pastry|kebab/i],
  ['seafood', /fish|samaki|seafood|prawn|octopus|pweza|sushi|salmon|calamari|lobster|kamba/i],
  ['chicken', /chicken|kuku|wings/i],
  ['grill', /nyama|choma|mishkaki|skewer|grill|steak/i],
];

/** A best guess from the dish name, used for the bundled demo menus. */
export function guessCategory(name: string): MenuCategory {
  return GUESSES.find(([, pattern]) => pattern.test(name))?.[0] ?? 'other';
}
