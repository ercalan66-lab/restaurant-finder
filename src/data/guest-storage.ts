import { currentLanguage, t, type MessageKey } from '@/i18n';
import Storage from '@/utils/kv-store';

import { supabase } from '../../lib/supabase';

export type GuestProfile = {
  name: string;
  phone: string;
  email: string;
};

/** Delivery bookkeeping for requests created on this phone. */
type SyncState = {
  /** Account that placed the request, or null for a guest. Retries never attribute it to someone else. */
  customerId?: string | null;
  /** false until Supabase has accepted the request; undefined on records saved before tracking existed. */
  synced?: boolean;
  /** Expo push token of the phone that placed it, so the customer hears about status changes even as a guest. */
  pushToken?: string | null;
  /** True for requests placed on this phone, as opposed to ones an owner loaded from the server. */
  placedHere?: boolean;
  /** Set when the database refused the order for good, for example because a dish sold out. */
  rejectedReason?: string;
};

export type OrderStatus = 'pending' | 'accepted' | 'preparing' | 'ready' | 'delivered' | 'completed' | 'declined' | 'cancelled';
/** Kwetu is cash only. The other values exist in the database from the old simulated mobile money. */
export type PaymentMethod = 'cash' | 'mpesa' | 'tigo_pesa' | 'airtel_money';
export type PaymentStatus = 'unpaid' | 'paid';

export type OrderRecord = SyncState & {
  id: string;
  restaurantId: number;
  restaurantName: string;
  guest: GuestProfile;
  fulfillment: 'Pickup' | 'Delivery';
  address: string;
  /** `id` is the menu item; the database looks up the real name and price from it (orders saved before it have none). */
  items: { id?: string; name: string; price: string; quantity: number }[];
  total: number;
  createdAt: string;
  status?: OrderStatus;
  updatedAt?: string;
  // Optional because orders saved before payment tracking have no payment fields.
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
  paymentReference?: string | null;
  paidAt?: string | null;
};

/** "Pickup" / "Delivery" in the current language (the stored value stays in English). */
export const fulfillmentLabel = (fulfillment: OrderRecord['fulfillment']) => t(fulfillment === 'Delivery' ? 'fulfillment.Delivery' : 'fulfillment.Pickup');

/** Cash only: pickup orders are paid at the counter, delivery orders to the rider when the food arrives. */
export function paymentSummary(order: Pick<OrderRecord, 'fulfillment' | 'paymentStatus'>) {
  if (order.paymentStatus === 'paid') return t('payment.paidCash');
  return t(order.fulfillment === 'Delivery' ? 'payment.onDelivery' : 'payment.atRestaurant');
}

export const canCancelOrder = (order: OrderRecord) => (order.status ?? 'pending') === 'pending' && !order.rejectedReason;

const PROFILE_KEY = 'fork-guest-profile';
/** Table bookings saved by older versions (booking was removed). Only ever cleared. */
const OLD_BOOKINGS_KEY = 'fork-reservations';
const ORDERS_KEY = 'fork-orders';
export const SAVED_RESTAURANTS_KEY = 'fork-saved-restaurants';
export const SAVED_DISHES_KEY = 'kwetu-saved-dishes';

const emptyProfile: GuestProfile = { name: '', phone: '', email: '' };
const FINAL_STATUSES = new Set(['completed', 'declined', 'cancelled']);

async function readList<T>(key: string): Promise<T[]> {
  const value = await Storage.getItemAsync(key);
  return value ? JSON.parse(value) as T[] : [];
}

async function writeList<T>(key: string, records: T[]) {
  await Storage.setItemAsync(key, JSON.stringify(records));
}

/** Updates a request stored on this phone. Records that are not stored here are left alone. */
async function patchLocal<T extends { id: string }>(key: string, id: string, changes: Partial<T>) {
  const records = await readList<T>(key);
  if (!records.some((record) => record.id === id)) return;
  await writeList(key, records.map((record) => record.id === id ? { ...record, ...changes, updatedAt: new Date().toISOString() } : record));
}

async function removeLocal(key: string, id: string) {
  await writeList(key, (await readList<{ id: string }>(key)).filter((record) => record.id !== id));
}

/** Server rows win field by field, so local-only flags such as placedHere survive. */
function mergeById<T extends { id: string; createdAt?: string }>(local: T[], remote: T[]) {
  const records = new Map(local.map((record) => [record.id, record]));
  remote.forEach((record) => records.set(record.id, { ...records.get(record.id), ...record }));
  return [...records.values()].sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
}

/** Requests saved before placedHere existed and never sent from the server are also this phone's own. */
const isPlacedHere = (record: SyncState) => record.placedHere === true || (record.synced === undefined && !('customerId' in record));

export async function getGuestProfile(): Promise<GuestProfile> {
  const value = await Storage.getItemAsync(PROFILE_KEY);
  return value ? { ...emptyProfile, ...JSON.parse(value) as GuestProfile } : emptyProfile;
}

