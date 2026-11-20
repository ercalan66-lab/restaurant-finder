import type { MenuItem, Restaurant } from './restaurants';

/** One search result: the restaurant, whether its name (or cuisine or area) matched, and the dishes that matched. */
export type SearchHit = { restaurant: Restaurant; nameMatch: boolean; dishes: MenuItem[] };

const words = (query: string) => query.toLowerCase().split(/\s+/).filter(Boolean);
const matchesAll = (text: string, terms: string[]) => {
  const haystack = text.toLowerCase();
  return terms.every((term) => haystack.includes(term));
};

/**
 * Finds restaurants by name, cuisine or area, and dishes by name or ingredients. Every word typed must
 * appear ("coconut curry" finds "Coconut fish curry"). Restaurants whose name matched come first, then
 * those with the most matching dishes.
 */
export function searchRestaurants(restaurants: Restaurant[], query: string): SearchHit[] {
  const terms = words(query);
  if (!terms.length) return restaurants.map((restaurant) => ({ restaurant, nameMatch: false, dishes: [] }));
  return restaurants
    .map((restaurant) => ({
      restaurant,
      nameMatch: matchesAll(`${restaurant.name} ${restaurant.cuisine} ${restaurant.area}`, terms),
      dishes: restaurant.menu.filter((dish) => matchesAll(`${dish.name} ${dish.description}`, terms)),
    }))
    .filter((hit) => hit.nameMatch || hit.dishes.length > 0)
    .sort((a, b) => Number(b.nameMatch) - Number(a.nameMatch) || b.dishes.length - a.dishes.length || a.restaurant.name.localeCompare(b.restaurant.name));
}
