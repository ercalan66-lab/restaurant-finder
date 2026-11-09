import Storage from 'expo-sqlite/kv-store';

export type OwnerMenuItem = {
  id: string;
  name: string;
  ingredients: string;
  price: number;
  availableFrom: string;
  availableUntil: string;
  inStock: boolean;
};

export type OwnerRestaurant = {
  name: string;
  address: string;
  mapUrl: string;
  opensAt: string;
  closesAt: string;
  facilities: string[];
  menu: OwnerMenuItem[];
};

const OWNER_RESTAURANT_KEY = 'fork-owner-restaurant-v1';

export const defaultOwnerRestaurant: OwnerRestaurant = {
  name: 'The Baobab Table',
  address: 'Haile Selassie Road, Masaki',
  mapUrl: '',
  opensAt: '08:00',
  closesAt: '22:00',
  facilities: ['Wi-Fi', 'Parking', 'Playing ground'],
  menu: [],
};

export async function getOwnerRestaurant(): Promise<OwnerRestaurant> {
  const value = await Storage.getItem(OWNER_RESTAURANT_KEY);
  if (!value) return defaultOwnerRestaurant;
  return { ...defaultOwnerRestaurant, ...JSON.parse(value) as OwnerRestaurant };
}

export async function saveOwnerRestaurant(restaurant: OwnerRestaurant) {
  await Storage.setItem(OWNER_RESTAURANT_KEY, JSON.stringify(restaurant));
}

export function isMenuItemAvailable(
  item: OwnerMenuItem,
  restaurant: OwnerRestaurant,
  date = new Date(),
) {
  const currentTime = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return item.inStock
    && isTimeWithin(currentTime, restaurant.opensAt, restaurant.closesAt)
    && isTimeWithin(currentTime, item.availableFrom, item.availableUntil);
}

function isTimeWithin(current: string, start: string, end: string) {
  if (!start || !end) return true;
  return start <= end
    ? current >= start && current <= end
    : current >= start || current <= end;
}
