import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { PhotoBackground } from '@/components/photo-background';
import { formatTsh, isOpenNow, type RestaurantSummary } from '@/data/restaurants';
import { formatDistance } from '@/utils/distance';

const ORANGE = '#ED6417';

function reviewsLabel(restaurant: RestaurantSummary) {
  const count = restaurant.reviewCount;
  const reviews = count > 0 ? `${count} ${count === 1 ? 'review' : 'reviews'}` : 'No reviews yet';
  return restaurant.rating > 0 ? `★ ${restaurant.rating.toFixed(1)} · ${reviews}` : reviews;
}

type Props = {
  restaurant: RestaurantSummary;
  saved: boolean;
  onToggleSaved: () => void;
  /** Kilometres from the person, when both positions are known. */
  distanceKm: number | null;
  style?: StyleProp<ViewStyle>;
};

/** A restaurant on the home screen: photo, saved, distance, open or closed, name, reviews and location. */
export function RestaurantCard({ distanceKm, onToggleSaved, restaurant, saved, style }: Props) {
  const open = isOpenNow(restaurant);
  return <Pressable accessibilityRole="button" onPress={() => router.push(`/restaurant/${restaurant.id}` as Href)} style={[styles.card, style]}>
    <PhotoBackground source={restaurant.coverUrl ? { uri: restaurant.coverUrl } : undefined} style={styles.photo}>
      <View style={styles.photoShade} />
      {restaurant.tag ? <Text style={styles.tag}>{restaurant.tag.toUpperCase()}</Text> : null}
      <Pressable accessibilityLabel={saved ? `Remove ${restaurant.name} from saved` : `Save ${restaurant.name}`} accessibilityRole="button" hitSlop={8} onPress={onToggleSaved} style={styles.saveButton}>
        <Text style={[styles.saveIcon, saved && styles.savedIcon]}>{saved ? '♥' : '♡'}</Text>
      </Pressable>
      <View style={styles.photoFooter}>
        {distanceKm != null ? <Text style={styles.distance}>{formatDistance(distanceKm)}</Text> : <View />}
        <Text style={[styles.status, !open && styles.statusClosed]}>{open ? 'OPEN NOW' : 'CLOSED'}</Text>
      </View>
    </PhotoBackground>
    <View style={styles.body}>
      <Text numberOfLines={1} style={styles.name}>{restaurant.name}</Text>
      <Text numberOfLines={1} style={styles.reviews}>{reviewsLabel(restaurant)}</Text>
      <Text numberOfLines={1} style={styles.location}>📍 {restaurant.area}</Text>
      {restaurant.pricePerPerson > 0 && <Text style={styles.price}>{formatTsh(restaurant.pricePerPerson)} per person</Text>}
    </View>
  </Pressable>;
}

const styles = StyleSheet.create({
  card: { minWidth: 0, marginBottom: 12, borderRadius: 20, overflow: 'hidden', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EEE6DA', elevation: 2 },
  photo: { height: 150, backgroundColor: '#D6D0C8' },
  photoShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.14)' },
  tag: { position: 'absolute', top: 10, left: 10, color: '#FFF', backgroundColor: ORANGE, borderRadius: 12, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 5, fontSize: 8, fontWeight: '900' },
  saveButton: { position: 'absolute', top: 9, right: 9, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center' },
  saveIcon: { color: '#3B342D', fontSize: 20 },
  savedIcon: { color: ORANGE },
  photoFooter: { position: 'absolute', left: 9, right: 9, bottom: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  distance: { color: '#FFF', backgroundColor: 'rgba(23,22,18,0.72)', borderRadius: 10, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 4, fontSize: 10, fontWeight: '800' },
  status: { color: '#1F6B3A', backgroundColor: '#E3F5E8', borderRadius: 10, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 4, fontSize: 9, fontWeight: '900' },
  statusClosed: { color: '#8E2F1A', backgroundColor: '#F8DDD6' },
  body: { padding: 12, gap: 4 },
  name: { color: '#171612', fontSize: 15, fontWeight: '900' },
  reviews: { color: '#B07A00', fontSize: 11, fontWeight: '800' },
  location: { color: '#5E574F', fontSize: 11, fontWeight: '600' },
  price: { color: '#8A8278', fontSize: 10, marginTop: 2 },
});
