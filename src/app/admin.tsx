import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { checkIsAdmin, fetchRestaurantsForReview, reviewRestaurant, updateListing } from '@/data/admin';
import type { ApprovalStatus, RestaurantSummary } from '@/data/restaurants';
import { errorMessage } from '@/utils/feedback';
import { goBackOrReplace } from '@/utils/navigation';

const ACCENT = '#B93F1D';
const TABS: { status: ApprovalStatus; label: string }[] = [
  { status: 'pending', label: 'Waiting' },
  { status: 'approved', label: 'Live' },
  { status: 'rejected', label: 'Changes requested' },
];

type LoadResult = { kind: 'denied' } | { kind: 'error'; message: string } | { kind: 'ready'; restaurants: RestaurantSummary[] };

async function loadAdmin(): Promise<LoadResult> {
  try {
    if (!await checkIsAdmin()) return { kind: 'denied' };
    return { kind: 'ready', restaurants: await fetchRestaurantsForReview() };
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) };
  }
}

export default function AdminScreen() {
  const [state, setState] = useState<LoadResult | null>(null);
  const [tab, setTab] = useState<ApprovalStatus>('pending');

  useFocusEffect(useCallback(() => {
    let active = true;
    void loadAdmin().then((result) => { if (active) setState(result); });
    return () => { active = false; };
  }, []));

  const reload = () => void loadAdmin().then(setState);

  if (!state) return <Shell><Text style={styles.helper}>Loading…</Text></Shell>;
  if (state.kind === 'denied') return <Shell><Text style={styles.title}>Admins only</Text><Text style={styles.helper}>Sign in with a Fork admin account to review restaurants.</Text></Shell>;
  if (state.kind === 'error') return <Shell><Text style={styles.title}>Could not load restaurants</Text><Text style={styles.helper}>{state.message}</Text><Pressable onPress={reload}><Text style={styles.link}>Try again</Text></Pressable></Shell>;

  const visible = state.restaurants.filter((restaurant) => restaurant.approvalStatus === tab);
  const count = (status: ApprovalStatus) => state.restaurants.filter((restaurant) => restaurant.approvalStatus === status).length;

  return <Shell>
    <Text style={styles.eyebrow}>FORK ADMIN</Text>
    <Text style={styles.title}>Restaurants</Text>
    <Text style={styles.helper}>Approve new restaurants before customers can see them, and keep ratings and tags up to date.</Text>
    <View style={styles.tabs}>{TABS.map((item) => <Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === item.status }} key={item.status} onPress={() => setTab(item.status)} style={[styles.tab, tab === item.status && styles.tabActive]}><Text style={[styles.tabText, tab === item.status && styles.tabTextActive]}>{item.label} ({count(item.status)})</Text></Pressable>)}</View>
    {visible.length === 0
      ? <View style={styles.empty}><Text style={styles.emptyTitle}>{tab === 'pending' ? 'Nothing to review' : 'None here'}</Text><Text style={styles.helper}>{tab === 'pending' ? 'New restaurants appear here when owners create them.' : 'Restaurants move here as you review them.'}</Text></View>
      : visible.map((restaurant) => <ReviewCard key={restaurant.id} onChanged={reload} restaurant={restaurant} />)}
  </Shell>;
}

