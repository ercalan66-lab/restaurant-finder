import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { fetchRestaurantsForReview, reviewRestaurant, updateListing } from '@/data/admin';
import type { ApprovalStatus, RestaurantSummary } from '@/data/restaurants';
import { errorMessage } from '@/utils/feedback';

import { Action, adminStyles, Chips, Empty, LoadError, SearchField, SectionHeading, type Loadable } from './admin-ui';

const loadRestaurants = (): Promise<Loadable<RestaurantSummary[]>> =>
  fetchRestaurantsForReview().then((value) => ({ kind: 'ready' as const, value }), (error: unknown) => ({ kind: 'error' as const, message: errorMessage(error) }));

const matches = (restaurant: RestaurantSummary, query: string) => {
  const text = query.trim().toLowerCase().replace(/^#/, '');
  if (!text) return true;
  return [restaurant.name, restaurant.area, restaurant.cuisine, restaurant.address, String(restaurant.id)].some((value) => value.toLowerCase().includes(text));
};

type Props = { onTabChange: (tab: ApprovalStatus) => void; tab: ApprovalStatus };

export function RestaurantsSection({ onTabChange, tab }: Props) {
  const [state, setState] = useState<Loadable<RestaurantSummary[]>>({ kind: 'loading' });
  const [query, setQuery] = useState('');

  // Reload on focus too, so changes made on a restaurant page show up on return.
  useFocusEffect(useCallback(() => {
    let active = true;
    void loadRestaurants().then((result) => { if (active) setState(result); });
    return () => { active = false; };
  }, []));

  const reload = () => void loadRestaurants().then(setState);

  const restaurants = state.kind === 'ready' ? state.value : [];
  const count = (status: ApprovalStatus) => restaurants.filter((restaurant) => restaurant.approvalStatus === status).length;
  const visible = restaurants.filter((restaurant) => restaurant.approvalStatus === tab && matches(restaurant, query));

  return <View>
    <SectionHeading helper="Approve new restaurants before customers can see them, and keep ratings and tags up to date." loading={state.kind === 'loading'} onRefresh={reload} title="Restaurants" />
    <Chips
      onChange={onTabChange}
      options={[
        { value: 'pending', label: `Waiting (${count('pending')})` },
        { value: 'approved', label: `Live (${count('approved')})` },
        { value: 'rejected', label: `Changes requested (${count('rejected')})` },
      ]}
      value={tab}
    />
    <SearchField onChangeText={setQuery} placeholder="Search by name, area, cuisine or #number" value={query} />
    {state.kind === 'error' && <LoadError message={state.message} onRetry={reload} />}
    {state.kind === 'ready' && (visible.length === 0
      ? <Empty
        copy={query.trim() ? 'Try another name, area or number.' : tab === 'pending' ? 'New restaurants appear here when owners create them.' : 'Restaurants move here as you review them.'}
        title={query.trim() ? 'No matches' : tab === 'pending' ? 'Nothing to review' : 'None here'}
      />
      : visible.map((restaurant) => <ReviewCard key={restaurant.id} onChanged={reload} restaurant={restaurant} />))}
  </View>;
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

  return <View style={adminStyles.card}>
    <View style={adminStyles.cardTop}>
      <View style={adminStyles.cardCopy}><Text style={adminStyles.name}>{restaurant.name}</Text><Text style={adminStyles.meta}>{restaurant.cuisine} · {restaurant.area} · #{restaurant.id}</Text></View>
      {!restaurant.isActive && <Text style={styles.hidden}>HIDDEN BY OWNER</Text>}
    </View>
    <Text style={adminStyles.meta}>{restaurant.address}</Text>
    {restaurant.phone || restaurant.email ? <Text selectable style={adminStyles.meta}>{[restaurant.phone, restaurant.email].filter(Boolean).join(' · ')}</Text> : null}
    {restaurant.description ? <Text style={styles.description}>{restaurant.description}</Text> : null}
    {restaurant.approvalStatus === 'rejected' && restaurant.rejectionReason ? <Text style={styles.reason}>Asked for: {restaurant.rejectionReason}</Text> : null}
    <Pressable onPress={() => router.push(`/restaurant/${restaurant.id}` as Href)}><Text style={adminStyles.link}>View the restaurant page ›</Text></Pressable>

    {restaurant.approvalStatus === 'approved' && <View style={styles.listing}>
      <View style={styles.listingField}><Text style={adminStyles.label}>RATING (0–5)</Text><TextInput editable={!busy} keyboardType="decimal-pad" onChangeText={setRating} placeholder="4.6" style={adminStyles.input} value={rating} /></View>
      <View style={[styles.listingField, styles.listingTag]}><Text style={adminStyles.label}>TAG</Text><TextInput editable={!busy} maxLength={24} onChangeText={setTag} placeholder="Bestseller" style={adminStyles.input} value={tag} /></View>
    </View>}

    {asking && <View><Text style={adminStyles.label}>WHAT NEEDS TO CHANGE?</Text><TextInput editable={!busy} multiline onChangeText={setReason} placeholder="For example: add a cover photo and at least three dishes." style={[adminStyles.input, adminStyles.multiline]} value={reason} /></View>}

    <View style={adminStyles.actions}>
      {restaurant.approvalStatus !== 'approved' && !asking && <Action disabled={busy} label="Approve" onPress={() => void approve()} />}
      {restaurant.approvalStatus === 'approved' && <Action disabled={busy} label="Save rating & tag" onPress={() => void saveListing()} />}
      {asking
        ? <><Action disabled={busy} label="Send to owner" onPress={() => void requestChanges()} /><Action disabled={busy} label="Cancel" onPress={() => setAsking(false)} secondary /></>
        : restaurant.approvalStatus !== 'rejected' && <Action disabled={busy} label={restaurant.approvalStatus === 'approved' ? 'Unpublish' : 'Request changes'} onPress={() => setAsking(true)} secondary />}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  description: { color: '#4E453F', fontSize: 12, lineHeight: 18, marginTop: 8 },
  reason: { color: '#8E2F1A', fontSize: 12, lineHeight: 18, marginTop: 8, padding: 10, borderRadius: 10, backgroundColor: '#FBE9E5' },
  hidden: { color: '#6B5A30', backgroundColor: '#FFF7DE', borderRadius: 9, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 4, fontSize: 8, fontWeight: '900' },
  listing: { flexDirection: 'row', gap: 10 },
  listingField: { width: 110 },
  listingTag: { flex: 1 },
});
