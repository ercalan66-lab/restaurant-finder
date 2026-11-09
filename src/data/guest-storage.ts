import Storage from 'expo-sqlite/kv-store';

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
};

const PROFILE_KEY = 'fork-guest-profile';
const RESERVATIONS_KEY = 'fork-reservations';
const ORDERS_KEY = 'fork-orders';

const emptyProfile: GuestProfile = { name: '', phone: '', email: '' };

async function readList<T>(key: string): Promise<T[]> {
  const value = await Storage.getItemAsync(key);
  return value ? JSON.parse(value) as T[] : [];
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
  await Storage.setItemAsync(RESERVATIONS_KEY, JSON.stringify([reservation, ...reservations]));
}

export async function saveOrder(order: OrderRecord) {
  const orders = await readList<OrderRecord>(ORDERS_KEY);
  await Storage.setItemAsync(ORDERS_KEY, JSON.stringify([order, ...orders]));
}
