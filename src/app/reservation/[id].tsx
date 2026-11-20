import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { bookingDates, bookingSlots, fetchBookedSeats, formatBooking } from '@/data/booking';
import { getGuestProfile, newReference, saveGuestProfile, saveReservation } from '@/data/guest-storage';
import { useRestaurant } from '@/data/restaurants';
import { t, tn } from '@/i18n';
import { goBackOrReplace } from '@/utils/navigation';
import { getPushToken } from '@/utils/push-notifications';
import { showMessage } from '@/utils/feedback';
import { themedStyles } from '@/theme/theme';

const ORANGE = '#ED6417';
const CREAM = '#FFF8ED';
const MAX_GUESTS = 12;
/** Show "N left" once a slot is this close to full. */
const FEW_SEATS = 10;

export default function ReservationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { loading, restaurant } = useRestaurant(id);
  const insets = useSafeAreaInsets();
  const dates = useMemo(() => bookingDates(), []);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [date, setDate] = useState(dates[0].iso);
  const [time, setTime] = useState<string | null>(null);
  const [guests, setGuests] = useState(2);
  const [booked, setBooked] = useState<Map<string, number>>(new Map());
  const [availabilityVersion, setAvailabilityVersion] = useState(0);
  const [confirmation, setConfirmation] = useState<{ reference: string; time: string } | null>(null);
  const [delivered, setDelivered] = useState(true);
  const [notifying, setNotifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Prefill only empty fields, so a slow load never overwrites what the customer already typed.
    getGuestProfile().then((profile) => {
      setName((current) => current || profile.name);
      setPhone((current) => current || profile.phone);
      setEmail((current) => current || profile.email);
    }).catch(() => undefined);
  }, []);

  const restaurantId = restaurant?.id;
  useEffect(() => {
    if (!restaurantId) return;
    let active = true;
    void fetchBookedSeats(restaurantId, date).then((seats) => { if (active) setBooked(seats); });
    return () => { active = false; };
  }, [restaurantId, date, availabilityVersion]);

  if (!restaurant) return <SafeAreaView style={styles.confirmation}><Text style={styles.subtitle}>{t(loading ? 'restaurant.loading' : 'restaurant.notFound')}</Text></SafeAreaView>;

  const slots = bookingSlots(restaurant, date);
  const seatsLeft = (slot: string) => Math.max(0, restaurant.seatsPerSlot - (booked.get(slot) ?? 0));
  const selectedTime = time && slots.includes(time) && seatsLeft(time) >= guests ? time : null;

  const chooseDate = (iso: string) => { setDate(iso); setTime(null); };

  const submit = async () => {
    if (!name.trim() || !phone.trim()) return showMessage(t('request.missingTitle'), t('request.missingBody'));
    if (phone.replace(/\D/g, '').length < 7) return showMessage(t('request.phoneTitle'), t('request.phoneBody'));
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) return showMessage(t('request.emailTitle'), t('request.emailBody'));
    if (!selectedTime) return showMessage(t('reserve.timeTitle'), t('reserve.timeBody', { guests: tn('count.guests', guests) }));
    const reference = newReference('KB');
    const profile = { name: name.trim(), phone: phone.trim(), email: email.trim() };
    try {
      setSubmitting(true);
      const pushToken = await getPushToken({ ask: true });
      const [, result] = await Promise.all([
        saveGuestProfile(profile),
        saveReservation({ id: reference, restaurantId: restaurant.id, restaurantName: restaurant.name, ...profile, date, time: selectedTime, guests, pushToken, createdAt: new Date().toISOString() }),
      ]);
      if (result.outcome === 'rejected') {
        // Usually someone took the last seats first: show fresh availability so they can pick again.
        setTime(null);
        setAvailabilityVersion((version) => version + 1);
        return showMessage(t('reserve.rejected'), result.reason);
      }
      setDelivered(result.outcome === 'sent');
      setNotifying(Boolean(pushToken));
      setConfirmation({ reference, time: selectedTime });
    } catch {
      showMessage(t('reserve.saveFailed'), t('common.tryAgain'));
    } finally {
      setSubmitting(false);
    }
  };

  if (confirmation) {
    return <SafeAreaView style={styles.confirmation}><Text style={styles.check}>✓</Text><Text style={styles.confirmationTitle}>{t(delivered ? 'reserve.requested' : 'reserve.saved')}</Text><Text style={styles.confirmationCopy}>{restaurant.name}{'\n'}{formatBooking(date, confirmation.time)} · {tn('count.guests', guests)}</Text>{!delivered && <Text style={styles.pendingNote}>{t('reserve.offlineNote')}</Text>}{notifying && <Text style={styles.notifyNote}>{t('reserve.notify')}</Text>}<Text style={styles.reference}>{t('request.reference', { reference: confirmation.reference })}</Text><Pressable onPress={() => router.replace('/')} style={styles.primaryButton}><Text style={styles.primaryText}>{t('request.backHome')}</Text></Pressable></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => goBackOrReplace(`/restaurant/${restaurant.id}`)}><Text style={styles.back}>{t('request.backToDetails')}</Text></Pressable>
          <Text style={styles.eyebrow}>{t('reserve.eyebrow')}</Text><Text style={styles.title}>{t('reserve.title')}</Text><Text style={styles.subtitle}>{restaurant.name} · {restaurant.area} · {t('reserve.open', { opens: restaurant.opensAt, closes: restaurant.closesAt })}</Text>

          <Text style={styles.label}>{t('reserve.guests')}</Text>
          <View style={styles.stepper}><Pressable accessibilityLabel={t('reserve.fewer')} onPress={() => setGuests((value) => Math.max(1, value - 1))} style={styles.stepButton}><Text style={styles.stepText}>−</Text></Pressable><Text style={styles.guestCount}>{guests}</Text><Pressable accessibilityLabel={t('reserve.more')} onPress={() => setGuests((value) => Math.min(MAX_GUESTS, value + 1))} style={styles.stepButton}><Text style={styles.stepText}>+</Text></Pressable></View>

          <Text style={styles.label}>{t('reserve.date')}</Text>
          <ScrollView contentContainerStyle={styles.dates} horizontal showsHorizontalScrollIndicator={false}>
            {dates.map((day) => {
              const active = day.iso === date;
              return <Pressable accessibilityRole="radio" accessibilityState={{ checked: active }} key={day.iso} onPress={() => chooseDate(day.iso)} style={[styles.dateChip, active && styles.chipActive]}>
                <Text style={[styles.dateLabel, active && styles.chipTextActive]}>{day.label}</Text>
                <Text style={[styles.dateMonth, active && styles.chipTextActive]}>{day.month}</Text>
              </Pressable>;
            })}
          </ScrollView>

          <Text style={styles.label}>{t('reserve.time')}</Text>
          {slots.length === 0
            ? <Text style={styles.noSlots}>{t('reserve.noSlots')}</Text>
            : <View style={styles.slots}>{slots.map((slot) => {
              const left = seatsLeft(slot);
              const fits = left >= guests;
              const active = slot === selectedTime;
              return <Pressable accessibilityLabel={left === 0 ? t('reserve.slotFullA11y', { time: slot }) : t('reserve.slotLeftA11y', { time: slot, count: left })} accessibilityRole="radio" accessibilityState={{ checked: active, disabled: !fits }} disabled={!fits} key={slot} onPress={() => setTime(slot)} style={[styles.slot, active && styles.chipActive, !fits && styles.slotFull]}>
                <Text style={[styles.slotTime, active && styles.chipTextActive, !fits && styles.slotFullText]}>{slot}</Text>
                {(!fits || left <= FEW_SEATS) && <Text style={[styles.slotNote, active && styles.chipTextActive, !fits && styles.slotFullText]}>{left === 0 ? t('reserve.slotFull') : t('reserve.slotLeft', { count: left })}</Text>}
              </Pressable>;
            })}</View>}

          <Text style={styles.sectionTitle}>{t('reserve.yourDetails')}</Text>
          <Text style={styles.label}>{t('profile.name')}</Text><TextInput autoComplete="name" onChangeText={setName} placeholder={t('profile.namePlaceholder')} style={styles.input} value={name} />
          <Text style={styles.label}>{t('profile.phone')}</Text><TextInput autoComplete="tel" keyboardType="phone-pad" onChangeText={setPhone} placeholder="+255..." style={styles.input} value={phone} />
          <Text style={styles.label}>{t('profile.emailOptional')}</Text><TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" onChangeText={setEmail} placeholder="you@example.com" style={styles.input} value={email} />

          <Pressable disabled={submitting} onPress={submit} style={[styles.primaryButton, submitting && styles.disabled]}><Text style={styles.primaryText}>{submitting ? t('reserve.sending') : selectedTime ? t('reserve.requestAt', { when: formatBooking(date, selectedTime) }) : t('reserve.confirm')}</Text></Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = themedStyles(({ bg, fg, line }) => ({
  flex: { flex: 1 }, safeArea: { flex: 1, backgroundColor: bg(CREAM) }, content: { width: '100%', maxWidth: 620, alignSelf: 'center', padding: 20 },
  back: { color: fg(ORANGE), fontSize: 14, fontWeight: '800', marginBottom: 25 }, eyebrow: { color: fg(ORANGE), fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, title: { color: fg('#171612'), fontSize: 34, fontWeight: '900', marginTop: 6 }, subtitle: { color: fg('#777268'), fontSize: 14, marginTop: 6, marginBottom: 8 },
  sectionTitle: { color: fg('#171612'), fontSize: 20, fontWeight: '900', marginTop: 28 },
  label: { color: fg('#777268'), fontSize: 10, fontWeight: '900', letterSpacing: 0.7, marginTop: 18, marginBottom: 8 }, input: { height: 50, borderWidth: 1, borderColor: line('#E9DFD2'), borderRadius: 14, paddingHorizontal: 15, color: fg('#171612'), backgroundColor: bg('#FFF') },
  dates: { gap: 8, paddingRight: 8 }, dateChip: { width: 74, alignItems: 'center', paddingVertical: 10, borderRadius: 16, borderWidth: 1, borderColor: line('#E9DFD2'), backgroundColor: bg('#FFF') }, dateLabel: { color: fg('#171612'), fontSize: 12, fontWeight: '900' }, dateMonth: { color: fg('#777268'), fontSize: 10, marginTop: 2 },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, slot: { minWidth: 72, alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 14, borderWidth: 1, borderColor: line('#E9DFD2'), backgroundColor: bg('#FFF') }, slotTime: { color: fg('#171612'), fontSize: 13, fontWeight: '900' }, slotNote: { color: fg(ORANGE), fontSize: 9, fontWeight: '800', marginTop: 2 }, slotFull: { backgroundColor: bg('#F3EEE8'), borderColor: line('#EEE6DC') }, slotFullText: { color: fg('#B3AAA0') },
  chipActive: { borderColor: line(ORANGE), backgroundColor: bg(ORANGE) }, chipTextActive: { color: fg('#FFF') },
  noSlots: { color: fg('#8E2F1A'), fontSize: 12, lineHeight: 18, padding: 12, borderRadius: 12, backgroundColor: bg('#F5D8D1') },
  stepper: { width: 170, height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 25, backgroundColor: bg('#FFF') }, stepButton: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center' }, stepText: { color: fg(ORANGE), fontSize: 25, fontWeight: '800' }, guestCount: { color: fg('#171612'), fontSize: 18, fontWeight: '900' },
  primaryButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 26, paddingHorizontal: 24, backgroundColor: bg(ORANGE), marginTop: 28 }, primaryText: { color: fg('#FFF'), fontSize: 13, fontWeight: '900' },
  disabled: { opacity: 0.6 },
  notifyNote: { color: fg('#5F5951'), textAlign: 'center', fontSize: 12, lineHeight: 18, marginTop: 12, maxWidth: 360 },
  pendingNote: { color: fg('#8E2F1A'), textAlign: 'center', fontSize: 13, lineHeight: 19, marginTop: 14, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: bg('#F5D8D1'), maxWidth: 420 },
  confirmation: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: bg(CREAM) }, check: { width: 70, height: 70, borderRadius: 35, overflow: 'hidden', textAlign: 'center', textAlignVertical: 'center', color: fg('#FFF'), backgroundColor: bg('#278653'), fontSize: 38, fontWeight: '900' }, confirmationTitle: { color: fg('#171612'), fontSize: 28, fontWeight: '900', marginTop: 24 }, confirmationCopy: { color: fg('#5F5951'), textAlign: 'center', fontSize: 15, lineHeight: 23, marginTop: 10 }, reference: { color: fg(ORANGE), fontSize: 11, fontWeight: '900', letterSpacing: 1, marginTop: 18 },
}));
