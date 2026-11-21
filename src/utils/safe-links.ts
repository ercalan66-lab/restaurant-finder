import { SUPABASE_URL } from '../../lib/supabase';

// Restaurant owners type these links themselves and can change them after Kwetu approved the
// restaurant, so the app opens only the kinds of links each button is meant for. The database
// checks the same rules for new values (202611210002_request_safety.sql).

const GOOGLE_DOMAIN = 'google\\.(com|co\\.[a-z]{2}|com\\.[a-z]{2}|[a-z]{2})';
const GOOGLE_MAPS = new RegExp(`^https://(maps\\.app\\.goo\\.gl|goo\\.gl/maps|maps\\.${GOOGLE_DOMAIN}|(www\\.)?${GOOGLE_DOMAIN}/maps)(/|\\?|$)`, 'i');

/** True for Google Maps links such as https://maps.app.goo.gl/… or https://www.google.com/maps/…. */
export const isGoogleMapsLink = (url: string) => GOOGLE_MAPS.test(url.trim());

/** True only for a menu PDF uploaded to this restaurant's folder in Kwetu's own storage. */
export function isKwetuMenuPdf(url: string | null | undefined, restaurantId: number): url is string {
  if (!url) return false;
  const folder = `${SUPABASE_URL}/storage/v1/object/public/restaurant-menus/${restaurantId}/`;
  return url.startsWith(folder) && !url.slice(folder.length).includes('/');
}
