import type { MenuItem, Restaurant } from './restaurants';

// Bundled copy of the demo restaurants seeded by the Supabase migrations. Used only
// when the database cannot be reached, so the app still has something to show.

const photo = (id: string, width = 900) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${width}&q=85`;
const interiors = ['1517248135467-4c7edcad34c4', '1552566626-52f8b828add9', '1414235077428-338989a2e8c0'].map((id) => photo(id, 1200));
const foodPhotos = {
  african: ['1547592180-85f173990554', '1504674900247-0877df9cc836', '1544148103-0773bf10d330'],
  italian: ['1579751626657-72bc17010498', '1473093295043-cdd812d0e601', '1565299624946-b28f40a0ae38'],
  asian: ['1579871494447-9811cf80d66c', '1569058242253-92a9c755a0ec', '1563379926898-05f4575a45d8'],
};
const dishDescriptions = ['Chef signature, prepared fresh to order.', 'A guest favorite made with local ingredients.', 'Perfect for sharing at the table.'];
const dishPrices = [28000, 34000, 52000];

type DemoInput = Omit<Restaurant, 'ownerId' | 'mapUrl' | 'isActive' | 'galleryUrls' | 'menu' | 'approvalStatus' | 'rejectionReason' | 'seatsPerSlot' | 'reviewCount'> & {
  kind: keyof typeof foodPhotos;
  dishes: [string, string, string];
};

function demo({ kind, dishes, ...restaurant }: DemoInput): Restaurant {
  const menu: MenuItem[] = dishes.map((name, index) => ({
    id: `demo-${restaurant.id}-${index}`,
    name,
    description: dishDescriptions[index],
    price: dishPrices[index],
    photoUrl: photo(foodPhotos[kind][index]),
    availableFrom: restaurant.opensAt,
    availableUntil: restaurant.closesAt,
    inStock: true,
  }));
  return {
    ...restaurant,
    ownerId: null,
    mapUrl: '',
    isActive: true,
    approvalStatus: 'approved',
    rejectionReason: '',
    seatsPerSlot: 40,
    reviewCount: 0,
    galleryUrls: restaurant.id % 2 === 0 ? [...interiors].reverse() : interiors,
    menu,
  };
}

export const demoRestaurants: Restaurant[] = [
  demo({ id: 1, name: 'The Baobab Table', cuisine: 'African', area: 'Masaki', address: 'Haile Selassie Road, Masaki', phone: '+255 712 555 101', email: 'hello@baobabtable.co.tz', opensAt: '11:00', closesAt: '23:00', facilities: ['Wi-Fi', 'Parking'], rating: 4.9, distanceKm: 0.8, pricePerPerson: 45000, tag: 'Bestseller', coverUrl: photo('1547592180-85f173990554'), description: 'A vibrant celebration of East African cooking with fragrant rice, charcoal-grilled seafood, and generous sharing plates.', kind: 'african', dishes: ['Baobab seafood platter', 'Coconut fish curry', 'Nyama choma board'] }),
  demo({ id: 2, name: 'Olive & Ember', cuisine: 'Italian', area: 'Oyster Bay', address: 'Toure Drive, Oyster Bay', phone: '+255 712 555 102', email: 'tables@oliveandember.co.tz', opensAt: '12:00', closesAt: '23:00', facilities: ['Garden seating', 'Parking'], rating: 4.8, distanceKm: 1.4, pricePerPerson: 85000, tag: 'Hot spot', coverUrl: photo('1579751626657-72bc17010498'), description: 'Seasonal antipasti, blistered sourdough pizza, and handmade pasta in a relaxed garden setting.', kind: 'italian', dishes: ['Truffle tagliatelle', 'Ember margherita', 'Garden antipasti'] }),
  demo({ id: 3, name: 'Koi House', cuisine: 'Asian', area: 'City Centre', address: 'Ohio Street, City Centre', phone: '+255 712 555 103', email: 'reserve@koihouse.co.tz', opensAt: '12:00', closesAt: '22:30', facilities: ['Wi-Fi'], rating: 4.7, distanceKm: 2.1, pricePerPerson: 240000, tag: 'New', coverUrl: photo('1579871494447-9811cf80d66c'), description: 'Precision-cut sushi, warm donburi bowls, and inventive small plates in an intimate dining room.', kind: 'asian', dishes: ['Koi sushi selection', 'Miso salmon bowl', 'Crispy sharing plate'] }),
  demo({ id: 4, name: 'Morning Ritual', cuisine: 'Cafe', area: 'Mikocheni', address: 'Mwai Kibaki Road, Mikocheni', phone: '+255 712 555 104', email: 'coffee@morningritual.co.tz', opensAt: '06:30', closesAt: '18:00', facilities: ['Wi-Fi', 'Outdoor seating'], rating: 4.6, distanceKm: 0.5, pricePerPerson: 35000, tag: 'Open early', coverUrl: photo('1554118811-1e0d58224f24'), description: 'Excellent coffee, flaky pastries, and all-day brunch classics with plenty of plant-forward choices.', kind: 'italian', dishes: ['Ritual brunch plate', 'Avocado sourdough', 'Pastry selection'] }),
  demo({ id: 5, name: 'Spice Route', cuisine: 'Indian', area: 'Upanga', address: 'United Nations Road, Upanga', phone: '+255 712 555 105', email: 'karibu@spiceroute.co.tz', opensAt: '11:30', closesAt: '23:00', facilities: ['Parking'], rating: 4.8, distanceKm: 3.2, pricePerPerson: 65000, tag: 'Popular', coverUrl: photo('1585937421612-70a008356fbe'), description: 'Bold regional Indian flavors meet fresh local ingredients, from slow curries to smoky tandoor plates.', kind: 'asian', dishes: ['Tandoori mixed grill', 'Coconut prawn curry', 'Family biryani'] }),
  demo({ id: 6, name: 'Luna Trattoria', cuisine: 'Italian', area: 'Msasani', address: 'Kimweri Avenue, Msasani', phone: '+255 712 555 106', email: 'ciao@lunatrattoria.co.tz', opensAt: '17:00', closesAt: '23:00', facilities: ['Outdoor seating'], rating: 4.5, distanceKm: 1.8, pricePerPerson: 130000, tag: 'Great value', coverUrl: photo('1473093295043-cdd812d0e601'), description: 'A warm neighborhood trattoria known for silky handmade pasta, simple sauces, and classic tiramisu.', kind: 'italian', dishes: ['Luna carbonara', 'Burrata pizza', 'Classic tiramisu'] }),
  demo({ id: 7, name: 'Kariakoo Flame', cuisine: 'African', area: 'Kariakoo', address: 'Msimbazi Street, Kariakoo', phone: '+255 712 555 107', email: 'orders@kariakooflame.co.tz', opensAt: '10:00', closesAt: '22:00', facilities: ['Family seating'], rating: 4.6, distanceKm: 3.4, pricePerPerson: 28000, tag: 'Local favorite', coverUrl: photo('1504674900247-0877df9cc836'), description: 'Busy local dining with grilled meats, biryani, and classic Tanzanian plates.', kind: 'african', dishes: ['Flame nyama choma', 'Kariakoo biryani', 'Mishkaki platter'] }),
  demo({ id: 8, name: 'Harbour House', cuisine: 'African', area: 'Kivukoni', address: 'Kivukoni Front, Dar es Salaam', phone: '+255 712 555 108', email: 'reservations@harbourhouse.co.tz', opensAt: '12:00', closesAt: '23:30', facilities: ['Harbour view', 'Parking'], rating: 4.7, distanceKm: 2.8, pricePerPerson: 145000, tag: 'Ocean view', coverUrl: photo('1544148103-0773bf10d330'), description: 'Fresh seafood and coastal cooking overlooking the harbour.', kind: 'african', dishes: ['Harbour seafood grill', 'Zanzibar octopus', 'Coastal sharing board'] }),
];