export async function saveGuestProfile(profile: GuestProfile): Promise<GuestProfile> {
  await Storage.setItemAsync(PROFILE_KEY, JSON.stringify(profile));
  const saved = await getGuestProfile();
  if (saved.name !== profile.name || saved.phone !== profile.phone || saved.email !== profile.email) {
    throw new Error(t('profile.notVerified'));
  }
  return saved;
}

/** Removes everything this app stored on the phone (used after deleting an account). */
export async function clearLocalData() {
  await Promise.all([PROFILE_KEY, ORDERS_KEY, OLD_BOOKINGS_KEY, SAVED_RESTAURANTS_KEY, SAVED_DISHES_KEY].map((key) => Storage.removeItemAsync(key)));
}

const orderRow = (order: OrderRecord) => ({
  reference: order.id,
  restaurant_id: order.restaurantId,
  customer_id: order.customerId ?? null,
  guest_name: order.guest.name,
  guest_phone: order.guest.phone,
  guest_email: order.guest.email,
  fulfillment: order.fulfillment,
  delivery_address: order.address,
  items: order.items,
  total: order.total,
  payment_method: 'cash',
  // The language for the customer's order texts (SMS).
  language: currentLanguage(),
  // Only sent when there is one, so phones without push keep working against older databases.
  ...(order.pushToken ? { push_token: order.pushToken } : {}),
});

/**
 * Customer-facing reference such as "KO-7K2M9QX4" (KO = Kwetu order; orders made before the rename keep
 * their FO- codes). Eight random base-36 characters keep collisions between customers negligible, which
 * matters because a duplicate reference is treated as "already sent".
 */
export function newReference(prefix: 'KO') {
  const random = `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random.slice(0, 8).toUpperCase()}`;
}

async function currentUserId() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

type SendResult = 'sent' | 'retry' | { rejected: string };

/** Database errors that will never succeed on a retry, with the message to show (null = use the database's own). */
const PERMANENT_ERRORS: Record<string, MessageKey | null> = {
  FB010: 'request.checkDetails', // details too long or missing (202611210002_request_safety.sql)
  FB011: 'request.menuChanged', // a dish was removed or sold out
  FB012: 'request.tooMany', // too many orders waiting from this phone number
  '42501': 'request.notTaking',
  '23503': 'request.noRestaurant',
  '23514': null,
  '22P02': null,
};

/** Sends one order. A duplicate-reference error means an earlier attempt already arrived, which counts as sent. */
async function sendOrder(row: Record<string, unknown>): Promise<SendResult> {
  try {
    let { error } = await supabase.from('orders').insert(row);
    // A database without the order-texts column (202611280003_order_sms.sql) still takes the order.
    if (error?.code === 'PGRST204' && /language/.test(error.message)) {
      const { language: _language, ...withoutLanguage } = row;
      ({ error } = await supabase.from('orders').insert(withoutLanguage));
    }
    if (!error || error.code === '23505') return 'sent';
    if (error.code && error.code in PERMANENT_ERRORS) {
      const known = PERMANENT_ERRORS[error.code];
      return { rejected: known ? t(known) : error.message };
    }
    console.warn(`Could not send order ${String(row.reference)}:`, error.message);
  } catch (error) {
    console.warn(`Could not send order ${String(row.reference)}:`, error instanceof Error ? error.message : error);
  }
  return 'retry';
}

/** sent: the restaurant has it. queued: saved here, sent automatically later. rejected: refused for good (not saved). */
export type SaveResult = { outcome: 'sent' } | { outcome: 'queued' } | { outcome: 'rejected'; reason: string };

export async function saveOrder(order: OrderRecord): Promise<SaveResult> {
  const record: OrderRecord = { ...order, customerId: await currentUserId(), synced: false, placedHere: true };
  await writeList(ORDERS_KEY, [record, ...await readList<OrderRecord>(ORDERS_KEY)]);
  const result = await sendOrder(orderRow(record));
  if (result === 'sent') {
    await patchLocal<OrderRecord>(ORDERS_KEY, record.id, { synced: true });
    return { outcome: 'sent' };
  }
  if (result === 'retry') return { outcome: 'queued' };
  // Refused while the customer is still on the screen: drop it so they can fix it and try again.
  await removeLocal(ORDERS_KEY, record.id);
  return { outcome: 'rejected', reason: result.rejected };
}

let syncInFlight: Promise<void> | null = null;

/**
 * Resends orders that have not reached Supabase yet. Orders placed by another account wait until
 * that account signs in again. Safe to call often; concurrent calls share one run.
 */
