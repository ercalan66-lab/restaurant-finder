import { supabase } from '../../lib/supabase';
import { MENU_COLUMNS, RESTAURANT_COLUMNS, toMenuItem, toRestaurant, type MenuItem, type MenuRow, type Restaurant } from './restaurants';

/** The restaurant fields an owner can edit. Rating, distance, and tag are managed by Fork. */
export type RestaurantDetails = Pick<Restaurant,
  'name' | 'cuisine' | 'area' | 'address' | 'description' | 'phone' | 'email' | 'opensAt' | 'closesAt'
  | 'mapUrl' | 'facilities' | 'pricePerPerson'>;
export type RestaurantChanges = Partial<RestaurantDetails & Pick<Restaurant, 'coverUrl' | 'galleryUrls' | 'isActive'>>;
export type MenuItemInput = Omit<MenuItem, 'id'>;

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Returns a message describing the first problem, or null when the details are valid. */
export function restaurantDetailsError(details: RestaurantDetails): string | null {
  if (!details.name.trim()) return 'Enter the restaurant name.';
  if (!details.area.trim() || !details.address.trim()) return 'Enter the area and street address.';
  if (!TIME_PATTERN.test(details.opensAt) || !TIME_PATTERN.test(details.closesAt)) return 'Use 24-hour HH:MM opening hours, for example 08:00 and 22:00.';
  if (details.mapUrl.trim() && !/^https?:\/\//i.test(details.mapUrl.trim())) return 'Enter a full Google Maps link beginning with http:// or https://.';
  if (details.email.trim() && !/^\S+@\S+\.\S+$/.test(details.email.trim())) return 'Enter a valid email address or leave it blank.';
  if (!Number.isInteger(details.pricePerPerson) || details.pricePerPerson < 0) return 'Enter the average price per person as a whole number.';
  return null;
}

export function menuItemError(item: MenuItemInput): string | null {
  if (!item.name.trim() || !item.description.trim()) return 'Enter the food name and ingredients.';
  if (!Number.isInteger(item.price) || item.price <= 0) return 'Enter the price as a whole number of shillings.';
  if (!TIME_PATTERN.test(item.availableFrom) || !TIME_PATTERN.test(item.availableUntil)) return 'Use 24-hour HH:MM serving hours, for example 08:00 and 22:00.';
  return null;
}

function restaurantColumns(changes: RestaurantChanges) {
  const columns: Record<string, unknown> = {};
  if (changes.name !== undefined) columns.name = changes.name.trim();
  if (changes.cuisine !== undefined) columns.cuisine = changes.cuisine;
  if (changes.area !== undefined) columns.area = changes.area.trim();
  if (changes.address !== undefined) columns.address = changes.address.trim();
  if (changes.description !== undefined) columns.description = changes.description.trim();
  if (changes.phone !== undefined) columns.phone = changes.phone.trim();
  if (changes.email !== undefined) columns.email = changes.email.trim();
  if (changes.opensAt !== undefined) columns.opens_at = changes.opensAt;
  if (changes.closesAt !== undefined) columns.closes_at = changes.closesAt;
  if (changes.mapUrl !== undefined) columns.map_url = changes.mapUrl.trim();
  if (changes.facilities !== undefined) columns.facilities = changes.facilities;
  if (changes.pricePerPerson !== undefined) columns.price_per_person = changes.pricePerPerson;
  if (changes.coverUrl !== undefined) columns.cover_url = changes.coverUrl;
  if (changes.galleryUrls !== undefined) columns.gallery_urls = changes.galleryUrls;
  if (changes.isActive !== undefined) columns.is_active = changes.isActive;
  return columns;
}

function menuColumns(item: Partial<MenuItemInput>) {
  const columns: Record<string, unknown> = {};
  if (item.name !== undefined) columns.name = item.name.trim();
  if (item.description !== undefined) columns.ingredients = item.description.trim();
  if (item.price !== undefined) columns.price = item.price;
  if (item.photoUrl !== undefined) columns.photo_url = item.photoUrl;
  if (item.availableFrom !== undefined) columns.available_from = item.availableFrom;
  if (item.availableUntil !== undefined) columns.available_until = item.availableUntil;
  if (item.inStock !== undefined) columns.in_stock = item.inStock;
  return columns;
}

const RESTAURANT_WITH_MENU = `${RESTAURANT_COLUMNS}, menu_items(${MENU_COLUMNS})`;

/** The signed-in owner's restaurant, or null if they have not created one yet. */
export async function fetchMyRestaurant(ownerId: string): Promise<Restaurant | null> {
  const { data, error } = await supabase.from('restaurants').select(RESTAURANT_WITH_MENU).eq('owner_id', ownerId).maybeSingle();
  if (error) throw error;
  return data ? toRestaurant(data) : null;
}

export async function createRestaurant(ownerId: string, details: RestaurantDetails): Promise<Restaurant> {
  const { data, error } = await supabase
    .from('restaurants')
    .insert({ owner_id: ownerId, ...restaurantColumns(details) })
    .select(RESTAURANT_WITH_MENU)
    .single();
  if (error) throw error;
  return toRestaurant(data);
}

export async function updateRestaurant(id: number, changes: RestaurantChanges) {
  const { error } = await supabase.from('restaurants').update(restaurantColumns(changes)).eq('id', id);
  if (error) throw error;
}

export async function addMenuItem(restaurantId: number, item: MenuItemInput): Promise<MenuItem> {
  const { data, error } = await supabase
    .from('menu_items')
    .insert({ restaurant_id: restaurantId, ...menuColumns(item) })
    .select(MENU_COLUMNS)
    .single();
  if (error) throw error;
  return toMenuItem(data as MenuRow);
}

export async function updateMenuItem(id: string, changes: Partial<MenuItemInput>) {
  const { error } = await supabase.from('menu_items').update(menuColumns(changes)).eq('id', id);
  if (error) throw error;
}

export async function deleteMenuItem(id: string) {
  const { error } = await supabase.from('menu_items').delete().eq('id', id);
  if (error) throw error;
}
