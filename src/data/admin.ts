// Everything here runs on the admin console's own session (adminSupabase), never the customer's.
import { adminSupabase as supabase } from '../../lib/supabase';
import { normalizeEmail } from './auth';
import type { PaymentMethod, PaymentStatus } from './guest-storage';
import { RESTAURANT_COLUMNS, toRestaurant, type RestaurantSummary } from './restaurants';

/** True when the account signed in to the admin console is listed in public.admins. */
export async function checkIsAdmin() {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return false;
  const { data, error } = await supabase.rpc('is_admin');
  return !error && data === true;
}

/** Signs in to the admin console only. An account that is not an admin is signed straight back out. */
export async function adminSignIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email: normalizeEmail(email), password });
  if (error) throw error;
  if (!(await checkIsAdmin())) {
    await adminSignOut();
    throw new Error('This account is not a Kwetu admin. Ask another admin to add it from Admins.');
  }
}

/** Ends the admin session on this phone only ('local'), so the same account stays signed in elsewhere. */
export async function adminSignOut() {
  await supabase.auth.signOut({ scope: 'local' });
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

export type AdminOverview = {
  restaurantsWaiting: number;
  restaurantsLive: number;
  restaurantsChangesRequested: number;
  ordersToday: number;
  ordersInProgress: number;
  /** Pending and confirmed tables booked for today. */
  tablesToday: number;
  /** Value of orders completed in the last 7 days, in shillings. */
  salesLast7Days: number;
};

type OverviewRow = {
  restaurants_waiting: number; restaurants_live: number; restaurants_changes_requested: number;
  orders_today: number; orders_in_progress: number; tables_today: number; sales_last_7_days: number | string;
};

export async function fetchOverview(): Promise<AdminOverview> {
  const { data, error } = await supabase.rpc('admin_overview').single<OverviewRow>();
  if (error) throw error;
  return {
    restaurantsWaiting: data.restaurants_waiting,
    restaurantsLive: data.restaurants_live,
    restaurantsChangesRequested: data.restaurants_changes_requested,
    ordersToday: data.orders_today,
    ordersInProgress: data.orders_in_progress,
    tablesToday: data.tables_today,
    salesLast7Days: Number(data.sales_last_7_days),
  };
}

type RequestBase = { reference: string; restaurantId: number; restaurantName: string; customerName: string; customerPhone: string; status: string; createdAt: string };
export type AdminOrder = RequestBase & { kind: 'order'; fulfillment: 'Pickup' | 'Delivery'; total: number; paymentStatus: PaymentStatus; paymentMethod: PaymentMethod };
export type AdminBooking = RequestBase & { kind: 'booking'; date: string; time: string; guests: number };
export type AdminRequest = AdminOrder | AdminBooking;

type RequestRow = {
  kind: 'order' | 'booking'; reference: string; restaurant_id: number; restaurant_name: string; customer_name: string;
  customer_phone: string; status: string; created_at: string; fulfillment: string | null; total: number | null;
  payment_status: string | null; payment_method: string | null; booking_date: string | null; booking_time: string | null; guest_count: number | null;
};

function toRequest(row: RequestRow): AdminRequest {
  const base: RequestBase = {
    reference: row.reference,
    restaurantId: row.restaurant_id,
    restaurantName: row.restaurant_name,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    status: row.status,
    createdAt: row.created_at,
  };
  if (row.kind === 'booking') {
    return { ...base, kind: 'booking', date: row.booking_date ?? '', time: (row.booking_time ?? '').slice(0, 5), guests: row.guest_count ?? 0 };
  }
  return {
    ...base,
    kind: 'order',
    fulfillment: row.fulfillment as AdminOrder['fulfillment'],
    total: row.total ?? 0,
    paymentStatus: row.payment_status as PaymentStatus,
    paymentMethod: row.payment_method as PaymentMethod,
  };
}

/** Newest orders and bookings across all restaurants, optionally matching a reference, name, restaurant, or phone number. */
export async function findRequests(search = ''): Promise<AdminRequest[]> {
  const { data, error } = await supabase.rpc('admin_find_requests', { p_search: search.trim(), p_limit: 40 });
  if (error) throw error;
  return ((data ?? []) as RequestRow[]).map(toRequest);
}

export type AdminMember = { userId: string; account: string; addedAt: string; isMe: boolean };

export async function fetchAdmins(): Promise<AdminMember[]> {
  const { data, error } = await supabase.rpc('admin_list_admins');
  if (error) throw error;
  return ((data ?? []) as { user_id: string; account: string; added_at: string; is_me: boolean }[])
    .map((row) => ({ userId: row.user_id, account: row.account, addedAt: row.added_at, isMe: row.is_me }));
}

/** Makes the account that signs in with this email or phone number an admin. Returns how that account is shown. */
export async function addAdmin(account: string): Promise<string> {
  const { data, error } = await supabase.rpc('admin_add_admin', { p_account: account.trim() });
  if (error) throw error;
  return String(data);
}

export async function removeAdmin(userId: string) {
  const { error } = await supabase.rpc('admin_remove_admin', { p_user_id: userId });
  if (error) throw error;
}
