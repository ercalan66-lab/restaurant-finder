import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { PhotoBackground } from '@/components/photo-background';
import { formatTsh, isOpenNow, type RestaurantSummary } from '@/data/restaurants';

const ORANGE = '#ED6417';

const distanceLabel = (restaurant: RestaurantSummary) => restaurant.distanceKm > 0 ? `⌖ ${restaurant.distanceKm} km · ${restaurant.area}` : `⌖ ${restaurant.area}`;
const ratingLabel = (restaurant: RestaurantSummary) => {
  if (restaurant.rating <= 0) return 'NEW';
  return restaurant.reviewCount > 0 ? `★ ${restaurant.rating} (${restaurant.reviewCount})` : `★ ${restaurant.rating}`;
};

type Props = { restaurant: RestaurantSummary; saved: boolean; onToggleSaved: () => void; style?: StyleProp<ViewStyle> };

/** A restaurant on the home screen: cover photo, save button, rating, price and whether it is open. */
export function RestaurantCard({ onToggleSaved, restaurant, saved, style }: Props) {
  return <Pressable accessibilityRole="button" onPress={() => router.push(`/restaurant/${restaurant.id}` as Href)} style={[styles.card, style]}>
    <PhotoBackground source={restaurant.coverUrl ? { uri: restaurant.coverUrl } : undefined} style={styles.photo}>
      <View style={styles.photoShade} />
      {restaurant.tag ? <Text style={styles.tag}>{restaurant.tag.toUpperCase()}</Text> : null}
      <Pressable accessibilityLabel={`${saved ? 'Remove' : 'Add'} saved restaurant`} hitSlop={8} onPress={onToggleSaved} style={styles.saveButton}>
        <Text style={[styles.saveIcon, saved && styles.savedIcon]}>{saved ? '♥' : '♡'}</Text>
      </Pressable>
      <Text style={styles.distance}>{distanceLabel(restaurant)}</Text>
    </PhotoBackground>
    <View style={styles.body}>
      <View style={styles.titleLine}>
        <Text numberOfLines={1} style={styles.title}>{restaurant.name}</Text>
        <Text style={styles.rating}>{ratingLabel(restaurant)}</Text>
      </View>
      <Text numberOfLines={1} style={styles.meta}>{restaurant.cuisine} · {restaurant.area}</Text>
      <View style={styles.footer}>
        <Text style={styles.price}>{restaurant.pricePerPerson > 0 ? formatTsh(restaurant.pricePerPerson) : '—'}</Text>
        {isOpenNow(restaurant) ? <Text style={styles.open}>OPEN NOW</Text> : <Text style={[styles.open, styles.closed]}>CLOSED</Text>}
      </View>
      {restaurant.pricePerPerson > 0 && <Text style={styles.perPerson}>per person</Text>}
    </View>
  </Pressable>;
}

const styles = StyleSheet.create({
  card: { minWidth: 0, marginBottom: 12, borderRadius: 20, overflow: 'hidden', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EEE6DA', elevation: 2 },
  photo: { height: 155, backgroundColor: '#D6D0C8' },
  photoShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.12)' },
  tag: { position: 'absolute', top: 10, left: 10, color: '#FFF', backgroundColor: ORANGE, borderRadius: 12, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 5, fontSize: 7, fontWeight: '900' },
  saveButton: { position: 'absolute', top: 9, right: 9, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.94)', alignItems: 'center', justifyContent: 'center' },
  saveIcon: { fontSize: 20 },
  savedIcon: { color: ORANGE },
  distance: { position: 'absolute', bottom: 9, left: 10, color: '#FFF', fontSize: 9, fontWeight: '800' },
  body: { padding: 12 },
  titleLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { flex: 1, color: '#171612', fontSize: 14, fontWeight: '900' },
  rating: { color: '#EAA000', fontSize: 11, fontWeight: '900' },
  meta: { color: '#777268', fontSize: 10, marginTop: 5 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  price: { color: '#171612', fontSize: 12, fontWeight: '900' },
  open: { color: '#3F8B54', backgroundColor: '#EAF7ED', borderRadius: 9, overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 4, fontSize: 7, fontWeight: '900' },
  closed: { color: '#8E2F1A', backgroundColor: '#F5D8D1' },
  perPerson: { color: '#918A81', fontSize: 8, marginTop: 2 },
});
