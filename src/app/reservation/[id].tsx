import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { bookingDates, bookingSlots, fetchBookedSeats, formatBooking } from '@/data/booking';
import { getGuestProfile, newReference, saveGuestProfile, saveReservation } from '@/data/guest-storage';
import { useRestaurant } from '@/data/restaurants';
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

  if (!restaurant) return <SafeAreaView style={styles.confirmation}><Text style={styles.subtitle}>{loading ? 'Loading restaurant…' : 'Restaurant not found.'}</Text></SafeAreaView>;

  const slots = bookingSlots(restaurant, date);
  const seatsLeft = (slot: string) => Math.max(0, restaurant.seatsPerSlot - (booked.get(slot) ?? 0));
  const selectedTime = time && slots.includes(time) && seatsLeft(time) >= guests ? time : null;

  const chooseDate = (iso: string) => { setDate(iso); setTime(null); };

  const submit = async () => {
    if (!name.trim() || !phone.trim()) return showMessage('Missing information', 'Enter your name and phone number.');
    if (phone.replace(/\D/g, '').length < 7) return showMessage('Invalid phone number', 'Enter a valid phone number with at least 7 digits.');
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) return showMessage('Invalid email', 'Enter a valid email address or leave it blank.');
    if (!selectedTime) return showMessage('Choose a time', `Pick a time with room for ${guests} ${guests === 1 ? 'guest' : 'guests'}.`);
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
        return showMessage('Choose another time', result.reason);
      }
      setDelivered(result.outcome === 'sent');
      setNotifying(Boolean(pushToken));
      setConfirmation({ reference, time: selectedTime });
    } catch {
      showMessage('Could not save reservation', 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (confirmation) {
    return <SafeAreaView style={styles.confirmation}><Text style={styles.check}>✓</Text><Text style={styles.confirmationTitle}>{delivered ? 'Reservation requested' : 'Reservation saved'}</Text><Text style={styles.confirmationCopy}>{restaurant.name}{'\n'}{formatBooking(date, confirmation.time)} · {guests} {guests === 1 ? 'guest' : 'guests'}</Text>{!delivered && <Text style={styles.pendingNote}>You are offline, so the restaurant has not received this request yet. It is saved on this phone and will be sent automatically as soon as you are back online.</Text>}{notifying && <Text style={styles.notifyNote}>We will send you a notification when the restaurant confirms your table.</Text>}<Text style={styles.reference}>REFERENCE {confirmation.reference}</Text><Pressable onPress={() => router.replace('/')} style={styles.primaryButton}><Text style={styles.primaryText}>Back to home</Text></Pressable></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => goBackOrReplace(`/restaurant/${restaurant.id}`)}><Text style={styles.back}>‹ Restaurant details</Text></Pressable>
          <Text style={styles.eyebrow}>RESERVATION</Text><Text style={styles.title}>Book a table</Text><Text style={styles.subtitle}>{restaurant.name} · {restaurant.area} · open {restaurant.opensAt}–{restaurant.closesAt}</Text>

          <Text style={styles.label}>GUESTS</Text>
          <View style={styles.stepper}><Pressable accessibilityLabel="One guest fewer" onPress={() => setGuests((value) => Math.max(1, value - 1))} style={styles.stepButton}><Text style={styles.stepText}>−</Text></Pressable><Text style={styles.guestCount}>{guests}</Text><Pressable accessibilityLabel="One guest more" onPress={() => setGuests((value) => Math.min(MAX_GUESTS, value + 1))} style={styles.stepButton}><Text style={styles.stepText}>+</Text></Pressable></View>

          <Text style={styles.label}>DATE</Text>
          <ScrollView contentContainerStyle={styles.dates} horizontal showsHorizontalScrollIndicator={false}>
            {dates.map((day) => {
              const active = day.iso === date;
              return <Pressable accessibilityRole="radio" accessibilityState={{ checked: active }} key={day.iso} onPress={() => chooseDate(day.iso)} style={[styles.dateChip, active && styles.chipActive]}>
                <Text style={[styles.dateLabel, active && styles.chipTextActive]}>{day.label}</Text>
                <Text style={[styles.dateMonth, active && styles.chipTextActive]}>{day.month}</Text>
              </Pressable>;
            })}
          </ScrollView>

          <Text style={styles.label}>TIME</Text>
          {slots.length === 0
            ? <Text style={styles.noSlots}>No more booking times on this day. Choose another day.</Text>
            : <View style={styles.slots}>{slots.map((slot) => {
              const left = seatsLeft(slot);
              const fits = left >= guests;
              const active = slot === selectedTime;
              return <Pressable accessibilityLabel={`${slot}, ${left === 0 ? 'full' : `${left} seats left`}`} accessibilityRole="radio" accessibilityState={{ checked: active, disabled: !fits }} disabled={!fits} key={slot} onPress={() => setTime(slot)} style={[styles.slot, active && styles.chipActive, !fits && styles.slotFull]}>
                <Text style={[styles.slotTime, active && styles.chipTextActive, !fits && styles.slotFullText]}>{slot}</Text>
                {(!fits || left <= FEW_SEATS) && <Text style={[styles.slotNote, active && styles.chipTextActive, !fits && styles.slotFullText]}>{left === 0 ? 'Full' : `${left} left`}</Text>}
              </Pressable>;
            })}</View>}

          <Text style={styles.sectionTitle}>Your details</Text>
          <Text style={styles.label}>YOUR NAME</Text><TextInput autoComplete="name" onChangeText={setName} placeholder="Full name" style={styles.input} value={name} />
          <Text style={styles.label}>PHONE</Text><TextInput autoComplete="tel" keyboardType="phone-pad" onChangeText={setPhone} placeholder="+255..." style={styles.input} value={phone} />
          <Text style={styles.label}>EMAIL (OPTIONAL)</Text><TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" onChangeText={setEmail} placeholder="you@example.com" style={styles.input} value={email} />

          <Pressable disabled={submitting} onPress={submit} style={[styles.primaryButton, submitting && styles.disabled]}><Text style={styles.primaryText}>{submitting ? 'Sending request…' : selectedTime ? `Request ${formatBooking(date, selectedTime)}` : 'Confirm reservation request'}</Text></Pressable>
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
