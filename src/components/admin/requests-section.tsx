import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, TextInput, View } from 'react-native';

import { AUTO_CANCEL_MINUTES, cancelOrder, fetchOrderDetails, findOrders, minutesWaiting, WAITING_ALERT_MINUTES, type AdminOrder, type AdminOrderDetails } from '@/data/admin';
import { paymentSummary } from '@/data/guest-storage';
import { confirmAction, errorMessage, showMessage } from '@/utils/feedback';
import { themedStyles } from '@/theme/theme';

import { ACCENT, Action, adminStyles, Badge, Empty, formatMoney, formatWhen, LoadError, SearchField, SectionHeading, type Loadable } from './admin-ui';

const ATTENTION = new Set(['pending', 'declined', 'cancelled']);
/** Orders an admin may still cancel. */
const OPEN = new Set(['pending', 'accepted', 'preparing', 'ready', 'delivered']);

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
  const reload = () => void loadRequests(shownSearch).then(setState);

  const orders = state.kind === 'ready' ? state.value : [];

  return <View>
    <SectionHeading helper={`Look up any order to help a customer or a restaurant. Tap an order to see everything in it. Restaurants still accept, decline and complete their own orders; orders nobody answers are cancelled after ${AUTO_CANCEL_MINUTES} minutes.`} loading={state.kind === 'loading'} onRefresh={() => search(shownSearch)} title="Orders" />
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
      : orders.map((order) => <OrderCard key={order.reference} onChanged={reload} order={order} />))}
  </View>;
}

function orderStatusLabel(status: string, fulfillment: string) {
  if (fulfillment === 'Delivery' && status === 'ready') return 'ON THE WAY';
  return status.toUpperCase();
}

