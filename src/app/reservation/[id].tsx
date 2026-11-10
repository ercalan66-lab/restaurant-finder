import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { getGuestProfile, saveGuestProfile, saveReservation } from '@/data/guest-storage';
import { getRestaurantDetail } from '@/data/restaurant-details';
import { goBackOrReplace } from '@/utils/navigation';

const ORANGE = '#ED6417';
const CREAM = '#FFF8ED';
const times = ['6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM'];

export default function ReservationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const restaurant = getRestaurantDetail(id);
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState(times[1]);
  const [guests, setGuests] = useState(2);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  useEffect(() => {
    getGuestProfile().then((profile) => {
      setName(profile.name);
      setPhone(profile.phone);
      setEmail(profile.email);
    }).catch(() => undefined);
  }, []);

  if (!restaurant) return null;

  const submit = async () => {
    if (!name.trim() || !phone.trim() || !date.trim()) {
      Alert.alert('Missing information', 'Enter your name, phone number, and reservation date.');
      return;
    }
    const reference = `FR-${Date.now().toString().slice(-6)}`;
    const profile = { name: name.trim(), phone: phone.trim(), email: email.trim() };
    try {
      await Promise.all([
        saveGuestProfile(profile),
        saveReservation({ id: reference, restaurantId: restaurant.id, restaurantName: restaurant.name, ...profile, date: date.trim(), time, guests, createdAt: new Date().toISOString() }),
      ]);
      setConfirmation(reference);
    } catch {
      Alert.alert('Could not save reservation', 'Please try again.');
    }
  };

  if (confirmation) {
    return <SafeAreaView style={styles.confirmation}><Text style={styles.check}>✓</Text><Text style={styles.confirmationTitle}>Reservation requested</Text><Text style={styles.confirmationCopy}>{restaurant.name}{'\n'}{date} at {time} · {guests} guests</Text><Text style={styles.reference}>REFERENCE {confirmation}</Text><Pressable onPress={() => router.replace('/')} style={styles.primaryButton}><Text style={styles.primaryText}>Back to home</Text></Pressable></SafeAreaView>;
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
          <Pressable onPress={submit} style={styles.primaryButton}><Text style={styles.primaryText}>Confirm reservation request</Text></Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, safeArea: { flex: 1, backgroundColor: CREAM }, content: { width: '100%', maxWidth: 620, alignSelf: 'center', padding: 20 },
  back: { color: ORANGE, fontSize: 14, fontWeight: '800', marginBottom: 25 }, eyebrow: { color: ORANGE, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, title: { color: '#171612', fontSize: 34, fontWeight: '900', marginTop: 6 }, subtitle: { color: '#777268', fontSize: 14, marginTop: 6, marginBottom: 20 },
  label: { color: '#777268', fontSize: 10, fontWeight: '900', letterSpacing: 0.7, marginTop: 16, marginBottom: 7 }, input: { height: 50, borderWidth: 1, borderColor: '#E9DFD2', borderRadius: 14, paddingHorizontal: 15, color: '#171612', backgroundColor: '#FFF' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, choice: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: '#E9DFD2', backgroundColor: '#FFF' }, choiceActive: { borderColor: ORANGE, backgroundColor: ORANGE }, choiceText: { color: '#4F4A43', fontSize: 12, fontWeight: '800' }, choiceTextActive: { color: '#FFF' },
  stepper: { width: 170, height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 25, backgroundColor: '#FFF' }, stepButton: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center' }, stepText: { color: ORANGE, fontSize: 25, fontWeight: '800' }, guestCount: { color: '#171612', fontSize: 18, fontWeight: '900' },
  primaryButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 26, paddingHorizontal: 24, backgroundColor: ORANGE, marginTop: 28 }, primaryText: { color: '#FFF', fontSize: 13, fontWeight: '900' },
  confirmation: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: CREAM }, check: { width: 70, height: 70, borderRadius: 35, overflow: 'hidden', textAlign: 'center', textAlignVertical: 'center', color: '#FFF', backgroundColor: '#278653', fontSize: 38, fontWeight: '900' }, confirmationTitle: { color: '#171612', fontSize: 28, fontWeight: '900', marginTop: 24 }, confirmationCopy: { color: '#5F5951', textAlign: 'center', fontSize: 15, lineHeight: 23, marginTop: 10 }, reference: { color: ORANGE, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginTop: 18 },
});
