import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { formatTsh, isMenuItemAvailable, isOpenNow, type MenuItem, type Restaurant } from '@/data/restaurants';
import type { SearchHit } from '@/data/search';
import { formatDistance } from '@/utils/distance';
import { themedStyles } from '@/theme/theme';

const ORANGE = '#ED6417';
const DISHES_SHOWN = 4;

type Props = { hit: SearchHit; distanceKm: number | null; saved: boolean; onToggleSaved: () => void };

/**
 * A search result. A food search lists the restaurant's matching dishes; a restaurant search lists
 * the foods it serves right now. Tapping anywhere opens the restaurant and its full menu.
 */
export function SearchResultCard({ distanceKm, hit, onToggleSaved, saved }: Props) {
  const { dishes, restaurant } = hit;
  const available = restaurant.menu.filter((dish) => isMenuItemAvailable(dish, restaurant));
  const listed = dishes.length ? dishes : available;
  const heading = dishes.length
    ? `${dishes.length} matching ${dishes.length === 1 ? 'food' : 'foods'}`
    : restaurant.menu.length
      ? available.length ? `Available now · ${available.length} of ${restaurant.menu.length}` : 'No foods available right now'
      : 'Menu coming soon';
  const open = isOpenNow(restaurant);
  const details = [restaurant.rating > 0 ? `★ ${restaurant.rating.toFixed(1)}` : null, `📍 ${restaurant.area}`, distanceKm != null ? formatDistance(distanceKm) : null].filter(Boolean).join(' · ');
  const openMenu = () => router.push(`/restaurant/${restaurant.id}` as Href);

  return <Pressable accessibilityRole="button" onPress={openMenu} style={styles.card}>
    <View style={styles.top}>
      {restaurant.coverUrl
        ? <Image contentFit="cover" source={restaurant.coverUrl} style={styles.thumb} transition={150} />
        : <View style={[styles.thumb, styles.thumbEmpty]}><Text style={styles.thumbIcon}>🍽️</Text></View>}
      <View style={styles.topCopy}>
        <Text numberOfLines={1} style={styles.name}>{restaurant.name}</Text>
        <Text numberOfLines={1} style={styles.details}>{details}</Text>
        <Text style={[styles.status, !open && styles.statusClosed]}>{open ? 'OPEN NOW' : 'CLOSED'}</Text>
      </View>
      <Pressable accessibilityLabel={saved ? `Remove ${restaurant.name} from saved` : `Save ${restaurant.name}`} accessibilityRole="button" hitSlop={8} onPress={onToggleSaved} style={styles.saveButton}>
        <Text style={[styles.saveIcon, saved && styles.savedIcon]}>{saved ? '♥' : '♡'}</Text>
      </Pressable>
    </View>

    <Text style={styles.heading}>{heading.toUpperCase()}</Text>
    {listed.slice(0, DISHES_SHOWN).map((dish) => <DishRow dish={dish} key={dish.id} restaurant={restaurant} />)}
    {listed.length > DISHES_SHOWN && <Text style={styles.more}>+{listed.length - DISHES_SHOWN} more</Text>}

    <Pressable accessibilityRole="link" onPress={openMenu}><Text style={styles.fullMenu}>See full menu ›</Text></Pressable>
  </Pressable>;
}

function DishRow({ dish, restaurant }: { dish: MenuItem; restaurant: Restaurant }) {
  const available = isMenuItemAvailable(dish, restaurant);
  return <View style={[styles.dish, !available && styles.dishUnavailable]}>
    {dish.photoUrl ? <Image contentFit="cover" source={dish.photoUrl} style={styles.dishPhoto} transition={150} /> : <View style={[styles.dishPhoto, styles.thumbEmpty]}><Text>🍲</Text></View>}
    <View style={styles.dishCopy}>
      <View style={styles.dishLine}>
        <Text numberOfLines={1} style={styles.dishName}>{dish.name}</Text>
        <Text style={styles.dishPrice}>{formatTsh(dish.price)}</Text>
      </View>
      <Text style={[styles.dishStatus, !available && styles.dishStatusOff]}>{available ? 'Available now' : `Not available now · served ${dish.availableFrom}–${dish.availableUntil}`}</Text>
    </View>
  </View>;
}

const styles = themedStyles(({ bg, fg, line }) => ({
  card: { marginBottom: 12, padding: 14, borderRadius: 20, borderWidth: 1, borderColor: line('#EEE6DA'), backgroundColor: bg('#FFF'), elevation: 2 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 64, height: 64, borderRadius: 14, backgroundColor: bg('#E9DFD3') },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: bg('#F4E9DC') },
  thumbIcon: { fontSize: 26 },
  topCopy: { flex: 1, gap: 3 },
  name: { color: fg('#171612'), fontSize: 16, fontWeight: '900' },
  details: { color: fg('#5E574F'), fontSize: 11, fontWeight: '600' },
  status: { alignSelf: 'flex-start', color: fg('#1F6B3A'), backgroundColor: bg('#E3F5E8'), borderRadius: 9, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 3, fontSize: 8, fontWeight: '900' },
  statusClosed: { color: fg('#8E2F1A'), backgroundColor: bg('#F8DDD6') },
  saveButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: bg('#FFF4EA') },
  saveIcon: { color: fg('#3B342D'), fontSize: 19 },
  savedIcon: { color: fg(ORANGE) },
  heading: { color: fg('#8A7164'), fontSize: 9, fontWeight: '900', letterSpacing: 0.8, marginTop: 14, marginBottom: 4 },
  dish: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, borderTopWidth: 1, borderTopColor: line('#F3ECE3') },
  dishUnavailable: { opacity: 0.6 },
  dishPhoto: { width: 40, height: 40, borderRadius: 10, backgroundColor: bg('#E9DFD3') },
  dishCopy: { flex: 1 },
  dishLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  dishName: { flex: 1, color: fg('#171612'), fontSize: 13, fontWeight: '800' },
  dishPrice: { color: fg(ORANGE), fontSize: 12, fontWeight: '900' },
  dishStatus: { color: fg('#1F6B3A'), fontSize: 10, fontWeight: '700', marginTop: 2 },
  dishStatusOff: { color: fg('#8A8278') },
  more: { color: fg('#8A8278'), fontSize: 11, fontWeight: '700', marginTop: 4 },
  fullMenu: { color: fg(ORANGE), fontSize: 12, fontWeight: '900', marginTop: 10 },
}));
