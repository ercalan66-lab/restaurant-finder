import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { User } from '@supabase/supabase-js';

import { describePayment, getGuestProfile, getOrders, getReservations, saveGuestProfile, type OrderRecord, type ReservationRecord } from '@/data/guest-storage';
import { goBackOrReplace } from '@/utils/navigation';
import { formatAccountPhone } from '@/utils/phone';
import { supabase } from '../../lib/supabase';

// Phone sign-in accounts have no email, so fall back to the phone number.
const accountLabel = (user: User | null) => user ? user.email || formatAccountPhone(user.phone) || 'Signed in' : null;

const ORANGE = '#ED6417';

export default function ProfileScreen() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [account, setAccount] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [reservations, setReservations] = useState<ReservationRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    getGuestProfile().then((profile) => { setName(profile.name); setPhone(profile.phone); setEmail(profile.email); }).catch(() => undefined);
    Promise.all([getOrders(), getReservations()]).then(([savedOrders, savedReservations]) => { setOrders(savedOrders); setReservations(savedReservations); }).catch(() => undefined).finally(() => setHistoryLoading(false));
    supabase.auth.getUser().then(({ data }) => setAccount(accountLabel(data.user))).catch(() => undefined);
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setAccount(accountLabel(session?.user ?? null)));
    return () => listener.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) return Alert.alert('Could not sign out', error.message);
    setAccount(null);
    Alert.alert('Signed out', 'Your local guest details remain on this device.');
  };

  const save = async () => {
    if (!name.trim()) return Alert.alert('Missing information', 'Enter your name.');
    if (!phone.trim()) return Alert.alert('Missing information', 'Enter your phone number.');
    setSaving(true);
    setSavedMessage('');
    try {
      const saved = await saveGuestProfile({ name: name.trim(), phone: phone.trim(), email: email.trim() });
      setName(saved.name);
      setPhone(saved.phone);
      setEmail(saved.email);
      setSavedMessage('Profile saved successfully. Your details will prefill reservations and orders.');
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown storage error';
      Alert.alert('Could not save profile', `${reason}\n\nPlease reload the app and try again.`);
    } finally {
      setSaving(false);
    }
  };

  return <SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><Pressable onPress={() => goBackOrReplace('/')}><Text style={styles.back}>‹ Back</Text></Pressable><Text style={styles.eyebrow}>GUEST PROFILE</Text><Text style={styles.title}>Your details</Text><Text style={styles.subtitle}>Save these once to prefill reservations and food orders.</Text><View style={styles.accountCard}><Text style={styles.accountLabel}>SUPABASE ACCOUNT</Text><Text style={styles.accountValue}>{account ?? 'Not signed in'}</Text><Pressable onPress={account ? signOut : () => router.push('/auth')}><Text style={styles.accountAction}>{account ? 'Sign out' : 'Sign in or create account'}</Text></Pressable></View><Text style={styles.label}>YOUR NAME</Text><TextInput autoComplete="name" editable={!saving} onChangeText={setName} placeholder="Full name" style={styles.input} value={name} /><Text style={styles.label}>PHONE</Text><TextInput autoComplete="tel" editable={!saving} keyboardType="phone-pad" onChangeText={setPhone} placeholder="+255..." style={styles.input} value={phone} /><Text style={styles.label}>EMAIL (OPTIONAL)</Text><TextInput autoCapitalize="none" autoComplete="email" editable={!saving} keyboardType="email-address" onChangeText={setEmail} placeholder="you@example.com" style={styles.input} value={email} />{savedMessage ? <Text accessibilityRole="alert" style={styles.savedMessage}>{savedMessage}</Text> : null}<Pressable disabled={saving} onPress={save} style={[styles.button, saving && styles.buttonDisabled]}><Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save profile'}</Text></Pressable><View style={styles.historySection}><Text style={styles.historyTitle}>Your activity</Text><Text style={styles.historyCopy}>{account ? 'Requests from this account and device.' : 'Requests saved on this device. Sign in to sync across devices.'}</Text>{historyLoading ? <Text style={styles.historyEmpty}>Loading activity…</Text> : <><Text style={styles.historyLabel}>ORDERS</Text>{orders.length ? orders.slice(0, 5).map((order) => <RequestCard key={order.id} meta={`TSh ${order.total.toLocaleString()} · ${describePayment(order.paymentMethod, order.fulfillment)} · ${order.paymentStatus === 'paid' ? 'Paid' : 'Not paid yet'}`} name={order.restaurantName} reference={order.id} status={order.status ?? 'pending'} />) : <Text style={styles.historyEmpty}>No food orders yet.</Text>}<Text style={styles.historyLabel}>RESERVATIONS</Text>{reservations.length ? reservations.slice(0, 5).map((reservation) => <RequestCard key={reservation.id} meta={`${reservation.date} at ${reservation.time} · ${reservation.guests} guests`} name={reservation.restaurantName} reference={reservation.id} status={reservation.status ?? 'pending'} />) : <Text style={styles.historyEmpty}>No table reservations yet.</Text>}</>}</View><View style={styles.ownerCard}><Text style={styles.ownerEyebrow}>FOR RESTAURANT OWNERS</Text><Text style={styles.ownerTitle}>Manage your restaurant</Text><Text style={styles.ownerCopy}>Update facilities, location, working hours, foods, prices, ingredients, and availability.</Text><Pressable onPress={() => router.push(account ? '/owner' : '/auth?role=owner')} style={styles.ownerButton}><Text style={styles.ownerButtonText}>Open restaurant dashboard</Text></Pressable></View></ScrollView></SafeAreaView>;
}

