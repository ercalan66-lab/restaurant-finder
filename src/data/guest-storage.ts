import Storage from 'expo-sqlite/kv-store';

import { supabase } from '../../lib/supabase';

export type GuestProfile = {
  name: string;
  phone: string;
  email: string;
};

export type ReservationRecord = GuestProfile & {
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

export type OrderRecord = {
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
};

export type ReservationStatus = 'pending' | 'confirmed' | 'declined' | 'completed';
export type OrderStatus = 'pending' | 'accepted' | 'preparing' | 'ready' | 'completed' | 'declined';

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

export async function saveReservation(reservation: ReservationRecord) {
  const reservations = await readList<ReservationRecord>(RESERVATIONS_KEY);
  await writeList(RESERVATIONS_KEY, [reservation, ...reservations]);
  const { error } = await supabase.from('reservations').insert({
    reference: reservation.id,
    restaurant_id: reservation.restaurantId,
    guest_name: reservation.name,
    guest_phone: reservation.phone,
    guest_email: reservation.email,
    reservation_date: reservation.date,
    reservation_time: reservation.time,
    guest_count: reservation.guests,
  });
  if (error) console.warn('Reservation cloud sync unavailable:', error.message);
}

export async function saveOrder(order: OrderRecord) {
  const orders = await readList<OrderRecord>(ORDERS_KEY);
  await writeList(ORDERS_KEY, [order, ...orders]);
  const { error } = await supabase.from('orders').insert({
    reference: order.id,
    restaurant_id: order.restaurantId,
    guest_name: order.guest.name,
    guest_phone: order.guest.phone,
    guest_email: order.guest.email,
    fulfillment: order.fulfillment,
    delivery_address: order.address,
    items: order.items,
    total: order.total,
  });
  if (error) console.warn('Order cloud sync unavailable:', error.message);
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
  return mergeById(local, remote);
}

export async function getOrders(): Promise<OrderRecord[]> {
  const local = await readList<OrderRecord>(ORDERS_KEY);
  const { data, error } = await supabase
    .from('orders')
    .select('reference, restaurant_id, guest_name, guest_phone, guest_email, fulfillment, delivery_address, items, total, status, created_at, updated_at, restaurants(name)')
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
  return mergeById(local, remote);
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
