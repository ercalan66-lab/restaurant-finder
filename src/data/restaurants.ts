import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { errorMessage } from '@/utils/feedback';
import { supabase } from '../../lib/supabase';
import { demoRestaurants } from './demo-restaurants';

export const CUISINES = ['African', 'Italian', 'Asian', 'Indian', 'Cafe', 'Other'] as const;

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  photoUrl: string | null;
  availableFrom: string;
  availableUntil: string;
  inStock: boolean;
};

export type RestaurantSummary = {
  id: number;
  ownerId: string | null;
  name: string;
  cuisine: string;
  area: string;
  address: string;
  description: string;
  phone: string;
  email: string;
  opensAt: string;
  closesAt: string;
  mapUrl: string;
  facilities: string[];
  coverUrl: string | null;
  galleryUrls: string[];
  rating: number;
  distanceKm: number;
  pricePerPerson: number;
  tag: string;
  isActive: boolean;
  /** New restaurants stay hidden from customers until a Kwetu admin approves them. */
  approvalStatus: ApprovalStatus;
  rejectionReason: string;
  /** Guests that can be booked into one time slot. */
  seatsPerSlot: number;
};

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type Restaurant = RestaurantSummary & { menu: MenuItem[] };

export const RESTAURANT_COLUMNS = 'id, owner_id, name, cuisine, area, address, description, phone, email, opens_at, closes_at, map_url, facilities, cover_url, gallery_urls, rating, distance_km, price_per_person, tag, is_active, approval_status, rejection_reason, seats_per_slot';
export const MENU_COLUMNS = 'id, name, ingredients, price, photo_url, available_from, available_until, in_stock, created_at';

type RestaurantRow = {
  id: number; owner_id: string | null; name: string; cuisine: string; area: string; address: string; description: string;
  phone: string; email: string; opens_at: string; closes_at: string; map_url: string; facilities: string[] | null;
  cover_url: string | null; gallery_urls: string[] | null; rating: number | string; distance_km: number | string;
  price_per_person: number; tag: string; is_active: boolean; approval_status: ApprovalStatus; rejection_reason: string | null;
  seats_per_slot: number; menu_items?: MenuRow[];
};
export type MenuRow = {
  id: string; name: string; ingredients: string; price: number; photo_url: string | null;
  available_from: string; available_until: string; in_stock: boolean; created_at: string;
};

const hhmm = (time: string | null | undefined) => (time ?? '').slice(0, 5);

// supabase-js retries failed reads several times; cap the wait so the bundled fallback appears quickly when offline.
const REQUEST_TIMEOUT_MS = 6000;
async function withTimeout<T>(run: (signal: AbortSignal) => PromiseLike<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

export function toMenuItem(row: MenuRow): MenuItem {
  return {
    id: row.id,
    name: row.name,
    description: row.ingredients,
    price: row.price,
    photoUrl: row.photo_url,
    availableFrom: hhmm(row.available_from),
    availableUntil: hhmm(row.available_until),
    inStock: row.in_stock,
  };
}

export function toRestaurant(row: RestaurantRow): Restaurant {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    cuisine: row.cuisine,
    area: row.area,
    address: row.address,
    description: row.description,
    phone: row.phone,
    email: row.email,
    opensAt: hhmm(row.opens_at),
    closesAt: hhmm(row.closes_at),
    mapUrl: row.map_url,
    facilities: row.facilities ?? [],
    coverUrl: row.cover_url,
    galleryUrls: row.gallery_urls ?? [],
    rating: Number(row.rating),
    distanceKm: Number(row.distance_km),
    pricePerPerson: row.price_per_person,
    tag: row.tag,
    isActive: row.is_active,
    approvalStatus: row.approval_status ?? 'approved',
    rejectionReason: row.rejection_reason ?? '',
    seatsPerSlot: row.seats_per_slot ?? 40,
    menu: [...(row.menu_items ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at)).map(toMenuItem),
  };
}

/** Active restaurants for the customer list. Falls back to the bundled demo list when Supabase is unreachable. */
export async function fetchRestaurants(): Promise<{ restaurants: RestaurantSummary[]; offline: boolean }> {
  try {
    const { data, error } = await withTimeout((signal) => supabase.from('restaurants').select(RESTAURANT_COLUMNS).eq('is_active', true).eq('approval_status', 'approved').order('id').abortSignal(signal));
    if (error) throw error;
    return { restaurants: (data as RestaurantRow[]).map(toRestaurant), offline: false };
  } catch (error) {
    console.warn('Restaurant list unavailable, showing bundled restaurants:', errorMessage(error, 'unknown error'));
    return { restaurants: demoRestaurants, offline: true };
  }
}

/** One restaurant with its menu. Returns null when it does not exist or is hidden. */
export async function fetchRestaurant(id: number): Promise<Restaurant | null> {
  try {
    const { data, error } = await withTimeout((signal) => supabase
      .from('restaurants')
      .select(`${RESTAURANT_COLUMNS}, menu_items(${MENU_COLUMNS})`)
      .eq('id', id)
      .abortSignal(signal)
      .maybeSingle());
    if (error) throw error;
    return data ? toRestaurant(data as RestaurantRow) : null;
  } catch (error) {
    console.warn('Restaurant unavailable, using bundled data:', errorMessage(error, 'unknown error'));
    return demoRestaurants.find((restaurant) => restaurant.id === id) ?? null;
  }
}

/** Reloads every time the screen gains focus, so owner edits show up when navigating back. */
export function useRestaurants() {
  const [state, setState] = useState<{ restaurants: RestaurantSummary[] | null; offline: boolean }>({ restaurants: null, offline: false });
  useFocusEffect(useCallback(() => {
    let active = true;
    void fetchRestaurants().then((result) => { if (active) setState(result); });
    return () => { active = false; };
  }, []));
  return state;
}

export function useRestaurant(id: string | undefined) {
  const [state, setState] = useState<{ restaurant: Restaurant | null; loading: boolean }>({ restaurant: null, loading: true });
  useFocusEffect(useCallback(() => {
    let active = true;
    const numericId = Number(id);
    const request = Number.isInteger(numericId) ? fetchRestaurant(numericId) : Promise.resolve(null);
    void request.then((restaurant) => { if (active) setState({ restaurant, loading: false }); });
    return () => { active = false; };
  }, [id]));
  return state;
}

export const formatTsh = (amount: number) => `TSh ${amount.toLocaleString()}`;
export const formatHours = (restaurant: Pick<RestaurantSummary, 'opensAt' | 'closesAt'>) => `Daily · ${restaurant.opensAt}–${restaurant.closesAt}`;

const timeOf = (date: Date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

function isTimeWithin(current: string, start: string, end: string) {
  if (!start || !end) return true;
  return start <= end ? current >= start && current <= end : current >= start || current <= end;
}

export function isOpenNow(restaurant: Pick<RestaurantSummary, 'opensAt' | 'closesAt'>, date = new Date()) {
  return isTimeWithin(timeOf(date), restaurant.opensAt, restaurant.closesAt);
}

export function isMenuItemAvailable(item: MenuItem, restaurant: Pick<RestaurantSummary, 'opensAt' | 'closesAt'>, date = new Date()) {
  const now = timeOf(date);
  return item.inStock && isTimeWithin(now, restaurant.opensAt, restaurant.closesAt) && isTimeWithin(now, item.availableFrom, item.availableUntil);
}