function ReviewCard({ onChanged, restaurant }: { onChanged: () => void; restaurant: RestaurantSummary }) {
  const [reason, setReason] = useState('');
  const [asking, setAsking] = useState(false);
  const [rating, setRating] = useState(restaurant.rating ? String(restaurant.rating) : '');
  const [tag, setTag] = useState(restaurant.tag);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>, done: string) => {
    setBusy(true);
    try {
      await action();
      Alert.alert('Saved', done);
      onChanged();
    } catch (error) {
      Alert.alert('Could not save', errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const approve = () => run(() => reviewRestaurant(restaurant.id, true), `${restaurant.name} is now live. The owner has been notified.`);
  const requestChanges = () => {
    if (!reason.trim()) return Alert.alert('Add a reason', 'Tell the owner what needs to change.');
    return run(() => reviewRestaurant(restaurant.id, false, reason.trim()), `The owner of ${restaurant.name} has been asked for changes.`);
  };
  const saveListing = () => {
    const value = Number(rating.replace(',', '.'));
    if (!rating.trim() || Number.isNaN(value) || value < 0 || value > 5) return Alert.alert('Check the rating', 'Enter a rating between 0 and 5, for example 4.6.');
    return run(() => updateListing(restaurant.id, value, tag), `${restaurant.name} listing updated.`);
  };

  return <View style={styles.card}>
    <View style={styles.cardTop}>
      <View style={styles.cardCopy}><Text style={styles.name}>{restaurant.name}</Text><Text style={styles.meta}>{restaurant.cuisine} · {restaurant.area} · #{restaurant.id}</Text></View>
      {!restaurant.isActive && <Text style={styles.hidden}>HIDDEN BY OWNER</Text>}
    </View>
    <Text style={styles.meta}>{restaurant.address}</Text>
    {restaurant.phone || restaurant.email ? <Text style={styles.meta}>{[restaurant.phone, restaurant.email].filter(Boolean).join(' · ')}</Text> : null}
    {restaurant.description ? <Text style={styles.description}>{restaurant.description}</Text> : null}
    {restaurant.approvalStatus === 'rejected' && restaurant.rejectionReason ? <Text style={styles.reason}>Asked for: {restaurant.rejectionReason}</Text> : null}
    <Pressable onPress={() => router.push(`/restaurant/${restaurant.id}` as Href)}><Text style={styles.link}>View the restaurant page ›</Text></Pressable>

    {restaurant.approvalStatus === 'approved' && <View style={styles.listing}>
      <View style={styles.listingField}><Text style={styles.label}>RATING (0–5)</Text><TextInput editable={!busy} keyboardType="decimal-pad" onChangeText={setRating} placeholder="4.6" style={styles.input} value={rating} /></View>
      <View style={[styles.listingField, styles.listingTag]}><Text style={styles.label}>TAG</Text><TextInput editable={!busy} maxLength={24} onChangeText={setTag} placeholder="Bestseller" style={styles.input} value={tag} /></View>
    </View>}

    {asking && <View><Text style={styles.label}>WHAT NEEDS TO CHANGE?</Text><TextInput editable={!busy} multiline onChangeText={setReason} placeholder="For example: add a cover photo and at least three dishes." style={[styles.input, styles.multiline]} value={reason} /></View>}

    <View style={styles.actions}>
      {restaurant.approvalStatus !== 'approved' && !asking && <Action disabled={busy} label="Approve" onPress={() => void approve()} />}
      {restaurant.approvalStatus === 'approved' && <Action disabled={busy} label="Save rating & tag" onPress={() => void saveListing()} />}
      {asking
        ? <><Action disabled={busy} label="Send to owner" onPress={() => void requestChanges()} /><Action disabled={busy} label="Cancel" onPress={() => setAsking(false)} secondary /></>
        : restaurant.approvalStatus !== 'rejected' && <Action disabled={busy} label={restaurant.approvalStatus === 'approved' ? 'Unpublish' : 'Request changes'} onPress={() => setAsking(true)} secondary />}
    </View>
  </View>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Pressable onPress={() => goBackOrReplace('/profile')}><Text style={styles.back}>‹ Back</Text></Pressable>
    {children}
  </ScrollView></SafeAreaView>;
}

function Action({ disabled, label, onPress, secondary }: { disabled?: boolean; label: string; onPress: () => void; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.action, secondary && styles.actionSecondary, disabled && styles.disabled]}><Text style={[styles.actionText, secondary && styles.actionSecondaryText]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF8EE' },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 18, paddingBottom: 60 },
  back: { color: ACCENT, fontSize: 14, fontWeight: '800', marginBottom: 22 },
  eyebrow: { color: ACCENT, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#271812', fontSize: 32, fontWeight: '900', marginTop: 5 },
  helper: { color: '#71675F', fontSize: 13, lineHeight: 19, marginTop: 6 },
  link: { color: ACCENT, fontSize: 12, fontWeight: '800', marginTop: 10 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 4, borderRadius: 16, backgroundColor: '#F4EAE1', marginTop: 18 },
  tab: { flexGrow: 1, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8, borderRadius: 12 },
  tabActive: { backgroundColor: '#FFF' },
  tabText: { color: '#7B7068', fontSize: 11, fontWeight: '800' },
  tabTextActive: { color: ACCENT },
  empty: { alignItems: 'center', padding: 26, marginTop: 14, borderRadius: 16, backgroundColor: '#FFF' },
  emptyTitle: { color: '#271812', fontSize: 16, fontWeight: '900' },
  card: { marginTop: 14, padding: 16, borderWidth: 1, borderColor: '#EADFD3', borderRadius: 18, backgroundColor: '#FFF' },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardCopy: { flex: 1 },
  name: { color: '#271812', fontSize: 18, fontWeight: '900' },
  meta: { color: '#71675F', fontSize: 12, lineHeight: 18, marginTop: 4 },
  description: { color: '#4E453F', fontSize: 12, lineHeight: 18, marginTop: 8 },
  reason: { color: '#8E2F1A', fontSize: 12, lineHeight: 18, marginTop: 8, padding: 10, borderRadius: 10, backgroundColor: '#FBE9E5' },
  hidden: { color: '#6B5A30', backgroundColor: '#FFF7DE', borderRadius: 9, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 4, fontSize: 8, fontWeight: '900' },
  listing: { flexDirection: 'row', gap: 10 },
  listingField: { width: 110 },
  listingTag: { flex: 1 },
  label: { color: '#71675F', fontSize: 9, fontWeight: '900', letterSpacing: 0.7, marginTop: 14, marginBottom: 6 },
  input: { minHeight: 46, borderWidth: 1, borderColor: '#EADFD3', borderRadius: 12, paddingHorizontal: 12, color: '#271812', backgroundColor: '#FFF' },
  multiline: { minHeight: 76, paddingTop: 12, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  action: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 20, backgroundColor: ACCENT },
  actionSecondary: { borderWidth: 1, borderColor: '#D9C8BC', backgroundColor: '#FFF' },
  actionText: { color: '#FFF', fontSize: 11, fontWeight: '900' },
  actionSecondaryText: { color: '#8E2F1A' },
  disabled: { opacity: 0.55 },
});
