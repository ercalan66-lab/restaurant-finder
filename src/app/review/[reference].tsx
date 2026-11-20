import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getMyOrders, getMyReservations } from '@/data/guest-storage';
import { MAX_REVIEW_COMMENT, submitReview } from '@/data/reviews';
import { t, tn, type MessageKey } from '@/i18n';
import { errorMessage, showMessage } from '@/utils/feedback';
import { goBackOrReplace } from '@/utils/navigation';
import { themedStyles } from '@/theme/theme';

const ORANGE = '#ED6417';
const RATING_WORDS: MessageKey[] = ['review.rating1', 'review.rating2', 'review.rating3', 'review.rating4', 'review.rating5'];

type Visit = { reference: string; restaurantName: string; phone: string; kind: 'order' | 'booking'; completed: boolean };

/** Finds the order or booking among the ones this phone or account knows about. */
async function findVisit(reference: string): Promise<Visit | null> {
  const [orders, reservations] = await Promise.all([getMyOrders(), getMyReservations()]);
  const order = orders.find((record) => record.id === reference);
  if (order) return { reference, restaurantName: order.restaurantName, phone: order.guest.phone, kind: 'order', completed: order.status === 'completed' };
  const booking = reservations.find((record) => record.id === reference);
  if (booking) return { reference, restaurantName: booking.restaurantName, phone: booking.phone, kind: 'booking', completed: booking.status === 'completed' };
  return null;
}

export default function ReviewScreen() {
  const { reference } = useLocalSearchParams<{ reference: string }>();
  const [visit, setVisit] = useState<Visit | null | undefined>(undefined);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let active = true;
    void findVisit(String(reference)).then((found) => { if (active) setVisit(found); }).catch(() => { if (active) setVisit(null); });
    return () => { active = false; };
  }, [reference]);

  const send = async () => {
    if (!visit) return;
    if (!rating) return showMessage(t('review.chooseTitle'), t('review.chooseBody'));
    setSending(true);
    try {
      await submitReview(visit.reference, visit.phone, rating, comment);
      showMessage(t('review.thanks'), t('review.thanksBody', { restaurant: visit.restaurantName }));
      goBackOrReplace('/profile');
    } catch (error) {
      showMessage(t('review.failed'), errorMessage(error));
    } finally {
      setSending(false);
    }
  };

  return <SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Pressable accessibilityRole="button" onPress={() => goBackOrReplace('/profile')}><Text style={styles.back}>{t('common.back')}</Text></Pressable>
    <Text style={styles.eyebrow}>{t('review.eyebrow')}</Text>

    {visit === undefined && <Text style={styles.helper}>{t('common.loading')}</Text>}
    {visit === null && <>
      <Text style={styles.title}>{t('review.notFound')}</Text>
      <Text style={styles.helper}>{t('review.notFoundBody')}</Text>
    </>}
    {visit && !visit.completed && <>
      <Text style={styles.title}>{visit.restaurantName}</Text>
      <Text style={styles.helper}>{t(visit.kind === 'order' ? 'review.notCompletedOrder' : 'review.notCompletedBooking')}</Text>
    </>}
    {visit && visit.completed && <>
      <Text style={styles.title}>{visit.restaurantName}</Text>
      <Text style={styles.helper}>{t(visit.kind === 'order' ? 'review.howFood' : 'review.howVisit')}</Text>

      <View accessibilityLabel={t('review.rating')} accessibilityRole="adjustable" style={styles.stars}>
        {[1, 2, 3, 4, 5].map((value) => <Pressable
          accessibilityLabel={tn('count.stars', value)}
          accessibilityRole="button"
          accessibilityState={{ selected: rating === value }}
          disabled={sending}
          hitSlop={6}
          key={value}
          onPress={() => setRating(value)}>
          <Text style={[styles.star, value <= rating && styles.starOn]}>★</Text>
        </Pressable>)}
      </View>
      <Text style={styles.ratingWord}>{rating ? t(RATING_WORDS[rating - 1]) : t('review.tapStar')}</Text>

      <Text style={styles.label}>{t('review.comment')}</Text>
      <TextInput
        editable={!sending}
        maxLength={MAX_REVIEW_COMMENT}
        multiline
        onChangeText={setComment}
        placeholder={t('review.commentPlaceholder')}
        placeholderTextColor="#B5A99F"
        style={styles.input}
        value={comment}
      />
      <Text style={styles.counter}>{comment.length}/{MAX_REVIEW_COMMENT}</Text>

      <Pressable accessibilityRole="button" disabled={sending} onPress={() => void send()} style={[styles.button, sending && styles.disabled]}>
        <Text style={styles.buttonText}>{t(sending ? 'review.sending' : 'review.send')}</Text>
      </Pressable>
    </>}
  </ScrollView></SafeAreaView>;
}

const styles = themedStyles(({ bg, fg, line }) => ({
  safeArea: { flex: 1, backgroundColor: bg('#FFF8ED') },
  content: { width: '100%', maxWidth: 560, alignSelf: 'center', padding: 22, paddingBottom: 60 },
  back: { color: fg(ORANGE), fontSize: 14, fontWeight: '800', marginBottom: 26 },
  eyebrow: { color: fg(ORANGE), fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: fg('#171612'), fontSize: 30, fontWeight: '900', marginTop: 6 },
  helper: { color: fg('#777268'), fontSize: 13, lineHeight: 20, marginTop: 8 },
  stars: { flexDirection: 'row', gap: 10, marginTop: 26 },
  // Empty stars use the border painter so they stay dim on the dark background too.
  star: { color: line('#E1D6C9'), fontSize: 44 },
  starOn: { color: fg('#EAA000') },
  ratingWord: { color: fg('#171612'), fontSize: 14, fontWeight: '800', marginTop: 4 },
  label: { color: fg('#777268'), fontSize: 9, fontWeight: '900', letterSpacing: 0.8, marginTop: 24, marginBottom: 7 },
  input: { minHeight: 110, borderWidth: 1, borderColor: line('#E9DFD2'), borderRadius: 14, padding: 14, color: fg('#171612'), backgroundColor: bg('#FFF'), textAlignVertical: 'top' },
  counter: { alignSelf: 'flex-end', color: fg('#9A9187'), fontSize: 10, marginTop: 5 },
  button: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 26, backgroundColor: bg(ORANGE), marginTop: 22 },
  buttonText: { color: fg('#FFF'), fontSize: 13, fontWeight: '900' },
  disabled: { opacity: 0.6 },
}));
