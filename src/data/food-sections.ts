import { t } from '@/i18n';
import type { MenuItem, Restaurant } from './restaurants';

/** A dish together with the restaurant that serves it. */
export type FoodItem = { dish: MenuItem; restaurant: Restaurant };
/** How often a dish was ordered recently (from the popular_dishes database function). */
export type PopularDish = { restaurantId: number; dishName: string; timesOrdered: number };

export type FoodSection = {
  key: 'top' | 'popular' | 'new' | 'saved';
  title: string;
  caption: string;
  /** Shown in place of the row when it has no foods yet, so every category stays visible. */
  empty: string;
  items: FoodItem[];
};

const ROW_SIZE = 10;
const PER_RESTAURANT = 2;
export const NEW_FOOD_DAYS = 60;
const DAY_MS = 86_400_000;

type Options = {
  popular: PopularDish[];
  savedDishIds: Set<string>;
  isAvailable: (dish: MenuItem, restaurant: Restaurant) => boolean;
  now?: number;
};

/** The four food rows on the home screen: Top rated, Popular, New and Saved. */
export function foodSections(restaurants: Restaurant[], { isAvailable, now = Date.now(), popular, savedDishIds }: Options): FoodSection[] {
  const all: FoodItem[] = restaurants.flatMap((restaurant) => restaurant.menu.map((dish) => ({ dish, restaurant })));
  const availableFirst = (a: FoodItem, b: FoodItem) => Number(isAvailable(b.dish, b.restaurant)) - Number(isAvailable(a.dish, a.restaurant));

  // Best-rated restaurants first, at most two dishes from each so the row is varied.
  const topRated = restaurants
    .filter((restaurant) => restaurant.rating > 0 && restaurant.menu.length > 0)
    .sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount)
    .flatMap((restaurant) => restaurant.menu.map((dish) => ({ dish, restaurant })).sort(availableFirst).slice(0, PER_RESTAURANT))
    .slice(0, ROW_SIZE);

  // Orders store the dish name, so counts are matched to dishes that are still on the menu.
  const byName = new Map(all.map((item) => [`${item.restaurant.id}|${item.dish.name.trim().toLowerCase()}`, item]));
  const mostOrdered = popular
    .map((entry) => byName.get(`${entry.restaurantId}|${entry.dishName.trim().toLowerCase()}`))
    .filter((item): item is FoodItem => item !== undefined)
    .slice(0, ROW_SIZE);

  const cutoff = now - NEW_FOOD_DAYS * DAY_MS;
  const added = (item: FoodItem) => Date.parse(item.dish.createdAt);
  const newest = all
    .filter((item) => added(item) >= cutoff)
    .sort((a, b) => added(b) - added(a) || b.restaurant.id - a.restaurant.id)
    .slice(0, ROW_SIZE);

  const saved = all.filter((item) => savedDishIds.has(item.dish.id));

  return [
    { key: 'top', title: t('foods.top.title'), caption: t('foods.top.caption'), empty: t('foods.top.empty'), items: topRated },
    { key: 'popular', title: t('foods.popular.title'), caption: t('foods.popular.caption'), empty: t('foods.popular.empty'), items: mostOrdered },
    { key: 'new', title: t('foods.new.title'), caption: t('foods.new.caption', { days: NEW_FOOD_DAYS }), empty: t('foods.new.empty'), items: newest },
    { key: 'saved', title: t('foods.saved.title'), caption: t('foods.saved.caption'), empty: t('foods.saved.empty'), items: saved },
  ];
}
