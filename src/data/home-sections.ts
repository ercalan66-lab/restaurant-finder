import type { RestaurantSummary } from './restaurants';

export const ROW_SIZE = 10;
/** Restaurants added within this many days appear under "New on Kwetu". */
export const NEW_WITHIN_DAYS = 60;
const DAY_MS = 86_400_000;

export type HomeSection = { key: 'near' | 'popular' | 'new'; title: string; caption: string; restaurants: RestaurantSummary[] };

/**
 * The rows on the home screen. Rows with nothing to show are left out. "Near you" uses each
 * restaurant's distance as stored in Kwetu (not the phone's location). Until any restaurant has
 * reviews, the second row shows the highest-rated places instead.
 */
export function homeSections(restaurants: RestaurantSummary[], now = Date.now()): HomeSection[] {
  const near = restaurants
    .filter((restaurant) => restaurant.distanceKm > 0)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, ROW_SIZE);

  const mostReviewed = restaurants
    .filter((restaurant) => restaurant.reviewCount > 0)
    .sort((a, b) => b.reviewCount - a.reviewCount || b.rating - a.rating)
    .slice(0, ROW_SIZE);
  const topRated = restaurants
    .filter((restaurant) => restaurant.rating > 0)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, ROW_SIZE);

  const cutoff = now - NEW_WITHIN_DAYS * DAY_MS;
  const added = (restaurant: RestaurantSummary) => Date.parse(restaurant.createdAt);
  const fresh = restaurants
    .filter((restaurant) => added(restaurant) >= cutoff)
    .sort((a, b) => added(b) - added(a) || b.id - a.id)
    .slice(0, ROW_SIZE);

  const sections: HomeSection[] = [
    { key: 'near', title: 'Near you', caption: 'Closest restaurants first', restaurants: near },
    mostReviewed.length
      ? { key: 'popular', title: 'Most reviewed', caption: 'Places customers talk about most', restaurants: mostReviewed }
      : { key: 'popular', title: 'Top rated', caption: 'The highest-rated places on Kwetu', restaurants: topRated },
    { key: 'new', title: 'New on Kwetu', caption: `Added in the last ${NEW_WITHIN_DAYS} days`, restaurants: fresh },
  ];
  return sections.filter((section) => section.restaurants.length > 0);
}
