// Everything here runs on the admin console's own session (adminSupabase), never the customer's.
import { adminSupabase as supabase } from '../../lib/supabase';
import { normalizeEmail } from './auth';
import type { PaymentMethod, PaymentStatus } from './guest-storage';
import { RESTAURANT_COLUMNS, toRestaurant, type RestaurantSummary } from './restaurants';
import { twoStepState } from './two-step';

/**
 * What the admin console may show. Two-step sign-in is optional for admins; an admin who turned it on
 * gets admin powers only after the code step (202611230001_admin_two_step_optional.sql).
 * denied: not signed in, or not an admin. needs-code: an admin with an authenticator who typed the
 * password but not the code yet. granted: full access.
 */
export type AdminAccess = 'denied' | 'needs-code' | 'granted';

export async function adminAccess(): Promise<AdminAccess> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return 'denied';
  const { data: listed, error } = await supabase.rpc('is_admin_account');
  if (error || listed !== true) return 'denied';
  return await twoStepState(supabase) === 'needs-code' ? 'needs-code' : 'granted';
}

/** Signs in to the admin console only. An account that is not an admin is signed straight back out. */
export async function adminSignIn(email: string, password: string): Promise<AdminAccess> {
  const { error } = await supabase.auth.signInWithPassword({ email: normalizeEmail(email), password });
  if (error) throw error;
  const access = await adminAccess();
  if (access === 'denied') {
    await adminSignOut();
    throw new Error('This account is not a Kwetu admin. Ask another admin to add it from Admins.');
  }
  return access;
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

/** Matches handle_waiting_orders() in 202611280002_admin_tools.sql. */
export const WAITING_ALERT_MINUTES = 15;
export const AUTO_CANCEL_MINUTES = 30;

/** Minutes a pending order has waited for the restaurant, or null when it is no longer waiting. */
export function minutesWaiting(order: { status: string; createdAt: string }, now = Date.now()) {
  if (order.status !== 'pending') return null;
  const placed = new Date(order.createdAt).getTime();
  return Number.isNaN(placed) ? null : Math.max(0, Math.floor((now - placed) / 60_000));
}

export type AdminOverview = {
  restaurantsWaiting: number;
  restaurantsLive: number;
  restaurantsChangesRequested: number;
  ordersToday: number;
  ordersInProgress: number;
  /** Orders still waiting for the restaurant after 15 minutes. */
  ordersWaitingLong: number;
  /** Value of orders completed in the last 7 days, in shillings. */
  salesLast7Days: number;
};

type OverviewRow = {
  restaurants_waiting: number; restaurants_live: number; restaurants_changes_requested: number;
  orders_today: number; orders_in_progress: number; orders_waiting_long?: number; sales_last_7_days: number | string;
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
    // Missing until 202611280002_admin_tools.sql has been run.
    ordersWaitingLong: data.orders_waiting_long ?? 0,
    salesLast7Days: Number(data.sales_last_7_days),
  };
}

export type AdminOrder = {
  reference: string; restaurantId: number; restaurantName: string; customerName: string; customerPhone: string; status: string; createdAt: string;
  fulfillment: 'Pickup' | 'Delivery'; total: number; paymentStatus: PaymentStatus; paymentMethod: PaymentMethod;
};

/** admin_find_requests also returns old table bookings (kind 'booking'); booking was removed, so they are skipped. */
type RequestRow = {
  kind: 'order' | 'booking'; reference: string; restaurant_id: number; restaurant_name: string; customer_name: string;
  customer_phone: string; status: string; created_at: string; fulfillment: string | null; total: number | null;
  payment_status: string | null; payment_method: string | null;
};

function toOrder(row: RequestRow): AdminOrder {
  return {
    reference: row.reference,
    restaurantId: row.restaurant_id,
    restaurantName: row.restaurant_name,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    status: row.status,
    createdAt: row.created_at,
    fulfillment: row.fulfillment as AdminOrder['fulfillment'],
    total: row.total ?? 0,
    paymentStatus: row.payment_status as PaymentStatus,
    paymentMethod: row.payment_method as PaymentMethod,
  };
}

/** Newest orders across all restaurants, optionally matching a reference, name, restaurant, or phone number. */
export async function findOrders(search = ''): Promise<AdminOrder[]> {
  const { data, error } = await supabase.rpc('admin_find_requests', { p_search: search.trim(), p_limit: 40 });
  if (error) throw error;
  return ((data ?? []) as RequestRow[]).filter((row) => row.kind === 'order').map(toOrder);
}

export type AdminOrderDetails = {
  reference: string; status: string; createdAt: string; updatedAt: string;
  restaurantId: number; restaurantName: string; restaurantPhone: string;
  customerName: string; customerPhone: string; customerEmail: string; signedIn: boolean;
  fulfillment: 'Pickup' | 'Delivery'; deliveryAddress: string;
  items: { name: string; price: string; quantity: number }[]; total: number;
  paymentStatus: PaymentStatus; paymentMethod: PaymentMethod; paidAt: string | null;
  cancelledBy: 'customer' | 'admin' | 'timeout' | null; cancelReason: string; remindedAt: string | null;
};

/** Everything about one order: dishes, delivery address, email, and how it ended. */
export async function fetchOrderDetails(reference: string): Promise<AdminOrderDetails> {
  const { data, error } = await supabase.rpc('admin_order_details', { p_reference: reference });
  if (error) throw error;
  const details = data as AdminOrderDetails;
  return { ...details, items: Array.isArray(details.items) ? details.items : [], cancelReason: details.cancelReason ?? '' };
}

/** Cancels an order that is not finished yet. The customer and the restaurant are told the reason. */
export async function cancelOrder(reference: string, reason: string) {
  const { error } = await supabase.rpc('admin_cancel_order', { p_reference: reference, p_reason: reason.trim() });
  if (error) throw error;
}

/** The account that manages a restaurant (email, or phone number), or null when it has no owner yet. */
export async function fetchRestaurantOwner(restaurantId: number): Promise<string | null> {
  const { data, error } = await supabase.rpc('admin_restaurant_owner', { p_restaurant_id: restaurantId });
  if (error) throw error;
  return typeof data === 'string' && data ? data : null;
}

/** Hands a restaurant to an existing account (email or phone number). Returns that account as shown. */
export async function assignOwner(restaurantId: number, account: string): Promise<string> {
  const { data, error } = await supabase.rpc('admin_assign_owner', { p_restaurant_id: restaurantId, p_account: account.trim() });
  if (error) throw error;
  return String(data ?? account.trim());
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
