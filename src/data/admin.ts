import { supabase } from '../../lib/supabase';
import { RESTAURANT_COLUMNS, toRestaurant, type RestaurantSummary } from './restaurants';

/** True when the signed-in account is listed in public.admins. */
export async function checkIsAdmin() {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return false;
  const { data, error } = await supabase.rpc('is_admin');
  return !error && data === true;
}

/** Every restaurant, including ones waiting for review (admins can see them all). */
export async function fetchRestaurantsForReview(): Promise<RestaurantSummary[]> {
  const { data, error } = await supabase.from('restaurants').select(RESTAURANT_COLUMNS).order('id', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => toRestaurant(row as Parameters<typeof toRestaurant>[0]));
}

export async function reviewRestaurant(id: number, approve: boolean, reason = '') {
  const { error } = await supabase.rpc('admin_review_restaurant', { p_restaurant_id: id, p_approve: approve, p_reason: reason });
  if (error) throw error;
}

export async function updateListing(id: number, rating: number, tag: string) {
  const { error } = await supabase.rpc('admin_update_listing', { p_restaurant_id: id, p_rating: rating, p_tag: tag });
  if (error) throw error;
}
