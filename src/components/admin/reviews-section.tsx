import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { fetchLatestReviews, formatReviewDate, setReviewHidden, stars, type AdminReview } from '@/data/reviews';
import { confirmAction, errorMessage, showMessage } from '@/utils/feedback';

import { Action, adminStyles, Badge, Chips, Empty, LoadError, SectionHeading, type Loadable } from './admin-ui';

type Filter = 'all' | 'visible' | 'hidden';

const loadReviews = (): Promise<Loadable<AdminReview[]>> =>
  fetchLatestReviews().then((value) => ({ kind: 'ready' as const, value }), (error: unknown) => ({ kind: 'error' as const, message: errorMessage(error) }));

/** Newest reviews across Kwetu. Admins hide abusive or fake ones; hidden reviews leave the page and the average. */
export function ReviewsSection() {
  const [state, setState] = useState<Loadable<AdminReview[]>>({ kind: 'loading' });
  const [filter, setFilter] = useState<Filter>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    void loadReviews().then((result) => { if (active) setState(result); });
    return () => { active = false; };
  }, []));

  const reload = () => void loadReviews().then(setState);

  const change = async (review: AdminReview, hidden: boolean) => {
    setBusyId(review.id);
    try {
      await setReviewHidden(review.id, hidden);
      reload();
    } catch (error) {
      showMessage('Could not update the review', errorMessage(error));
    } finally {
      setBusyId(null);
    }
  };
  const hide = (review: AdminReview) => confirmAction(
    'Hide this review?',
    `It disappears from ${review.restaurantName}'s page and stops counting towards its rating. You can show it again later.`,
    'Hide review',
    () => void change(review, true),
  );

  const reviews = state.kind === 'ready' ? state.value : [];
  const visible = reviews.filter((review) => filter === 'all' || (filter === 'hidden') === review.isHidden);
  const hiddenCount = reviews.filter((review) => review.isHidden).length;

  return <View>
    <SectionHeading helper="The newest customer reviews. Hide reviews that are abusive, fake or about the wrong restaurant." loading={state.kind === 'loading'} onRefresh={reload} title="Reviews" />
    <Chips
      onChange={setFilter}
      options={[
        { value: 'all', label: `All (${reviews.length})` },
        { value: 'visible', label: `Visible (${reviews.length - hiddenCount})` },
        { value: 'hidden', label: `Hidden (${hiddenCount})` },
      ]}
      value={filter}
    />
    {state.kind === 'error' && <LoadError message={state.message} onRetry={reload} />}
    {state.kind === 'ready' && (visible.length === 0
      ? <Empty copy={filter === 'hidden' ? 'Reviews you hide appear here.' : 'Reviews appear here as customers rate their visits.'} title={filter === 'hidden' ? 'No hidden reviews' : 'No reviews yet'} />
      : visible.map((review) => <View key={review.id} style={adminStyles.card}>
        <View style={adminStyles.cardTop}>
          <View style={adminStyles.cardCopy}>
            <Pressable onPress={() => router.push(`/restaurant/${review.restaurantId}` as Href)}><Text style={adminStyles.eyebrow}>{review.restaurantName.toUpperCase()} ›</Text></Pressable>
            <Text style={adminStyles.name}>{stars(review.rating)}</Text>
          </View>
          {review.isHidden && <Badge attention label="HIDDEN" />}
        </View>
        {review.comment ? <Text style={adminStyles.meta}>{review.comment}</Text> : <Text style={adminStyles.meta}>(No comment)</Text>}
        <Text style={adminStyles.meta}>{review.authorName} · {formatReviewDate(review.createdAt)}</Text>
        <View style={adminStyles.actions}>
          {review.isHidden
            ? <Action disabled={busyId === review.id} label="Show again" onPress={() => void change(review, false)} />
            : <Action disabled={busyId === review.id} label="Hide review" onPress={() => hide(review)} secondary />}
        </View>
      </View>))}
  </View>;
}
