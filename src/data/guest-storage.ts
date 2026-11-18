import Storage from 'expo-sqlite/kv-store';

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
  /** Set when the database refused the request for good, for example because the time slot filled up. */
  rejectedReason?: string;
};

export type ReservationStatus = 'pending' | 'confirmed' | 'declined' | 'completed' | 'cancelled';
export type OrderStatus = 'pending' | 'accepted' | 'preparing' | 'ready' | 'delivered' | 'completed' | 'declined' | 'cancelled';
export type PaymentMethod = 'cash' | 'mpesa' | 'tigo_pesa' | 'airtel_money';
export type MobileMoneyMethod = Exclude<PaymentMethod, 'cash'>;
export type PaymentStatus = 'unpaid' | 'paid';

export type ReservationRecord = GuestProfile & SyncState & {
  id: string;
  restaurantId: number;
  restaurantName: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM (older records may hold "7:00 PM") */
  time: string;
  guests: number;
  createdAt: string;
  status?: ReservationStatus;
  updatedAt?: string;
};

export type OrderRecord = SyncState & {
  id: string;
  restaurantId: number;
  restaurantName: string;
  guest: GuestProfile;
  fulfillment: 'Pickup' | 'Delivery';
  address: string;
  items: { name: string; price: string; quantity: number }[];
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

export const MOBILE_MONEY: { method: MobileMoneyMethod; label: string }[] = [
  { method: 'mpesa', label: 'M-Pesa' },
  { method: 'tigo_pesa', label: 'Tigo Pesa' },
  { method: 'airtel_money', label: 'Airtel Money' },
];
export const paymentMethodLabel = (method: PaymentMethod | undefined) => MOBILE_MONEY.find((option) => option.method === method)?.label ?? 'Cash';

/** Pickup orders are paid at the counter; delivery orders after the food arrives (mobile money in the app, or cash to the rider). */
export function paymentSummary(order: Pick<OrderRecord, 'fulfillment' | 'paymentStatus' | 'paymentMethod'>) {
  if (order.paymentStatus === 'paid') return `Paid · ${paymentMethodLabel(order.paymentMethod)}`;
  return order.fulfillment === 'Delivery' ? 'Pay on delivery' : 'Pay at the restaurant';
}

export const canPayInApp = (order: OrderRecord) => order.fulfillment === 'Delivery' && order.status === 'delivered' && order.paymentStatus !== 'paid';
export const canCancelOrder = (order: OrderRecord) => (order.status ?? 'pending') === 'pending' && !order.rejectedReason;
export const canCancelReservation = (reservation: ReservationRecord) => ['pending', 'confirmed'].includes(reservation.status ?? 'pending') && !reservation.rejectedReason;

const PROFILE_KEY = 'fork-guest-profile';
const RESERVATIONS_KEY = 'fork-reservations';
const ORDERS_KEY = 'fork-orders';
export const SAVED_RESTAURANTS_KEY = 'fork-saved-restaurants';

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
    throw new Error('The saved profile could not be verified.');
  }
  return saved;
}

/** Removes everything this app stored on the phone (used after deleting an account). */
export async function clearLocalData() {
  await Promise.all([PROFILE_KEY, ORDERS_KEY, RESERVATIONS_KEY, SAVED_RESTAURANTS_KEY].map((key) => Storage.removeItemAsync(key)));
}

const reservationRow = (reservation: ReservationRecord) => ({
  reference: reservation.id,
  restaurant_id: reservation.restaurantId,
  customer_id: reservation.customerId ?? null,
  guest_name: reservation.name,
  guest_phone: reservation.phone,
  guest_email: reservation.email,
  reservation_date: reservation.date,
  reservation_time: reservation.time,
  guest_count: reservation.guests,
  ...(reservation.pushToken ? { push_token: reservation.pushToken } : {}),
});

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
  // Only sent when there is one, so phones without push keep working against older databases.
  ...(order.pushToken ? { push_token: order.pushToken } : {}),
});

/**
 * Customer-facing reference such as "FO-7K2M9QX4". Eight random base-36 characters keep collisions between
 * customers negligible, which matters because a duplicate reference is treated as "already sent".
 */