function RequestCard({ meta, name, reference, status }: { meta: string; name: string; reference: string; status: string }) {
  const attention = status === 'pending' || status === 'declined';
  return <View style={styles.requestCard}><View style={styles.requestHeading}><View style={styles.requestCopy}><Text style={styles.requestName}>{name}</Text><Text style={styles.requestReference}>{reference}</Text></View><Text style={[styles.status, attention && styles.statusAttention]}>{status.toUpperCase()}</Text></View><Text style={styles.requestMeta}>{meta}</Text></View>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF8ED' }, content: { width: '100%', maxWidth: 620, alignSelf: 'center', padding: 20, paddingBottom: 60 }, back: { color: ORANGE, fontSize: 14, fontWeight: '800', marginBottom: 25 }, eyebrow: { color: ORANGE, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, title: { color: '#171612', fontSize: 34, fontWeight: '900', marginTop: 6 }, subtitle: { color: '#777268', fontSize: 14, lineHeight: 20, marginTop: 7, marginBottom: 20 }, accountCard: { padding: 14, borderWidth: 1, borderColor: '#E9DFD2', borderRadius: 15, backgroundColor: '#FFF' }, accountLabel: { color: '#777268', fontSize: 9, fontWeight: '900', letterSpacing: 0.7 }, accountValue: { color: '#171612', fontSize: 13, fontWeight: '800', marginTop: 5 }, accountAction: { color: ORANGE, fontSize: 12, fontWeight: '900', marginTop: 9 }, label: { color: '#777268', fontSize: 10, fontWeight: '900', letterSpacing: 0.7, marginTop: 16, marginBottom: 7 }, input: { height: 50, borderWidth: 1, borderColor: '#E9DFD2', borderRadius: 14, paddingHorizontal: 15, color: '#171612', backgroundColor: '#FFF' }, savedMessage: { color: '#28734D', backgroundColor: '#E8F5ED', borderRadius: 12, padding: 12, fontSize: 12, lineHeight: 17, marginTop: 18 }, button: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 26, backgroundColor: ORANGE, marginTop: 20 }, buttonDisabled: { opacity: 0.6 }, buttonText: { color: '#FFF', fontSize: 13, fontWeight: '900' }, ownerCard: { marginTop: 28, padding: 20, borderRadius: 22, backgroundColor: '#271812' }, ownerEyebrow: { color: '#F29A52', fontSize: 9, fontWeight: '900', letterSpacing: 1 }, ownerTitle: { color: '#FFF', fontSize: 21, fontWeight: '900', marginTop: 6 }, ownerCopy: { color: '#D8CEC8', fontSize: 12, lineHeight: 18, marginTop: 7 }, ownerButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 23, backgroundColor: '#B93F1D', marginTop: 16 }, ownerButtonText: { color: '#FFF', fontSize: 12, fontWeight: '900' },
  historySection: { marginTop: 28, padding: 17, borderWidth: 1, borderColor: '#E9DFD2', borderRadius: 20, backgroundColor: '#FFF' }, historyTitle: { color: '#171612', fontSize: 21, fontWeight: '900' }, historyCopy: { color: '#777268', fontSize: 11, lineHeight: 17, marginTop: 4 }, historyLabel: { color: '#777268', fontSize: 9, fontWeight: '900', letterSpacing: 0.8, marginTop: 18, marginBottom: 7 }, historyEmpty: { color: '#918A81', fontSize: 12, paddingVertical: 12 }, requestCard: { padding: 13, borderWidth: 1, borderColor: '#F0E7DE', borderRadius: 14, backgroundColor: '#FFFDF9', marginBottom: 8 }, requestHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }, requestCopy: { flex: 1 }, requestName: { color: '#171612', fontSize: 13, fontWeight: '900' }, requestReference: { color: ORANGE, fontSize: 8, fontWeight: '900', marginTop: 3 }, requestMeta: { color: '#71675F', fontSize: 10, marginTop: 7 }, status: { color: '#28734D', backgroundColor: '#E8F5ED', borderRadius: 9, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 4, fontSize: 7, fontWeight: '900' }, statusAttention: { color: '#8E2F1A', backgroundColor: '#F5D8D1' },
});
