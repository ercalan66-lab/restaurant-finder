import { supabase } from '../../lib/supabase';

export type Review = {
  id: string;
  restaurantId: number;
  /** First name only. */
  authorName: string;
  rating: number;
  comment: string;
  isHidden: boolean;
  createdAt: string;
};
export type AdminReview = Review & { restaurantName: string };

export const MAX_REVIEW_COMMENT = 500;
const REVIEW_COLUMNS = 'id, restaurant_id, author_name, rating, comment, is_hidden, created_at';

type ReviewRow = { id: string; restaurant_id: number; author_name: string; rating: number; comment: string; is_hidden: boolean; created_at: string };

const toReview = (row: ReviewRow): Review => ({
  id: row.id,
  restaurantId: row.restaurant_id,
  authorName: row.author_name,
  rating: row.rating,
  comment: row.comment,
  isHidden: row.is_hidden,
  createdAt: row.created_at,
});

/** Newest visible reviews of one restaurant (admins could see hidden ones too, so filter explicitly). */
export async function fetchRestaurantReviews(restaurantId: number, limit = 20): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select(REVIEW_COLUMNS)
    .eq('restaurant_id', restaurantId)
    .eq('is_hidden', false)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as ReviewRow[]).map(toReview);
}

/**
 * Rates a completed order or booking. `phone` is the number it was placed with, which lets guests
 * without an account prove it is theirs (signed-in customers are recognised by their account).
 */
export async function submitReview(reference: string, phone: string, rating: number, comment: string) {
  const { error } = await supabase.rpc('submit_review', { p_reference: reference, p_phone: phone, p_rating: rating, p_comment: comment.trim() });
  if (error) throw error;
}

/** The references among these that already have a review. Never throws: on failure, assumes none. */
export async function fetchReviewedReferences(references: string[]): Promise<Set<string>> {
  if (!references.length) return new Set();
  const { data, error } = await supabase.rpc('reviewed_references', { p_references: references });
  if (error || !data) return new Set();
  return new Set(data as string[]);
}

/** Admin console: newest reviews across all restaurants, hidden ones included. */
export async function fetchLatestReviews(limit = 50): Promise<AdminReview[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select(`${REVIEW_COLUMNS}, restaurants(name)`)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as (ReviewRow & { restaurants: { name: string } | { name: string }[] | null })[]).map((row) => {
    const restaurant = Array.isArray(row.restaurants) ? row.restaurants[0] : row.restaurants;
    return { ...toReview(row), restaurantName: restaurant?.name ?? `Restaurant #${row.restaurant_id}` };
  });
}

export async function setReviewHidden(id: string, hidden: boolean) {
  const { error } = await supabase.rpc('admin_set_review_hidden', { p_review_id: id, p_hidden: hidden });
  if (error) throw error;
}

export const stars = (rating: number) => '★★★★★'.slice(0, Math.round(rating)) + '☆☆☆☆☆'.slice(0, 5 - Math.round(rating));

export function formatReviewDate(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