export function newReference(prefix: 'FO' | 'FR') {
  const random = `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random.slice(0, 8).toUpperCase()}`;
}

async function currentUserId() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

type SendResult = 'sent' | 'retry' | { rejected: string };

/** Database errors that will never succeed on a retry, with the message to show (null = use the database's own). */
const PERMANENT_ERRORS: Record<string, string | null> = {
  FB001: null, // time slot full
  FB002: null, // date already passed
  '42501': 'This restaurant is not taking requests right now.',
  '23503': 'This restaurant no longer exists.',
  '23514': null,
  '22P02': null,
};

/** Sends one request. A duplicate-reference error means an earlier attempt already arrived, which counts as sent. */
async function sendToSupabase(table: 'orders' | 'reservations', row: Record<string, unknown>): Promise<SendResult> {
  try {
    const { error } = await supabase.from(table).insert(row);
    if (!error || error.code === '23505') return 'sent';
    if (error.code && error.code in PERMANENT_ERRORS) return { rejected: PERMANENT_ERRORS[error.code] ?? error.message };
    console.warn(`Could not send ${table} ${String(row.reference)}:`, error.message);
  } catch (error) {
    console.warn(`Could not send ${table} ${String(row.reference)}:`, error instanceof Error ? error.message : error);
  }
  return 'retry';
}

/** sent: the restaurant has it. queued: saved here, sent automatically later. rejected: refused for good (not saved). */
export type SaveResult = { outcome: 'sent' } | { outcome: 'queued' } | { outcome: 'rejected'; reason: string };

async function saveAndSend<T extends SyncState & { id: string }>(key: string, table: 'orders' | 'reservations', request: T, toRow: (record: T) => Record<string, unknown>): Promise<SaveResult> {
  const record: T = { ...request, customerId: await currentUserId(), synced: false, placedHere: true };
  await writeList(key, [record, ...await readList<T>(key)]);
  const result = await sendToSupabase(table, toRow(record));
  if (result === 'sent') {
    await patchLocal<T>(key, record.id, { synced: true } as Partial<T>);
    return { outcome: 'sent' };
  }
  if (result === 'retry') return { outcome: 'queued' };
  // Refused while the customer is still on the screen: drop it so they can fix it and try again.
  await removeLocal(key, record.id);
  return { outcome: 'rejected', reason: result.rejected };
}

export const saveReservation = (reservation: ReservationRecord) => saveAndSend(RESERVATIONS_KEY, 'reservations', reservation, reservationRow);
export const saveOrder = (order: OrderRecord) => saveAndSend(ORDERS_KEY, 'orders', order, orderRow);

let syncInFlight: Promise<void> | null = null;

/**
 * Resends orders and bookings that have not reached Supabase yet. Requests placed by another
 * account wait until that account signs in again. Safe to call often; concurrent calls share one run.
 */
export function syncPendingRequests() {
  syncInFlight ??= (async () => {
    try {
      const userId = await currentUserId();
      const canSend = (record: SyncState) => record.synced !== true && (!record.customerId || record.customerId === userId);
      const resend = async <T extends SyncState & { id: string }>(key: string, table: 'orders' | 'reservations', toRow: (record: T) => Record<string, unknown>) => {
        for (const record of (await readList<T>(key)).filter(canSend)) {
          const result = await sendToSupabase(table, toRow(record));
          if (result === 'sent') await patchLocal<T>(key, record.id, { synced: true } as Partial<T>);
          // 'declined' is a valid status for both orders and bookings, so this patch fits either record type.
          else if (result !== 'retry') await patchLocal<T>(key, record.id, { synced: true, status: 'declined', rejectedReason: result.rejected } as unknown as Partial<T>);
        }
      };
      await resend<OrderRecord>(ORDERS_KEY, 'orders', orderRow);
      await resend<ReservationRecord>(RESERVATIONS_KEY, 'reservations', reservationRow);
    } finally {
      syncInFlight = null;
    }
  })();
  return syncInFlight;
}

type StatusRow = { reference: string; status: string; payment_status: string | null; payment_method: string | null; payment_reference: string | null };