export function syncPendingRequests() {
  syncInFlight ??= (async () => {
    try {
      const userId = await currentUserId();
      const canSend = (record: SyncState) => record.synced !== true && (!record.customerId || record.customerId === userId);
      for (const order of (await readList<OrderRecord>(ORDERS_KEY)).filter(canSend)) {
        const result = await sendOrder(orderRow(order));
        if (result === 'sent') await patchLocal<OrderRecord>(ORDERS_KEY, order.id, { synced: true });
        else if (result !== 'retry') await patchLocal<OrderRecord>(ORDERS_KEY, order.id, { synced: true, status: 'declined', rejectedReason: result.rejected });
      }
    } finally {
      syncInFlight = null;
    }
  })();
  return syncInFlight;
}

type StatusRow = { reference: string; status: string; payment_status: string | null; payment_method: string | null; payment_reference: string | null };

/**
 * Fetches the latest status of this phone's open orders. Works for guests too, who cannot read
 * orders directly. Resolves to true when anything changed.
 */
export async function refreshRequestStatuses() {
  const open = (record: OrderRecord) => isPlacedHere(record) && record.synced !== false && !FINAL_STATUSES.has(record.status ?? 'pending');
  const references = (await readList<OrderRecord>(ORDERS_KEY)).filter(open).map((record) => record.id);
  if (!references.length) return false;
  const { data, error } = await supabase.rpc('request_statuses', { p_references: references });
  if (error || !Array.isArray(data)) return false;
  const rows = new Map((data as StatusRow[]).map((row) => [row.reference, row]));
  let changed = false;

  const orders = (await readList<OrderRecord>(ORDERS_KEY)).map((order) => {
    const row = rows.get(order.id);
    if (!row) return order;
    const next: OrderRecord = {
      ...order,
      status: row.status as OrderStatus,
      paymentStatus: (row.payment_status as PaymentStatus | null) ?? order.paymentStatus,
      paymentMethod: (row.payment_method as PaymentMethod | null) ?? order.paymentMethod,
      paymentReference: row.payment_reference ?? order.paymentReference,
    };
    changed ||= next.status !== order.status || next.paymentStatus !== order.paymentStatus;
    return next;
  });
  await writeList(ORDERS_KEY, orders);
  return changed;
}

export async function getOrders(): Promise<OrderRecord[]> {
  const local = await readList<OrderRecord>(ORDERS_KEY);
  const { data, error } = await supabase
    .from('orders')
    .select('reference, restaurant_id, customer_id, guest_name, guest_phone, guest_email, fulfillment, delivery_address, items, total, status, payment_method, payment_status, payment_reference, paid_at, created_at, updated_at, restaurants(name)')
    .order('created_at', { ascending: false });
  if (error || !data) return local;
  const remote = data.map((row) => ({
    id: row.reference,
    restaurantId: row.restaurant_id,
    restaurantName: relationName(row.restaurants),
    customerId: row.customer_id,
    guest: { name: row.guest_name, phone: row.guest_phone, email: row.guest_email },
    fulfillment: row.fulfillment as OrderRecord['fulfillment'],
    address: row.delivery_address,
    items: row.items as OrderRecord['items'],
    total: row.total,
    status: row.status as OrderStatus,
    synced: true,
    paymentMethod: row.payment_method as PaymentMethod,
    paymentStatus: row.payment_status as PaymentStatus,
    paymentReference: row.payment_reference,
    paidAt: row.paid_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
  return mergeById(local, remote);
}

/** The signed-in person's own requests: placed on this phone, or placed with their account elsewhere. */
async function mine<T extends SyncState>(records: T[]) {
  const userId = await currentUserId();
  return records.filter((record) => isPlacedHere(record) || (userId !== null && record.customerId === userId));
}
export const getMyOrders = async () => mine(await getOrders());

/** Customer cancels a pending order. Not-yet-sent orders are simply never sent. */
export async function cancelOrder(order: OrderRecord) {
  if (order.synced !== false) {
    const { error } = await supabase.rpc('cancel_request', { p_reference: order.id, p_phone: order.guest.phone });
    if (error) throw error;
  }
  await patchLocal<OrderRecord>(ORDERS_KEY, order.id, { status: 'cancelled', synced: true });
}

/** Owner confirms the customer has the food and paid in cash (at the counter or to the rider), which completes the order. */
export async function recordCashPayment(id: string) {
  const { error } = await supabase.from('orders').update({ payment_method: 'cash', payment_status: 'paid', status: 'completed' }).eq('reference', id);
  if (error) throw error;
  await patchLocal<OrderRecord>(ORDERS_KEY, id, { paymentMethod: 'cash', paymentStatus: 'paid', status: 'completed', paidAt: new Date().toISOString() });
}

export async function updateOrderStatus(id: string, status: OrderStatus) {
  const { error } = await supabase.from('orders').update({ status }).eq('reference', id);
  if (error) throw error;
  await patchLocal<OrderRecord>(ORDERS_KEY, id, { status });
}

function relationName(value: { name: string } | { name: string }[] | null) {
  if (Array.isArray(value)) return value[0]?.name ?? '';
  return value?.name ?? '';
}