const callNumber = (phone: string) => void Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`);

function Customer({ name, phone }: { name: string; phone: string }) {
  return <Text style={adminStyles.meta}>
    {name}
    {phone ? <>
      {' · '}
      <Text accessibilityHint="Calls the customer" accessibilityRole="link" onPress={() => callNumber(phone)} style={adminStyles.link}>{phone}</Text>
    </> : null}
  </Text>;
}

function RestaurantLink({ id, name }: { id: number; name: string }) {
  return <Pressable onPress={() => router.push(`/restaurant/${id}` as Href)}><Text style={adminStyles.link}>{name} ›</Text></Pressable>;
}

/** One order: tap to open its dishes, address and history, and to cancel it. Also used on the admin restaurant page. */
export function OrderCard({ onChanged, order }: { onChanged: () => void; order: AdminOrder }) {
  const [open, setOpen] = useState(false);
  const waited = minutesWaiting(order);
  const late = waited !== null && waited >= WAITING_ALERT_MINUTES;

  return <View style={[adminStyles.card, late && styles.cardLate]}>
    <Pressable accessibilityHint={open ? 'Hides the order details' : 'Shows the dishes, address and more'} accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((current) => !current)}>
      <View style={adminStyles.cardTop}>
        <View style={adminStyles.cardCopy}>
          <Text selectable style={adminStyles.eyebrow}>ORDER {order.reference}</Text>
          <Text style={adminStyles.name}>{formatMoney(order.total)} · {order.fulfillment}</Text>
        </View>
        <View style={styles.badges}>
          <Badge attention={ATTENTION.has(order.status)} label={orderStatusLabel(order.status, order.fulfillment)} />
          {late && <Badge attention label={`NO ANSWER · ${waited} MIN`} />}
        </View>
      </View>
      <Text style={adminStyles.meta}>{paymentSummary(order)} · placed {formatWhen(order.createdAt)}</Text>
    </Pressable>
    <Customer name={order.customerName} phone={order.customerPhone} />
    <RestaurantLink id={order.restaurantId} name={order.restaurantName} />
    <Pressable accessibilityRole="button" onPress={() => setOpen((current) => !current)}><Text style={adminStyles.link}>{open ? 'Hide details ▴' : 'Show details ▾'}</Text></Pressable>
    {open && <OrderDetails onChanged={onChanged} reference={order.reference} />}
  </View>;
}

function OrderDetails({ onChanged, reference }: { onChanged: () => void; reference: string }) {
  const [state, setState] = useState<Loadable<AdminOrderDetails>>({ kind: 'loading' });
  // Bumped to load the details again (after cancelling, or "Try again").
  const [version, setVersion] = useState(0);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetchOrderDetails(reference)
      .then((value) => { if (active) setState({ kind: 'ready', value }); })
      .catch((error: unknown) => { if (active) setState({ kind: 'error', message: errorMessage(error) }); });
    return () => { active = false; };
  }, [reference, version]);
  const load = () => { setState({ kind: 'loading' }); setVersion((current) => current + 1); };

  if (state.kind === 'loading') return <ActivityIndicator color={ACCENT} style={styles.spinner} />;
  if (state.kind === 'error') return <LoadError message={state.message} onRetry={load} />;
  const order = state.value;

  const cancel = () => {
    if (!reason.trim()) return showMessage('Add a reason', 'Tell the customer why the order is cancelled. The restaurant sees it too.');
    confirmAction('Cancel this order?', `Order ${order.reference} will be cancelled. ${order.customerName} and ${order.restaurantName} will be told: “${reason.trim()}”`, 'Cancel order', () => void (async () => {
      setBusy(true);
      try {
        await cancelOrder(order.reference, reason);
        setAsking(false);
        setReason('');
        load();
        onChanged();
      } catch (error) {
        showMessage('Could not cancel the order', errorMessage(error));
      } finally {
        setBusy(false);
      }
    })());
  };

  return <View style={styles.details}>
    <Text style={adminStyles.label}>DISHES</Text>
    {order.items.map((item, index) => <Text key={`${item.name}-${index}`} style={styles.item}>{item.quantity} × {item.name}  ·  {item.price}</Text>)}
    <Text style={styles.total}>Total {formatMoney(order.total)}</Text>

    <Text style={adminStyles.label}>{order.fulfillment === 'Delivery' ? 'DELIVER TO' : 'PICKUP'}</Text>
    <Text selectable style={adminStyles.meta}>{order.fulfillment === 'Delivery' ? order.deliveryAddress || 'No address given' : `Collected at ${order.restaurantName}`}</Text>

    <Text style={adminStyles.label}>CUSTOMER</Text>
    <Text selectable style={adminStyles.meta}>{[order.customerName, order.customerPhone, order.customerEmail].filter(Boolean).join(' · ')}</Text>
    <Text style={adminStyles.meta}>{order.signedIn ? 'Ordered while signed in' : 'Ordered as a guest'}</Text>

    <Text style={adminStyles.label}>RESTAURANT</Text>
    <Text style={adminStyles.meta}>
      {order.restaurantName}
      {order.restaurantPhone ? <>{' · '}<Text accessibilityHint="Calls the restaurant" accessibilityRole="link" onPress={() => callNumber(order.restaurantPhone)} style={adminStyles.link}>{order.restaurantPhone}</Text></> : null}
    </Text>

    <Text style={adminStyles.label}>HISTORY</Text>
    <Text style={adminStyles.meta}>Placed {formatWhen(order.createdAt)} · last change {formatWhen(order.updatedAt)}</Text>
    {order.remindedAt ? <Text style={adminStyles.meta}>Restaurant reminded {formatWhen(order.remindedAt)} after {WAITING_ALERT_MINUTES} minutes without an answer</Text> : null}
    {order.paidAt ? <Text style={adminStyles.meta}>Cash received {formatWhen(order.paidAt)}</Text> : null}
    {order.status === 'cancelled' && <Text style={styles.cancelled}>{cancelledText(order)}</Text>}

    {OPEN.has(order.status) && (asking
      ? <View>
        <Text style={adminStyles.label}>WHY ARE YOU CANCELLING IT?</Text>
        <TextInput editable={!busy} maxLength={300} multiline onChangeText={setReason} placeholder="For example: the restaurant is closed today. Please order from another restaurant." style={[adminStyles.input, adminStyles.multiline]} value={reason} />
        <Text style={adminStyles.meta}>The customer and the restaurant both get this message.</Text>
        <View style={adminStyles.actions}>
          <Action disabled={busy} label={busy ? 'Cancelling…' : 'Cancel order'} onPress={cancel} />
          <Action disabled={busy} label="Keep the order" onPress={() => { setAsking(false); setReason(''); }} secondary />
        </View>
      </View>
      : <View style={adminStyles.actions}><Action label="Cancel this order" onPress={() => setAsking(true)} secondary /></View>)}
  </View>;
}

function cancelledText(order: AdminOrderDetails) {
  if (order.cancelledBy === 'timeout') return `Cancelled automatically: the restaurant did not answer within ${AUTO_CANCEL_MINUTES} minutes.`;
  if (order.cancelledBy === 'admin') return `Cancelled by a Kwetu admin: ${order.cancelReason || 'no reason given'}`;
  return 'Cancelled by the customer.';
}

const styles = themedStyles(({ bg, fg, line }) => ({
  cardLate: { borderColor: line('#F0B9A8'), backgroundColor: bg('#FFF6F3') },
  badges: { alignItems: 'flex-end', gap: 4 },
  details: { marginTop: 8, paddingTop: 4, borderTopWidth: 1, borderTopColor: line('#F2EAE0') },
  item: { color: fg('#271812'), fontSize: 13, lineHeight: 20 },
  total: { color: fg('#271812'), fontSize: 13, fontWeight: '900', marginTop: 4 },
  cancelled: { color: fg('#8E2F1A'), fontSize: 12, lineHeight: 18, marginTop: 8, padding: 10, borderRadius: 10, backgroundColor: bg('#FBE9E5') },
  spinner: { marginVertical: 16 },
}));
