import type { RestaurantSummary } from './restaurants';

export const ROW_SIZE = 10;
/** Restaurants added within this many days appear under "New on Kwetu". */
export const NEW_WITHIN_DAYS = 60;
const DAY_MS = 86_400_000;

export type HomeSection = { key: 'near' | 'popular' | 'new'; title: string; caption: string; restaurants: RestaurantSummary[] };

type Options = {
  /** Kilometres from the person to a restaurant, or null when unknown. */
  distanceOf: (restaurant: RestaurantSummary) => number | null;
  /** True when distances come from the phone's location rather than the stored estimate. */
  fromUser: boolean;
  now?: number;
};

/**
 * The rows on the home screen. Rows with nothing to show are left out. "Near you" sorts by the
 * distance the caller provides. Until any restaurant has reviews, the second row shows the
 * highest-rated places instead.
 */
export function homeSections(restaurants: RestaurantSummary[], { distanceOf, fromUser, now = Date.now() }: Options): HomeSection[] {
  const near = restaurants
    .map((restaurant) => ({ restaurant, km: distanceOf(restaurant) }))
    .filter((entry): entry is { restaurant: RestaurantSummary; km: number } => entry.km != null)
    .sort((a, b) => a.km - b.km)
    .slice(0, ROW_SIZE)
    .map((entry) => entry.restaurant);

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
    { key: 'near', title: 'Near you', caption: fromUser ? 'Closest to where you are now' : 'Turn on location to sort by your own distance', restaurants: near },
    mostReviewed.length
      ? { key: 'popular', title: 'Most reviewed', caption: 'Places customers talk about most', restaurants: mostReviewed }
      : { key: 'popular', title: 'Top rated', caption: 'The highest-rated places on Kwetu', restaurants: topRated },
    { key: 'new', title: 'New on Kwetu', caption: `Added in the last ${NEW_WITHIN_DAYS} days`, restaurants: fresh },
  ];
  return sections.filter((section) => section.restaurants.length > 0);
}
