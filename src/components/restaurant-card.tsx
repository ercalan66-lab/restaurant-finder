import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { PhotoBackground } from '@/components/photo-background';
import { formatTsh, isOpenNow, type RestaurantSummary } from '@/data/restaurants';
import { t, tn } from '@/i18n';
import { formatDistance } from '@/utils/distance';
import { themedStyles } from '@/theme/theme';

const ORANGE = '#ED6417';

function reviewsLabel(restaurant: RestaurantSummary) {
  const count = restaurant.reviewCount;
  const reviews = count > 0 ? tn('count.reviews', count) : t('card.noReviews');
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
      <Pressable accessibilityLabel={t(saved ? 'card.unsave' : 'card.save', { name: restaurant.name })} accessibilityRole="button" hitSlop={8} onPress={onToggleSaved} style={styles.saveButton}>
        <Text style={[styles.saveIcon, saved && styles.savedIcon]}>{saved ? '♥' : '♡'}</Text>
      </Pressable>
      <View style={styles.photoFooter}>
        {distanceKm != null ? <Text style={styles.distance}>{formatDistance(distanceKm)}</Text> : <View />}
        <Text style={[styles.status, !open && styles.statusClosed]}>{t(open ? 'card.open' : 'card.closed')}</Text>
      </View>
    </PhotoBackground>
    <View style={styles.body}>
      <Text numberOfLines={1} style={styles.name}>{restaurant.name}</Text>
      <Text numberOfLines={1} style={styles.reviews}>{reviewsLabel(restaurant)}</Text>
      <Text numberOfLines={1} style={styles.location}>📍 {restaurant.area}</Text>
      {restaurant.pricePerPerson > 0 && <Text style={styles.price}>{t('card.perPerson', { price: formatTsh(restaurant.pricePerPerson) })}</Text>}
    </View>
  </Pressable>;
}

const styles = themedStyles(({ bg, fg, line }) => ({
  card: { minWidth: 0, marginBottom: 12, borderRadius: 20, overflow: 'hidden', backgroundColor: bg('#FFF'), borderWidth: 1, borderColor: line('#EEE6DA'), elevation: 2 },
  photo: { height: 150, backgroundColor: bg('#D6D0C8') },
  photoShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.14)' },
  tag: { position: 'absolute', top: 10, left: 10, color: fg('#FFF'), backgroundColor: bg(ORANGE), borderRadius: 12, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 5, fontSize: 8, fontWeight: '900' },
  saveButton: { position: 'absolute', top: 9, right: 9, width: 36, height: 36, borderRadius: 18, backgroundColor: bg('#FFFFFF'), alignItems: 'center', justifyContent: 'center' },
  saveIcon: { color: fg('#3B342D'), fontSize: 20 },
  savedIcon: { color: fg(ORANGE) },
  photoFooter: { position: 'absolute', left: 9, right: 9, bottom: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  distance: { color: fg('#FFF'), backgroundColor: 'rgba(23,22,18,0.72)', borderRadius: 10, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 4, fontSize: 10, fontWeight: '800' },
  status: { color: fg('#1F6B3A'), backgroundColor: bg('#E3F5E8'), borderRadius: 10, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 4, fontSize: 9, fontWeight: '900' },
  statusClosed: { color: fg('#8E2F1A'), backgroundColor: bg('#F8DDD6') },
  body: { padding: 12, gap: 4 },
  name: { color: fg('#171612'), fontSize: 15, fontWeight: '900' },
  reviews: { color: fg('#B07A00'), fontSize: 11, fontWeight: '800' },
  location: { color: fg('#5E574F'), fontSize: 11, fontWeight: '600' },
  price: { color: fg('#8A8278'), fontSize: 10, marginTop: 2 },
}));
