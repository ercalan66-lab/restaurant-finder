export type MenuItem = {
  name: string;
  description: string;
  price: string;
  photo: string;
};

export type RestaurantDetail = {
  id: number;
  name: string;
  cuisine: string;
  area: string;
  rating: number;
  distance: number;
  description: string;
  phone: string;
  email: string;
  address: string;
  hours: string;
  environmentPhotos: string[];
  menu: MenuItem[];
};

const environmentPhotos = [
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=85',
  'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1200&q=85',
  'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=85',
];

const foodPhotos = {
  african: [
    'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=85',
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=85',
    'https://images.unsplash.com/photo-1544148103-0773bf10d330?auto=format&fit=crop&w=900&q=85',
  ],
  italian: [
    'https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=900&q=85',
    'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=900&q=85',
    'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=900&q=85',
  ],
  asian: [
    'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=900&q=85',
    'https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?auto=format&fit=crop&w=900&q=85',
    'https://images.unsplash.com/photo-1563379926898-05f4575a45d8?auto=format&fit=crop&w=900&q=85',
  ],
};

function menuFor(kind: keyof typeof foodPhotos, names: [string, string, string]): MenuItem[] {
  return names.map((name, index) => ({
    name,
    description: index === 0 ? 'Chef signature, prepared fresh to order.' : index === 1 ? 'A guest favorite made with local ingredients.' : 'Perfect for sharing at the table.',
    price: ['TSh 28,000', 'TSh 34,000', 'TSh 52,000'][index],
    photo: foodPhotos[kind][index],
  }));
}

export const restaurantDetails: RestaurantDetail[] = [
  { id: 1, name: 'The Baobab Table', cuisine: 'African', area: 'Masaki', rating: 4.9, distance: 0.8, description: 'A vibrant celebration of East African cooking with fragrant rice, charcoal-grilled seafood, and generous sharing plates.', phone: '+255 712 555 101', email: 'hello@baobabtable.co.tz', address: 'Haile Selassie Road, Masaki', hours: 'Daily · 11:00 AM–11:00 PM', environmentPhotos, menu: menuFor('african', ['Baobab seafood platter', 'Coconut fish curry', 'Nyama choma board']) },
  { id: 2, name: 'Olive & Ember', cuisine: 'Italian', area: 'Oyster Bay', rating: 4.8, distance: 1.4, description: 'Seasonal antipasti, blistered sourdough pizza, and handmade pasta in a relaxed garden setting.', phone: '+255 712 555 102', email: 'tables@oliveandember.co.tz', address: 'Toure Drive, Oyster Bay', hours: 'Tue–Sun · 12:00 PM–11:00 PM', environmentPhotos: [...environmentPhotos].reverse(), menu: menuFor('italian', ['Truffle tagliatelle', 'Ember margherita', 'Garden antipasti']) },
  { id: 3, name: 'Koi House', cuisine: 'Asian', area: 'City Centre', rating: 4.7, distance: 2.1, description: 'Precision-cut sushi, warm donburi bowls, and inventive small plates in an intimate dining room.', phone: '+255 712 555 103', email: 'reserve@koihouse.co.tz', address: 'Ohio Street, City Centre', hours: 'Daily · 12:00 PM–10:30 PM', environmentPhotos, menu: menuFor('asian', ['Koi sushi selection', 'Miso salmon bowl', 'Crispy sharing plate']) },
  { id: 4, name: 'Morning Ritual', cuisine: 'Cafe', area: 'Mikocheni', rating: 4.6, distance: 0.5, description: 'Excellent coffee, flaky pastries, and all-day brunch classics with plenty of plant-forward choices.', phone: '+255 712 555 104', email: 'coffee@morningritual.co.tz', address: 'Mwai Kibaki Road, Mikocheni', hours: 'Daily · 6:30 AM–6:00 PM', environmentPhotos: [...environmentPhotos].reverse(), menu: menuFor('italian', ['Ritual brunch plate', 'Avocado sourdough', 'Pastry selection']) },
  { id: 5, name: 'Spice Route', cuisine: 'Indian', area: 'Upanga', rating: 4.8, distance: 3.2, description: 'Bold regional Indian flavors meet fresh local ingredients, from slow curries to smoky tandoor plates.', phone: '+255 712 555 105', email: 'karibu@spiceroute.co.tz', address: 'United Nations Road, Upanga', hours: 'Daily · 11:30 AM–11:00 PM', environmentPhotos, menu: menuFor('asian', ['Tandoori mixed grill', 'Coconut prawn curry', 'Family biryani']) },
  { id: 6, name: 'Luna Trattoria', cuisine: 'Italian', area: 'Msasani', rating: 4.5, distance: 1.8, description: 'A warm neighborhood trattoria known for silky handmade pasta, simple sauces, and classic tiramisu.', phone: '+255 712 555 106', email: 'ciao@lunatrattoria.co.tz', address: 'Kimweri Avenue, Msasani', hours: 'Mon–Sat · 5:00 PM–11:00 PM', environmentPhotos: [...environmentPhotos].reverse(), menu: menuFor('italian', ['Luna carbonara', 'Burrata pizza', 'Classic tiramisu']) },
  { id: 7, name: 'Kariakoo Flame', cuisine: 'African', area: 'Kariakoo', rating: 4.6, distance: 3.4, description: 'Busy local dining with grilled meats, biryani, and classic Tanzanian plates.', phone: '+255 712 555 107', email: 'orders@kariakooflame.co.tz', address: 'Msimbazi Street, Kariakoo', hours: 'Daily · 10:00 AM–10:00 PM', environmentPhotos, menu: menuFor('african', ['Flame nyama choma', 'Kariakoo biryani', 'Mishkaki platter']) },
  { id: 8, name: 'Harbour House', cuisine: 'African', area: 'Kivukoni', rating: 4.7, distance: 2.8, description: 'Fresh seafood and coastal cooking overlooking the harbour.', phone: '+255 712 555 108', email: 'reservations@harbourhouse.co.tz', address: 'Kivukoni Front, Dar es Salaam', hours: 'Daily · 12:00 PM–11:30 PM', environmentPhotos: [...environmentPhotos].reverse(), menu: menuFor('african', ['Harbour seafood grill', 'Zanzibar octopus', 'Coastal sharing board']) },
];

export function getRestaurantDetail(id: string | number) {
  return restaurantDetails.find((restaurant) => restaurant.id === Number(id));
}
