import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { getGuestProfile, newReference, saveGuestProfile, saveReservation } from '@/data/guest-storage';
import { useRestaurant } from '@/data/restaurants';
import { goBackOrReplace } from '@/utils/navigation';
import { getPushToken } from '@/utils/push-notifications';

const ORANGE = '#ED6417';
const CREAM = '#FFF8ED';
const times = ['6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM'];

export default function ReservationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { loading, restaurant } = useRestaurant(id);
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState(times[1]);
  const [guests, setGuests] = useState(2);
  const [confirmation, setConfirmation] = useState<string | null>(null);
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

  if (!restaurant) return <SafeAreaView style={styles.confirmation}><Text style={styles.subtitle}>{loading ? 'Loading restaurant…' : 'Restaurant not found.'}</Text></SafeAreaView>;

  const submit = async () => {
    if (!name.trim() || !phone.trim() || !date.trim()) {
      Alert.alert('Missing information', 'Enter your name, phone number, and reservation date.');
      return;
    }
    if (phone.replace(/\D/g, '').length < 7) return Alert.alert('Invalid phone number', 'Enter a valid phone number with at least 7 digits.');
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) return Alert.alert('Invalid email', 'Enter a valid email address or leave it blank.');
    const selectedDate = parseLocalDate(date.trim());
    if (!selectedDate) return Alert.alert('Invalid date', 'Use YYYY-MM-DD and enter a real calendar date.');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate < today) return Alert.alert('Date has passed', 'Choose today or a future date.');
    const reference = newReference('FR');
    const profile = { name: name.trim(), phone: phone.trim(), email: email.trim() };
    try {
      setSubmitting(true);
      const pushToken = await getPushToken({ ask: true });
      const [, sent] = await Promise.all([
        saveGuestProfile(profile),
        saveReservation({ id: reference, restaurantId: restaurant.id, restaurantName: restaurant.name, ...profile, date: date.trim(), time, guests, pushToken, createdAt: new Date().toISOString() }),
      ]);
      setDelivered(sent);
      setNotifying(Boolean(pushToken));
      setConfirmation(reference);
    } catch {
      Alert.alert('Could not save reservation', 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (confirmation) {
    return <SafeAreaView style={styles.confirmation}><Text style={styles.check}>✓</Text><Text style={styles.confirmationTitle}>{delivered ? 'Reservation requested' : 'Reservation saved'}</Text><Text style={styles.confirmationCopy}>{restaurant.name}{'\n'}{date} at {time} · {guests} guests</Text>{!delivered && <Text style={styles.pendingNote}>You are offline, so the restaurant has not received this request yet. It is saved on this phone and will be sent automatically as soon as you are back online.</Text>}{notifying && <Text style={styles.notifyNote}>We will send you a notification when the restaurant confirms your table.</Text>}<Text style={styles.reference}>REFERENCE {confirmation}</Text><Pressable onPress={() => router.replace('/')} style={styles.primaryButton}><Text style={styles.primaryText}>Back to home</Text></Pressable></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => goBackOrReplace(`/restaurant/${restaurant.id}`)}><Text style={styles.back}>‹ Restaurant details</Text></Pressable>
          <Text style={styles.eyebrow}>RESERVATION</Text><Text style={styles.title}>Book a table</Text><Text style={styles.subtitle}>{restaurant.name} · {restaurant.area}</Text>
          <Text style={styles.label}>YOUR NAME</Text><TextInput autoComplete="name" onChangeText={setName} placeholder="Full name" style={styles.input} value={name} />
          <Text style={styles.label}>PHONE</Text><TextInput autoComplete="tel" keyboardType="phone-pad" onChangeText={setPhone} placeholder="+255..." style={styles.input} value={phone} />
          <Text style={styles.label}>EMAIL (OPTIONAL)</Text><TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" onChangeText={setEmail} placeholder="you@example.com" style={styles.input} value={email} />
          <Text style={styles.label}>DATE</Text><TextInput onChangeText={setDate} placeholder="YYYY-MM-DD" style={styles.input} value={date} />
          <Text style={styles.label}>TIME</Text><View style={styles.choices}>{times.map((value) => <Pressable key={value} onPress={() => setTime(value)} style={[styles.choice, time === value && styles.choiceActive]}><Text style={[styles.choiceText, time === value && styles.choiceTextActive]}>{value}</Text></Pressable>)}</View>
          <Text style={styles.label}>GUESTS</Text><View style={styles.stepper}><Pressable onPress={() => setGuests((value) => Math.max(1, value - 1))} style={styles.stepButton}><Text style={styles.stepText}>−</Text></Pressable><Text style={styles.guestCount}>{guests}</Text><Pressable onPress={() => setGuests((value) => Math.min(12, value + 1))} style={styles.stepButton}><Text style={styles.stepText}>+</Text></Pressable></View>
          <Pressable disabled={submitting} onPress={submit} style={[styles.primaryButton, submitting && styles.disabled]}><Text style={styles.primaryText}>{submitting ? 'Sending request…' : 'Confirm reservation request'}</Text></Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function parseLocalDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day ? parsed : null;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, safeArea: { flex: 1, backgroundColor: CREAM }, content: { width: '100%', maxWidth: 620, alignSelf: 'center', padding: 20 },
  back: { color: ORANGE, fontSize: 14, fontWeight: '800', marginBottom: 25 }, eyebrow: { color: ORANGE, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, title: { color: '#171612', fontSize: 34, fontWeight: '900', marginTop: 6 }, subtitle: { color: '#777268', fontSize: 14, marginTop: 6, marginBottom: 20 },
  label: { color: '#777268', fontSize: 10, fontWeight: '900', letterSpacing: 0.7, marginTop: 16, marginBottom: 7 }, input: { height: 50, borderWidth: 1, borderColor: '#E9DFD2', borderRadius: 14, paddingHorizontal: 15, color: '#171612', backgroundColor: '#FFF' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, choice: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: '#E9DFD2', backgroundColor: '#FFF' }, choiceActive: { borderColor: ORANGE, backgroundColor: ORANGE }, choiceText: { color: '#4F4A43', fontSize: 12, fontWeight: '800' }, choiceTextActive: { color: '#FFF' },
  stepper: { width: 170, height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 25, backgroundColor: '#FFF' }, stepButton: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center' }, stepText: { color: ORANGE, fontSize: 25, fontWeight: '800' }, guestCount: { color: '#171612', fontSize: 18, fontWeight: '900' },
  primaryButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 26, paddingHorizontal: 24, backgroundColor: ORANGE, marginTop: 28 }, primaryText: { color: '#FFF', fontSize: 13, fontWeight: '900' },
  disabled: { opacity: 0.6 },
  notifyNote: { color: '#5F5951', textAlign: 'center', fontSize: 12, lineHeight: 18, marginTop: 12, maxWidth: 360 },
  pendingNote: { color: '#8E2F1A', textAlign: 'center', fontSize: 13, lineHeight: 19, marginTop: 14, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: '#F5D8D1', maxWidth: 420 },
  confirmation: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: CREAM }, check: { width: 70, height: 70, borderRadius: 35, overflow: 'hidden', textAlign: 'center', textAlignVertical: 'center', color: '#FFF', backgroundColor: '#278653', fontSize: 38, fontWeight: '900' }, confirmationTitle: { color: '#171612', fontSize: 28, fontWeight: '900', marginTop: 24 }, confirmationCopy: { color: '#5F5951', textAlign: 'center', fontSize: 15, lineHeight: 23, marginTop: 10 }, reference: { color: ORANGE, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginTop: 18 },
});
