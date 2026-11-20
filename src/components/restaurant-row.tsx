import { ScrollView, Text, View } from 'react-native';

import { RestaurantCard } from '@/components/restaurant-card';
import type { HomeSection } from '@/data/home-sections';
import type { RestaurantSummary } from '@/data/restaurants';
import { themedStyles } from '@/theme/theme';

const CARD_WIDTH = 236;

type Props = {
  section: HomeSection;
  isSaved: (id: number) => boolean;
  onToggleSaved: (id: number) => void;
  /** Kilometres from the person, shown on the card when known. */
  userDistanceOf: (restaurant: RestaurantSummary) => number | null;
};

/** One home screen row ("Saved", "Near you", "Most reviewed", "New on Kwetu") that scrolls sideways. */
export function RestaurantRow({ isSaved, onToggleSaved, section, userDistanceOf }: Props) {
  return <View style={styles.section}>
    <Text accessibilityRole="header" style={styles.title}>{section.title}</Text>
    <Text style={styles.caption}>{section.caption}</Text>
    <ScrollView contentContainerStyle={styles.row} horizontal showsHorizontalScrollIndicator={false}>
      {section.restaurants.map((restaurant) => <RestaurantCard
        distanceKm={userDistanceOf(restaurant)}
        key={restaurant.id}
        onToggleSaved={() => onToggleSaved(restaurant.id)}
        restaurant={restaurant}
        saved={isSaved(restaurant.id)}
        style={styles.card}
      />)}
    </ScrollView>
  </View>;
}

const styles = themedStyles(({ fg }) => ({
  section: { marginTop: 26 },
  title: { color: fg('#171612'), fontSize: 22, fontWeight: '900', letterSpacing: -0.4 },
  caption: { color: fg('#777268'), fontSize: 12, marginTop: 3, marginBottom: 12 },
  row: { gap: 12, paddingRight: 16 },
  card: { width: CARD_WIDTH, marginBottom: 4 },
}));
