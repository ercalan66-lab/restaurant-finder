import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { User } from '@supabase/supabase-js';

import { ActivitySection } from '@/components/activity-section';
import { deleteMyAccount } from '@/data/account';
import { checkIsAdmin } from '@/data/admin';
import { getGuestProfile, getMyOrders, getMyReservations, refreshRequestStatuses, saveGuestProfile, type OrderRecord, type ReservationRecord } from '@/data/guest-storage';
import { fetchReviewedReferences } from '@/data/reviews';
import { confirmAction, errorMessage } from '@/utils/feedback';
import { goBackOrReplace } from '@/utils/navigation';
import { formatAccountPhone } from '@/utils/phone';
import { onNotificationReceived, unregisterDevice } from '@/utils/push-notifications';
import { supabase } from '../../lib/supabase';

// Phone sign-in accounts have no email, so fall back to the phone number.
const accountLabel = (user: User | null) => user ? user.email || formatAccountPhone(user.phone) || 'Signed in' : null;

const ORANGE = '#ED6417';
const ACTIVITY_REFRESH_MS = 15_000;

type SaveStatus = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved' } | { kind: 'error'; message: string };

/** Latest statuses first (works for guests too), then this person's orders and bookings, and which completed ones are reviewed. */
async function loadActivity() {
  await refreshRequestStatuses().catch(() => false);
  const [orders, reservations] = await Promise.all([getMyOrders(), getMyReservations()]);
  const completed = [...orders, ...reservations].filter((record) => record.status === 'completed').map((record) => record.id);
  const reviewed = await fetchReviewedReferences(completed);
  return { orders, reservations, reviewed };
}

