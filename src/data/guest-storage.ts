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
};

export type ReservationRecord = GuestProfile & SyncState & {
  id: string;
  restaurantId: number;
  restaurantName: string;
  date: string;
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
  paidAt?: string | null;
};

export type ReservationStatus = 'pending' | 'confirmed' | 'declined' | 'completed';
export type OrderStatus = 'pending' | 'accepted' | 'preparing' | 'ready' | 'completed' | 'declined';
export type PaymentMethod = 'cash';
export type PaymentStatus = 'unpaid' | 'paid';

export function describePayment(method: PaymentMethod | undefined, fulfillment: OrderRecord['fulfillment']) {
  switch (method ?? 'cash') {
    case 'cash': return fulfillment === 'Delivery' ? 'Cash on delivery' : 'Cash on pickup';
  }
}

const PROFILE_KEY = 'fork-guest-profile';
const RESERVATIONS_KEY = 'fork-reservations';
const ORDERS_KEY = 'fork-orders';

const emptyProfile: GuestProfile = { name: '', phone: '', email: '' };

async function readList<T>(key: string): Promise<T[]> {
  const value = await Storage.getItemAsync(key);
  return value ? JSON.parse(value) as T[] : [];
}

async function writeList<T>(key: string, records: T[]) {
  await Storage.setItemAsync(key, JSON.stringify(records));
}

function mergeById<T extends { id: string }>(local: T[], remote: T[]) {
  const records = new Map(local.map((record) => [record.id, record]));
  remote.forEach((record) => records.set(record.id, record));
  return [...records.values()].sort((a, b) => {
    const first = 'createdAt' in a ? String(a.createdAt) : '';
    const second = 'createdAt' in b ? String(b.createdAt) : '';
    return second.localeCompare(first);
  });
}

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
  payment_method: order.paymentMethod ?? 'cash',
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

/** Sends one request. A duplicate-reference error means an earlier attempt already arrived, which counts as sent. */
async function sendToSupabase(table: 'orders' | 'reservations', row: Record<string, unknown>) {
  try {
    const { error } = await supabase.from(table).insert(row);
    if (!error || error.code === '23505') return true;
    console.warn(`Could not send ${table} ${String(row.reference)}:`, error.message);
  } catch (error) {
    console.warn(`Could not send ${table} ${String(row.reference)}:`, error instanceof Error ? error.message : error);
  }
  return false;
}

async function markSynced(key: string, ids: Set<string>) {
  if (!ids.size) return;
  const latest = await readList<SyncState & { id: string }>(key);
  await writeList(key, latest.map((record) => ids.has(record.id) ? { ...record, synced: true } : record));
}

/** Saves the booking on this phone, then sends it. Resolves to true when the restaurant has received it. */
export async function saveReservation(reservation: ReservationRecord) {
  const record: ReservationRecord = { ...reservation, customerId: await currentUserId(), synced: false };
  await writeList(RESERVATIONS_KEY, [record, ...await readList<ReservationRecord>(RESERVATIONS_KEY)]);
  const sent = await sendToSupabase('reservations', reservationRow(record));
  if (sent) await markSynced(RESERVATIONS_KEY, new Set([record.id]));
  return sent;
}

/** Saves the order on this phone, then sends it. Resolves to true when the restaurant has received it. */
export async function saveOrder(order: OrderRecord) {
  const record: OrderRecord = { ...order, customerId: await currentUserId(), synced: false };
  await writeList(ORDERS_KEY, [record, ...await readList<OrderRecord>(ORDERS_KEY)]);
  const sent = await sendToSupabase('orders', orderRow(record));
  if (sent) await markSynced(ORDERS_KEY, new Set([record.id]));
  return sent;
}

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
      const sentOrders = new Set<string>();
      for (const order of (await readList<OrderRecord>(ORDERS_KEY)).filter(canSend)) {
        if (await sendToSupabase('orders', orderRow(order))) sentOrders.add(order.id);
      }
      await markSynced(ORDERS_KEY, sentOrders);
      const sentReservations = new Set<string>();
      for (const reservation of (await readList<ReservationRecord>(RESERVATIONS_KEY)).filter(canSend)) {
        if (await sendToSupabase('reservations', reservationRow(reservation))) sentReservations.add(reservation.id);
      }
      await markSynced(RESERVATIONS_KEY, sentReservations);
    } finally {
      syncInFlight = null;
    }
  })();
  return syncInFlight;
}

export async function getReservations(): Promise<ReservationRecord[]> {
  const local = await readList<ReservationRecord>(RESERVATIONS_KEY);
  const { data, error } = await supabase
    .from('reservations')
    .select('reference, restaurant_id, guest_name, guest_phone, guest_email, reservation_date, reservation_time, guest_count, status, created_at, updated_at, restaurants(name)')
    .order('created_at', { ascending: false });
  if (error || !data) return local;
  const remote = data.map((row) => ({
    id: row.reference,
    restaurantId: row.restaurant_id,
    restaurantName: relationName(row.restaurants),
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
    .select('reference, restaurant_id, guest_name, guest_phone, guest_email, fulfillment, delivery_address, items, total, status, payment_method, payment_status, paid_at, created_at, updated_at, restaurants(name)')
    .order('created_at', { ascending: false });
  if (error || !data) return local;
  const remote = data.map((row) => ({
    id: row.reference,
    restaurantId: row.restaurant_id,
    restaurantName: relationName(row.restaurants),
    guest: { name: row.guest_name, phone: row.guest_phone, email: row.guest_email },
    fulfillment: row.fulfillment as OrderRecord['fulfillment'],
    address: row.delivery_address,
    items: row.items as OrderRecord['items'],
    total: row.total,
    status: row.status as OrderStatus,
    synced: true,
    paymentMethod: row.payment_method as PaymentMethod,
    paymentStatus: row.payment_status as PaymentStatus,
    paidAt: row.paid_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
  return mergeById(local, remote);
}

export async function updateOrderPayment(id: string, paymentStatus: PaymentStatus) {
  const orders = await getOrders();
  const now = new Date().toISOString();
  await writeList(ORDERS_KEY, orders.map((order) =>
    order.id === id ? { ...order, paymentStatus, paidAt: paymentStatus === 'paid' ? now : null, updatedAt: now } : order,
  ));
  // paid_at is set by a database trigger, so only the status is sent.
  const { error } = await supabase.from('orders').update({ payment_status: paymentStatus }).eq('reference', id);
  if (error) console.warn('Order payment cloud sync unavailable:', error.message);
}

export async function updateReservationStatus(id: string, status: ReservationStatus) {
  const reservations = await getReservations();
  await writeList(RESERVATIONS_KEY, reservations.map((reservation) =>
    reservation.id === id ? { ...reservation, status, updatedAt: new Date().toISOString() } : reservation,
  ));
  const { error } = await supabase.from('reservations').update({ status }).eq('reference', id);
  if (error) console.warn('Reservation status cloud sync unavailable:', error.message);
}

export async function updateOrderStatus(id: string, status: OrderStatus) {
  const orders = await getOrders();
  await writeList(ORDERS_KEY, orders.map((order) =>
    order.id === id ? { ...order, status, updatedAt: new Date().toISOString() } : order,
  ));
  const { error } = await supabase.from('orders').update({ status }).eq('reference', id);
  if (error) console.warn('Order status cloud sync unavailable:', error.message);
}

function relationName(value: { name: string } | { name: string }[] | null) {
  if (Array.isArray(value)) return value[0]?.name ?? '';
  return value?.name ?? '';
}