/**
 * Fetches the latest status of this phone's open requests. Works for guests too, who cannot read
 * orders directly. Resolves to true when anything changed.
 */
export async function refreshRequestStatuses() {
  const open = (record: SyncState & { id: string; status?: string }) => isPlacedHere(record) && record.synced !== false && !FINAL_STATUSES.has(record.status ?? 'pending');
  const references = [...await readList<OrderRecord>(ORDERS_KEY), ...await readList<ReservationRecord>(RESERVATIONS_KEY)].filter(open).map((record) => record.id);
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

  const reservations = (await readList<ReservationRecord>(RESERVATIONS_KEY)).map((reservation) => {
    const row = rows.get(reservation.id);
    if (!row || row.status === reservation.status) return reservation;
    changed = true;
    return { ...reservation, status: row.status as ReservationStatus };
  });
  await writeList(RESERVATIONS_KEY, reservations);
  return changed;
}

export async function getReservations(): Promise<ReservationRecord[]> {
  const local = await readList<ReservationRecord>(RESERVATIONS_KEY);
  const { data, error } = await supabase
    .from('reservations')
    .select('reference, restaurant_id, customer_id, guest_name, guest_phone, guest_email, reservation_date, reservation_time, guest_count, status, created_at, updated_at, restaurants(name)')
    .order('created_at', { ascending: false });
  if (error || !data) return local;
  const remote = data.map((row) => ({
    id: row.reference,
    restaurantId: row.restaurant_id,
    restaurantName: relationName(row.restaurants),
    customerId: row.customer_id,
    name: row.guest_name,
    phone: row.guest_phone,
    email: row.guest_email,
    date: row.reservation_date,
    time: String(row.reservation_time).slice(0, 5),
    guests: row.guest_count,
    status: row.status as ReservationStatus,
    synced: true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
  return mergeById(local, remote);
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
export const getMyReservations = async () => mine(await getReservations());

/** Customer cancels a pending order. Not-yet-sent orders are simply never sent. */
export async function cancelOrder(order: OrderRecord) {
  if (order.synced !== false) {
    const { error } = await supabase.rpc('cancel_request', { p_reference: order.id, p_phone: order.guest.phone });
    if (error) throw error;
  }
  await patchLocal<OrderRecord>(ORDERS_KEY, order.id, { status: 'cancelled', synced: true });
}

/** Customer cancels a pending or confirmed booking. */
export async function cancelReservation(reservation: ReservationRecord) {
  if (reservation.synced !== false) {
    const { error } = await supabase.rpc('cancel_request', { p_reference: reservation.id, p_phone: reservation.phone });
    if (error) throw error;
  }
  await patchLocal<ReservationRecord>(RESERVATIONS_KEY, reservation.id, { status: 'cancelled', synced: true });
}

/** Customer pays a delivered delivery order by mobile money (simulated in the database for now). */
export async function payOrder(order: OrderRecord, method: MobileMoneyMethod) {
  const { data, error } = await supabase.rpc('pay_order', { p_reference: order.id, p_phone: order.guest.phone, p_method: method });
  if (error) throw error;
  const paymentReference = typeof data === 'string' ? data : null;
  await patchLocal<OrderRecord>(ORDERS_KEY, order.id, { paymentStatus: 'paid', paymentMethod: method, paymentReference, status: 'completed', paidAt: new Date().toISOString() });
  return paymentReference;
}

/** Owner records cash handed to the rider for a delivered order, which completes it. */
export async function recordCashPayment(id: string) {
  const { error } = await supabase.from('orders').update({ payment_method: 'cash', payment_status: 'paid', status: 'completed' }).eq('reference', id);
  if (error) throw error;
  await patchLocal<OrderRecord>(ORDERS_KEY, id, { paymentMethod: 'cash', paymentStatus: 'paid', status: 'completed', paidAt: new Date().toISOString() });
}

export async function updateReservationStatus(id: string, status: ReservationStatus) {
  const { error } = await supabase.from('reservations').update({ status }).eq('reference', id);
  if (error) throw error;
  await patchLocal<ReservationRecord>(RESERVATIONS_KEY, id, { status });
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
