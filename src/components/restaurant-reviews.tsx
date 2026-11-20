import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

import { fetchRestaurantReviews, formatReviewDate, stars, type Review } from '@/data/reviews';
import { t, tn } from '@/i18n';
import { themedStyles } from '@/theme/theme';

const SHOWN = 10;

type State = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; reviews: Review[] };

/** The restaurant page's reviews: the average, how many there are, and the newest ones. */
export function RestaurantReviews({ rating, restaurantId, reviewCount }: { rating: number; restaurantId: number; reviewCount: number }) {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useFocusEffect(useCallback(() => {
    let active = true;
    fetchRestaurantReviews(restaurantId, SHOWN)
      .then((reviews) => { if (active) setState({ kind: 'ready', reviews }); })
      .catch(() => { if (active) setState({ kind: 'error' }); });
    return () => { active = false; };
  }, [restaurantId]));

  return <View style={styles.section}>
    <Text style={styles.title}>{t('reviews.title')}</Text>
    {reviewCount > 0
      ? <View style={styles.summary}>
        <Text style={styles.average}>{rating.toFixed(1)}</Text>
        <View>
          <Text style={styles.summaryStars}>{stars(rating)}</Text>
          <Text style={styles.caption}>{tn('reviews.fromCustomers', reviewCount)}</Text>
        </View>
      </View>
      : <Text style={styles.caption}>{t('reviews.none')}</Text>}

    {state.kind === 'error' && reviewCount > 0 && <Text style={styles.caption}>{t('reviews.loadFailed')}</Text>}
    {state.kind === 'ready' && state.reviews.map((review) => <View key={review.id} style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.cardStars}>{stars(review.rating)}</Text>
        <Text style={styles.date}>{formatReviewDate(review.createdAt)}</Text>
      </View>
      {review.comment ? <Text style={styles.comment}>{review.comment}</Text> : null}
      <Text style={styles.author}>{review.authorName}</Text>
    </View>)}
  </View>;
}

const styles = themedStyles(({ bg, fg, line }) => ({
  section: { paddingHorizontal: 18, paddingTop: 26 },
  title: { color: fg('#171612'), fontSize: 24, fontWeight: '900' },
  caption: { color: fg('#777268'), fontSize: 12, lineHeight: 18, marginTop: 4, marginBottom: 6 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 10, marginBottom: 6 },
  average: { color: fg('#171612'), fontSize: 40, fontWeight: '900' },
  summaryStars: { color: fg('#EAA000'), fontSize: 18, letterSpacing: 1 },
  card: { marginTop: 10, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: line('#EEE6DA'), backgroundColor: bg('#FFF') },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardStars: { color: fg('#EAA000'), fontSize: 14, letterSpacing: 1 },
  date: { color: fg('#9A9187'), fontSize: 10 },
  comment: { color: fg('#302C27'), fontSize: 13, lineHeight: 19, marginTop: 8 },
  author: { color: fg('#777268'), fontSize: 11, fontWeight: '800', marginTop: 8 },
}));