export default function ProfileScreen() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ kind: 'idle' });
  const saving = saveStatus.kind === 'saving';
  const [account, setAccount] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [accountNotice, setAccountNotice] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [reservations, setReservations] = useState<ReservationRecord[]>([]);
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    getGuestProfile().then((profile) => { setName((current) => current || profile.name); setPhone((current) => current || profile.phone); setEmail((current) => current || profile.email); }).catch(() => undefined);
    const applyUser = (user: User | null) => {
      setAccount(accountLabel(user));
      if (user) void checkIsAdmin().then(setIsAdmin);
      else setIsAdmin(false);
    };
    supabase.auth.getUser().then(({ data }) => applyUser(data.user)).catch(() => undefined);
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => applyUser(session?.user ?? null));
    return () => listener.subscription.unsubscribe();
  }, []);

  const applyActivity = useCallback(({ orders: nextOrders, reservations: nextReservations, reviewed: nextReviewed }: Awaited<ReturnType<typeof loadActivity>>) => {
    setOrders(nextOrders);
    setReservations(nextReservations);
    setReviewed(nextReviewed);
    setHistoryLoading(false);
  }, []);
  const reloadActivity = useCallback(() => void loadActivity().then(applyActivity).catch(() => setHistoryLoading(false)), [applyActivity]);

  // Live status: refresh when the screen opens, every 15 seconds, and when a notification arrives.
  useFocusEffect(useCallback(() => {
    reloadActivity();
    const timer = setInterval(reloadActivity, ACTIVITY_REFRESH_MS);
    const stop = onNotificationReceived(reloadActivity);
    return () => { clearInterval(timer); stop(); };
  }, [reloadActivity]));

  const signOut = async () => {
    await unregisterDevice();
    const { error } = await supabase.auth.signOut();
    if (error) return Alert.alert('Could not sign out', error.message);
    setAccount(null);
    setAccountNotice('Signed out. Your saved details stay on this phone.');
  };

  const deleteAccount = () => confirmAction(
    'Delete your account?',
    'This permanently deletes your Kwetu account, removes your name, phone number and address from past orders and bookings, hides any restaurant you own, and clears the data on this phone. It cannot be undone.',
    'Delete account',
    () => void (async () => {
      setDeleting(true);
      try {
        await deleteMyAccount();
        setAccount(null);
        setIsAdmin(false);
        setName(''); setPhone(''); setEmail('');
        setOrders([]); setReservations([]);
        setAccountNotice('Your account and its personal details have been deleted.');
      } catch (error) {
        Alert.alert('Could not delete account', errorMessage(error));
      } finally {
        setDeleting(false);
      }
    })(),
  );

  // Feedback stays on the screen (not in a pop-up), because pop-ups do not show in the web version.
  const save = async () => {
    if (!name.trim()) return setSaveStatus({ kind: 'error', message: 'Enter your name before saving.' });
    if (!phone.trim()) return setSaveStatus({ kind: 'error', message: 'Enter your phone number before saving.' });
    setSaveStatus({ kind: 'saving' });
    try {
      const saved = await saveGuestProfile({ name: name.trim(), phone: phone.trim(), email: email.trim() });
      setName(saved.name);
      setPhone(saved.phone);
      setEmail(saved.email);
      setSaveStatus({ kind: 'saved' });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown storage error';
      setSaveStatus({ kind: 'error', message: `Your profile could not be saved (${reason}). Please try again.` });
    }
  };
  // Typing again after saving (or after a problem) brings back the normal "Save profile" button.
  const edit = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    if (saveStatus.kind === 'saved' || saveStatus.kind === 'error') setSaveStatus({ kind: 'idle' });
  };

  return <SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Pressable onPress={() => goBackOrReplace('/')}><Text style={styles.back}>‹ Back</Text></Pressable>
    <Text style={styles.eyebrow}>YOUR PROFILE</Text><Text style={styles.title}>Your details</Text><Text style={styles.subtitle}>Save these once to prefill reservations and food orders.</Text>

    <View style={styles.accountCard}>
      <Text style={styles.accountLabel}>ACCOUNT</Text>
      <Text style={styles.accountValue}>{account ?? 'Not signed in'}</Text>
      <View style={styles.accountActions}>
        <Pressable disabled={deleting} onPress={account ? () => void signOut() : () => router.push('/sign-in' as Href)}><Text style={styles.accountAction}>{account ? 'Sign out' : 'Sign in or create account'}</Text></Pressable>
        {account && <Pressable disabled={deleting} onPress={deleteAccount}><Text style={[styles.accountAction, styles.deleteAction]}>{deleting ? 'Deleting…' : 'Delete account'}</Text></Pressable>}
      </View>
      {accountNotice ? <Text accessibilityRole="alert" style={styles.accountNotice}>{accountNotice}</Text> : null}
    </View>

    <Text style={styles.label}>YOUR NAME</Text><TextInput autoComplete="name" editable={!saving} onChangeText={edit(setName)} placeholder="Full name" style={styles.input} value={name} />
    <Text style={styles.label}>PHONE</Text><TextInput autoComplete="tel" editable={!saving} keyboardType="phone-pad" onChangeText={edit(setPhone)} placeholder="+255..." style={styles.input} value={phone} />
    <Text style={styles.label}>EMAIL (OPTIONAL)</Text><TextInput autoCapitalize="none" autoComplete="email" editable={!saving} keyboardType="email-address" onChangeText={edit(setEmail)} placeholder="you@example.com" style={styles.input} value={email} />
    <Pressable accessibilityRole="button" accessibilityState={{ busy: saving, disabled: saving }} disabled={saving} onPress={() => void save()} style={[styles.button, saving && styles.buttonDisabled, saveStatus.kind === 'saved' && styles.buttonSaved]}>
      <Text style={styles.buttonText}>{saving ? 'Saving…' : saveStatus.kind === 'saved' ? '✓ Saved' : 'Save profile'}</Text>
    </Pressable>
    {saveStatus.kind === 'saved' && <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.savedMessage}>✓ Profile saved. Your name and phone will fill in automatically when you order food or book a table.</Text>}
    {saveStatus.kind === 'error' && <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.errorMessage}>{saveStatus.message}</Text>}

    <ActivitySection loading={historyLoading} onChanged={reloadActivity} orders={orders} reservations={reservations} reviewed={reviewed} signedIn={Boolean(account)} />

    {isAdmin && <Pressable accessibilityRole="button" onPress={() => router.push('/admin' as Href)} style={styles.adminCard}>
      <Text style={styles.adminEyebrow}>KWETU ADMIN</Text>
      <Text style={styles.adminTitle}>Open admin console ›</Text>
      <Text style={styles.adminCopy}>Review restaurants, look up orders and bookings, see today’s numbers, and manage admins.</Text>
    </Pressable>}

    <View style={styles.ownerCard}><Text style={styles.ownerEyebrow}>FOR RESTAURANT OWNERS</Text><Text style={styles.ownerTitle}>Manage your restaurant</Text><Text style={styles.ownerCopy}>Update facilities, location, working hours, foods, prices, ingredients, and availability.</Text><Pressable onPress={() => router.push((account ? '/owner' : '/sign-in?role=owner') as Href)} style={styles.ownerButton}><Text style={styles.ownerButtonText}>Open restaurant dashboard</Text></Pressable></View>

    <Pressable onPress={() => router.push('/privacy' as Href)} style={styles.privacyLink}><Text style={styles.privacyText}>Privacy policy</Text></Pressable>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF8ED' }, content: { width: '100%', maxWidth: 620, alignSelf: 'center', padding: 20, paddingBottom: 60 }, back: { color: ORANGE, fontSize: 14, fontWeight: '800', marginBottom: 25 }, eyebrow: { color: ORANGE, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, title: { color: '#171612', fontSize: 34, fontWeight: '900', marginTop: 6 }, subtitle: { color: '#777268', fontSize: 14, lineHeight: 20, marginTop: 7, marginBottom: 20 },
  accountCard: { padding: 14, borderWidth: 1, borderColor: '#E9DFD2', borderRadius: 15, backgroundColor: '#FFF' }, accountLabel: { color: '#777268', fontSize: 9, fontWeight: '900', letterSpacing: 0.7 }, accountValue: { color: '#171612', fontSize: 13, fontWeight: '800', marginTop: 5 }, accountActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 9 }, accountAction: { color: ORANGE, fontSize: 12, fontWeight: '900' }, deleteAction: { color: '#9B321C' }, accountNotice: { color: '#28734D', backgroundColor: '#E8F5ED', borderRadius: 10, padding: 10, fontSize: 12, lineHeight: 17, marginTop: 10 },
  label: { color: '#777268', fontSize: 10, fontWeight: '900', letterSpacing: 0.7, marginTop: 16, marginBottom: 7 }, input: { height: 50, borderWidth: 1, borderColor: '#E9DFD2', borderRadius: 14, paddingHorizontal: 15, color: '#171612', backgroundColor: '#FFF' }, savedMessage: { color: '#28734D', backgroundColor: '#E8F5ED', borderRadius: 12, padding: 12, fontSize: 12, lineHeight: 17, marginTop: 18 }, button: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 26, backgroundColor: ORANGE, marginTop: 20 }, buttonDisabled: { opacity: 0.6 }, buttonSaved: { backgroundColor: '#2E8B57' }, errorMessage: { color: '#8E2F1A', backgroundColor: '#FBE5DF', borderRadius: 12, padding: 12, fontSize: 12, lineHeight: 17, marginTop: 12 }, buttonText: { color: '#FFF', fontSize: 13, fontWeight: '900' },
  adminCard: { marginTop: 28, padding: 18, borderRadius: 20, borderWidth: 1, borderColor: '#D6CCE8', backgroundColor: '#F6F2FD' }, adminEyebrow: { color: '#5B3FA0', fontSize: 9, fontWeight: '900', letterSpacing: 1 }, adminTitle: { color: '#271A45', fontSize: 18, fontWeight: '900', marginTop: 5 }, adminCopy: { color: '#5E567A', fontSize: 12, lineHeight: 18, marginTop: 4 },
  ownerCard: { marginTop: 28, padding: 20, borderRadius: 22, backgroundColor: '#271812' }, ownerEyebrow: { color: '#F29A52', fontSize: 9, fontWeight: '900', letterSpacing: 1 }, ownerTitle: { color: '#FFF', fontSize: 21, fontWeight: '900', marginTop: 6 }, ownerCopy: { color: '#D8CEC8', fontSize: 12, lineHeight: 18, marginTop: 7 }, ownerButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 23, backgroundColor: '#B93F1D', marginTop: 16 }, ownerButtonText: { color: '#FFF', fontSize: 12, fontWeight: '900' },
  privacyLink: { alignSelf: 'center', paddingVertical: 12, marginTop: 18 }, privacyText: { color: '#777268', fontSize: 12, fontWeight: '700', textDecorationLine: 'underline' },
});
