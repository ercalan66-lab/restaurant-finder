import { ScrollView, Text, View } from 'react-native';

import { FOOD_CARD_WIDTH, FoodCard } from '@/components/food-card';
import type { FoodSection } from '@/data/food-sections';
import type { RestaurantSummary } from '@/data/restaurants';
import { themedStyles } from '@/theme/theme';

type Props = {
  section: FoodSection;
  isSaved: (dishId: string) => boolean;
  onToggleSaved: (dishId: string) => void;
  distanceOf: (restaurant: RestaurantSummary) => number | null;
};

/** One food category row ("Top rated foods", "Popular foods", …) that scrolls sideways. */
export function FoodRow({ distanceOf, isSaved, onToggleSaved, section }: Props) {
  return <View style={styles.section}>
    <Text accessibilityRole="header" style={styles.title}>{section.title}</Text>
    <Text style={styles.caption}>{section.caption}</Text>
    {section.items.length === 0
      ? <View style={styles.empty}><Text style={styles.emptyText}>{section.empty}</Text></View>
      : <ScrollView contentContainerStyle={styles.row} horizontal showsHorizontalScrollIndicator={false}>
        {section.items.map((item) => <FoodCard
          distanceKm={distanceOf(item.restaurant)}
          item={item}
          key={`${item.restaurant.id}-${item.dish.id}`}
          onToggleSaved={() => onToggleSaved(item.dish.id)}
          saved={isSaved(item.dish.id)}
        />)}
      </ScrollView>}
  </View>;
}

const styles = themedStyles(({ bg, fg, line }) => ({
  section: { marginTop: 26 },
  title: { color: fg('#171612'), fontSize: 22, fontWeight: '900', letterSpacing: -0.4 },
  caption: { color: fg('#777268'), fontSize: 12, marginTop: 3, marginBottom: 12 },
  row: { gap: 12, paddingRight: 16, paddingBottom: 4 },
  empty: { minHeight: 64, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: line('#E3D3C3'), backgroundColor: bg('#FFFBF6'), maxWidth: FOOD_CARD_WIDTH * 2 + 12 },
  emptyText: { color: fg('#8A7164'), fontSize: 12, lineHeight: 17 },
}));
