import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { findOrders, type AdminOrder } from '@/data/admin';
import { paymentSummary } from '@/data/guest-storage';
import { errorMessage } from '@/utils/feedback';

import { adminStyles, Badge, Empty, formatMoney, formatWhen, LoadError, SearchField, SectionHeading, type Loadable } from './admin-ui';

const ATTENTION = new Set(['pending', 'declined', 'cancelled']);

const loadRequests = (search: string): Promise<Loadable<AdminOrder[]>> =>
  findOrders(search).then((value) => ({ kind: 'ready' as const, value }), (error: unknown) => ({ kind: 'error' as const, message: errorMessage(error) }));

export function RequestsSection() {
  const [state, setState] = useState<Loadable<AdminOrder[]>>({ kind: 'loading' });
  const [query, setQuery] = useState('');
  // The search the list currently shows, so refreshing keeps it.
  const [shownSearch, setShownSearch] = useState('');

  useFocusEffect(useCallback(() => {
    let active = true;
    void loadRequests(shownSearch).then((result) => { if (active) setState(result); });
    return () => { active = false; };
  }, [shownSearch]));

  const search = (text = query) => {
    const next = text.trim();
    setState({ kind: 'loading' });
    // A new search term reloads through the focus effect above; the same term is reloaded here.
    if (next === shownSearch) void loadRequests(next).then(setState);
    else setShownSearch(next);
  };
  const clear = () => { setQuery(''); search(''); };

  const orders = state.kind === 'ready' ? state.value : [];

  return <View>
    <SectionHeading helper="Look up any order to help a customer or a restaurant. Restaurants still accept, decline and complete their own orders." loading={state.kind === 'loading'} onRefresh={() => search(shownSearch)} title="Orders" />
    <SearchField onChangeText={setQuery} onSubmit={() => search()} placeholder="Reference, customer, phone or restaurant" value={query} />
    <View style={adminStyles.actions}>
      <Pressable accessibilityRole="button" onPress={() => search()} style={adminStyles.action}><Text style={adminStyles.actionText}>Search</Text></Pressable>
      {shownSearch ? <Pressable accessibilityRole="button" onPress={clear} style={[adminStyles.action, adminStyles.actionSecondary]}><Text style={[adminStyles.actionText, adminStyles.actionSecondaryText]}>Show latest</Text></Pressable> : null}
    </View>
    {state.kind === 'ready' && shownSearch ? <Text style={adminStyles.meta}>Matches for “{shownSearch}” · newest 40</Text> : null}
    {state.kind === 'ready' && !shownSearch ? <Text style={adminStyles.meta}>Newest 40 across all restaurants</Text> : null}
    {state.kind === 'error' && <LoadError message={state.message} onRetry={() => search(shownSearch)} />}
    {state.kind === 'ready' && (orders.length === 0
      ? <Empty copy={shownSearch ? 'Check the reference or phone number and try again.' : 'Orders appear here as customers place them.'} title={shownSearch ? 'No matches' : 'Nothing yet'} />
      : orders.map((order) => <OrderCard key={order.reference} order={order} />))}
  </View>;
}

function orderStatusLabel(order: AdminOrder) {
  if (order.fulfillment === 'Delivery' && order.status === 'ready') return 'ON THE WAY';
  return order.status.toUpperCase();
}

function Customer({ name, phone }: { name: string; phone: string }) {
  return <Text style={adminStyles.meta}>
    {name}
    {phone ? <>
      {' · '}
      <Text accessibilityHint="Calls the customer" accessibilityRole="link" onPress={() => void Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`)} style={adminStyles.link}>{phone}</Text>
    </> : null}
  </Text>;
}

function RestaurantLink({ id, name }: { id: number; name: string }) {
  return <Pressable onPress={() => router.push(`/restaurant/${id}` as Href)}><Text style={adminStyles.link}>{name} ›</Text></Pressable>;
}

function OrderCard({ order }: { order: AdminOrder }) {
  return <View style={adminStyles.card}>
    <View style={adminStyles.cardTop}>
      <View style={adminStyles.cardCopy}>
        <Text selectable style={adminStyles.eyebrow}>ORDER {order.reference}</Text>
        <Text style={adminStyles.name}>{formatMoney(order.total)} · {order.fulfillment}</Text>
      </View>
      <Badge attention={ATTENTION.has(order.status)} label={orderStatusLabel(order)} />
    </View>
    <Customer name={order.customerName} phone={order.customerPhone} />
    <Text style={adminStyles.meta}>{paymentSummary(order)} · placed {formatWhen(order.createdAt)}</Text>
    <RestaurantLink id={order.restaurantId} name={order.restaurantName} />
  </View>;
}
