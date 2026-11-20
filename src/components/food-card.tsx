import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import type { FoodItem } from '@/data/food-sections';
import { formatTsh, isMenuItemAvailable } from '@/data/restaurants';
import { t } from '@/i18n';
import { formatDistance } from '@/utils/distance';
import { themedStyles } from '@/theme/theme';

const ORANGE = '#ED6417';
export const FOOD_CARD_WIDTH = 168;

type Props = { item: FoodItem; saved: boolean; onToggleSaved: () => void; distanceKm: number | null };

/** A dish on the home screen: photo, price, name, restaurant and whether it can be ordered now. Opens the restaurant. */
export function FoodCard({ distanceKm, item, onToggleSaved, saved }: Props) {
  const { dish, restaurant } = item;
  const available = isMenuItemAvailable(dish, restaurant);
  const where = [restaurant.area, distanceKm != null ? formatDistance(distanceKm) : null].filter(Boolean).join(' · ');
  return <Pressable accessibilityHint={t('food.opens', { restaurant: restaurant.name })} accessibilityRole="button" onPress={() => router.push(`/restaurant/${restaurant.id}` as Href)} style={styles.card}>
    <View style={styles.photoWrap}>
      {dish.photoUrl
        ? <Image accessibilityIgnoresInvertColors contentFit="cover" source={dish.photoUrl} style={styles.photo} transition={150} />
        : <View style={[styles.photo, styles.photoEmpty]}><Text style={styles.photoIcon}>🍲</Text></View>}
      <Pressable accessibilityLabel={t(saved ? 'food.unsave' : 'card.save', { name: dish.name })} accessibilityRole="button" hitSlop={8} onPress={onToggleSaved} style={styles.saveButton}>
        <Text style={[styles.saveIcon, saved && styles.savedIcon]}>{saved ? '♥' : '♡'}</Text>
      </Pressable>
      <Text style={styles.price}>{formatTsh(dish.price)}</Text>
    </View>
    <View style={styles.body}>
      <Text numberOfLines={2} style={styles.name}>{dish.name}</Text>
      <Text numberOfLines={1} style={styles.restaurant}>{restaurant.name}</Text>
      <Text numberOfLines={1} style={styles.where}>📍 {where}</Text>
      <Text style={[styles.status, !available && styles.statusOff]}>{available ? t('food.availableNow') : t('food.servedFrom', { time: dish.availableFrom })}</Text>
    </View>
  </Pressable>;
}

const styles = themedStyles(({ bg, fg, line }) => ({
  card: { width: FOOD_CARD_WIDTH, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: line('#EEE6DA'), backgroundColor: bg('#FFF'), elevation: 2 },
  photoWrap: { height: 112, backgroundColor: bg('#E9DFD3') },
  photo: { width: '100%', height: '100%' },
  photoEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: bg('#F4E9DC') },
  photoIcon: { fontSize: 34 },
  saveButton: { position: 'absolute', top: 7, right: 7, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: bg('#FFFFFF') },
  saveIcon: { color: fg('#3B342D'), fontSize: 17 },
  savedIcon: { color: fg(ORANGE) },
  price: { position: 'absolute', left: 7, bottom: 7, color: fg('#FFF'), backgroundColor: 'rgba(23,22,18,0.78)', borderRadius: 9, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 3, fontSize: 10, fontWeight: '900' },
  body: { padding: 10, gap: 3 },
  name: { color: fg('#171612'), fontSize: 13, fontWeight: '900', lineHeight: 17 },
  restaurant: { color: fg('#5E574F'), fontSize: 11, fontWeight: '700' },
  where: { color: fg('#8A8278'), fontSize: 10 },
  status: { color: fg('#1F6B3A'), fontSize: 10, fontWeight: '800', marginTop: 2 },
  statusOff: { color: fg('#8A8278') },
}));
