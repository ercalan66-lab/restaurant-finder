import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { formatBooking } from '@/data/booking';
import {
  getOrders,
  getReservations,
  paymentMethodLabel,
  recordCashPayment,
  type OrderRecord,
  type OrderStatus,
  type ReservationRecord,
  type ReservationStatus,
  updateOrderStatus,
  updateReservationStatus,
} from '@/data/guest-storage';
import { confirmAction, errorMessage, showMessage } from '@/utils/feedback';
import { onNotificationReceived } from '@/utils/push-notifications';
import { themedStyles } from '@/theme/theme';

const ORANGE = '#B93F1D';
const REFRESH_INTERVAL_MS = 30_000;

type Step = { next: OrderStatus; label: string };
const PICKUP_STEPS: Partial<Record<OrderStatus, Step>> = {
  pending: { next: 'accepted', label: 'Accept order' },
  accepted: { next: 'preparing', label: 'Start preparing' },
  preparing: { next: 'ready', label: 'Ready for pickup' },
  ready: { next: 'completed', label: 'Complete order' },
};
// Delivery orders are paid after they arrive, so "delivered" comes before "completed".
const DELIVERY_STEPS: Partial<Record<OrderStatus, Step>> = {
  pending: { next: 'accepted', label: 'Accept order' },
  accepted: { next: 'preparing', label: 'Start preparing' },
  preparing: { next: 'ready', label: 'Out for delivery' },
  ready: { next: 'delivered', label: 'Mark delivered' },
};
const DECLINABLE: OrderStatus[] = ['pending', 'accepted', 'preparing', 'ready'];

export function OwnerRequests({ restaurantId }: { restaurantId: number }) {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [reservations, setReservations] = useState<ReservationRecord[]>([]);
  const [active, setActive] = useState<'orders' | 'reservations'>('orders');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const [savedOrders, savedReservations] = await Promise.all([getOrders(), getReservations()]);
      setOrders(savedOrders.filter((order) => order.restaurantId === restaurantId));
      setReservations(savedReservations.filter((reservation) => reservation.restaurantId === restaurantId));
    } catch {
      if (!silent) showMessage('Could not load requests', 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    let active = true;
    Promise.all([getOrders(), getReservations()])
      .then(([savedOrders, savedReservations]) => {
        if (!active) return;
        setOrders(savedOrders.filter((order) => order.restaurantId === restaurantId));
        setReservations(savedReservations.filter((reservation) => reservation.restaurantId === restaurantId));
      })
      .catch(() => { if (active) showMessage('Could not load requests', 'Please try again.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [restaurantId]);

  // Stay current while the dashboard is open: on every notification and every 30 seconds.
  useEffect(() => {
    const stop = onNotificationReceived(() => void load({ silent: true }));
    const timer = setInterval(() => void load({ silent: true }), REFRESH_INTERVAL_MS);
    return () => { stop(); clearInterval(timer); };
  }, [load]);

  const run = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (error) {
      showMessage('Could not update the request', errorMessage(error));
    }
    await load({ silent: true });
  };

  const pendingOrders = orders.filter((order) => (order.status ?? 'pending') === 'pending').length;
  const pendingReservations = reservations.filter((reservation) => (reservation.status ?? 'pending') === 'pending').length;

  return <View style={styles.section}>
    <View style={styles.headingRow}><View style={styles.headingCopy}><Text style={styles.title}>Customer requests</Text><Text style={styles.helper}>Orders and table bookings sent to your restaurant.</Text></View><Pressable onPress={() => void load()}><Text style={styles.refresh}>{loading ? 'Loading…' : 'Refresh'}</Text></Pressable></View>
    <View style={styles.stats}><Stat label="NEW ORDERS" value={pendingOrders} /><Stat label="NEW BOOKINGS" value={pendingReservations} /><Stat label="TOTAL" value={orders.length + reservations.length} /></View>
    <View style={styles.tabs}>
      <Tab active={active === 'orders'} label={`Orders (${orders.length})`} onPress={() => setActive('orders')} />
      <Tab active={active === 'reservations'} label={`Reservations (${reservations.length})`} onPress={() => setActive('reservations')} />
    </View>
    {active === 'orders'
      ? orders.length ? orders.map((order) => <OrderCard key={order.id} order={order} run={run} />) : <Empty copy="New food orders will appear here." />
      : reservations.length ? reservations.map((reservation) => <ReservationCard key={reservation.id} reservation={reservation} run={run} />) : <Empty copy="New table requests will appear here." />}
  </View>;
}

type Run = (action: () => Promise<void>) => Promise<void>;

function orderStatusLabel(order: OrderRecord) {
  const status = order.status ?? 'pending';
  if (order.fulfillment === 'Delivery' && status === 'ready') return 'ON THE WAY';
  return status.toUpperCase();
}

function paymentLine(order: OrderRecord) {
  const amount = `TSh ${order.total.toLocaleString()}`;
  if (order.fulfillment !== 'Delivery') return `${amount} · customer pays at the counter`;
  if (order.paymentStatus === 'paid') {
    const test = order.paymentReference?.startsWith('SIM-') ? ' (test payment)' : '';
    return `${amount} · paid by ${paymentMethodLabel(order.paymentMethod)}${order.paymentReference ? ` · ${order.paymentReference}` : ''}${test}`;
  }
  if (order.status === 'delivered') return `${amount} · waiting for payment (mobile money or cash to the rider)`;
  return `${amount} · customer pays on delivery`;
}

function OrderCard({ order, run }: { order: OrderRecord; run: Run }) {
  const status = order.status ?? 'pending';
  const delivery = order.fulfillment === 'Delivery';
  const step = (delivery ? DELIVERY_STEPS : PICKUP_STEPS)[status];
  const awaitingCash = delivery && status === 'delivered' && order.paymentStatus !== 'paid';
  const amount = `TSh ${order.total.toLocaleString()}`;

  const decline = () => confirmAction('Decline this order?', `${order.guest.name} will be told the order was declined.`, 'Decline', () => void run(() => updateOrderStatus(order.id, 'declined')));
  const cashReceived = () => confirmAction('Cash received?', `Confirm the rider collected ${amount} in cash. This completes the order.`, 'Cash received', () => void run(() => recordCashPayment(order.id)));

  return <View style={styles.card}>
    <View style={styles.cardTop}><View style={styles.headingCopy}><Text style={styles.reference}>ORDER {order.id}</Text><Text style={styles.customer}>{order.guest.name}</Text></View><Status value={orderStatusLabel(order)} attention={status === 'pending' || status === 'declined' || status === 'cancelled' || awaitingCash} /></View>
    <Text style={styles.meta}>{order.fulfillment} · {order.guest.phone}</Text>
    {order.address ? <Text style={styles.meta}>{order.address}</Text> : null}
    <View style={styles.items}>{order.items.map((item) => <Text key={item.name} style={styles.item}>{item.quantity} × {item.name} · {item.price}</Text>)}</View>
    <Text style={[styles.payment, order.paymentStatus === 'paid' && styles.paymentDone]}>{paymentLine(order)}</Text>
    <View style={styles.actions}>
      {step && <Action label={step.label} onPress={() => void run(() => updateOrderStatus(order.id, step.next))} />}
      {awaitingCash && <Action label="Cash received" onPress={cashReceived} />}
      {DECLINABLE.includes(status) && <Action destructive label="Decline" onPress={decline} />}
    </View>
  </View>;
}

function ReservationCard({ reservation, run }: { reservation: ReservationRecord; run: Run }) {
  const status = reservation.status ?? 'pending';
  const setStatus = (next: ReservationStatus) => void run(() => updateReservationStatus(reservation.id, next));
  const decline = () => confirmAction('Decline this booking?', `${reservation.name} will be told the table could not be confirmed.`, 'Decline', () => setStatus('declined'));
  return <View style={styles.card}>
    <View style={styles.cardTop}><View style={styles.headingCopy}><Text style={styles.reference}>BOOKING {reservation.id}</Text><Text style={styles.customer}>{reservation.name}</Text></View><Status value={status.toUpperCase()} attention={status === 'pending' || status === 'declined' || status === 'cancelled'} /></View>
    <Text style={styles.meta}>{formatBooking(reservation.date, reservation.time)} · {reservation.guests} guest{reservation.guests === 1 ? '' : 's'}</Text>
    <Text style={styles.meta}>{reservation.phone}{reservation.email ? ` · ${reservation.email}` : ''}</Text>
    <View style={styles.actions}>
      {status === 'pending' && <Action label="Confirm booking" onPress={() => setStatus('confirmed')} />}
      {status === 'confirmed' && <Action label="Mark completed" onPress={() => setStatus('completed')} />}
      {(status === 'pending' || status === 'confirmed') && <Action destructive label="Decline" onPress={decline} />}
    </View>
  </View>;
}

function Stat({ label, value }: { label: string; value: number }) { return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>; }
function Tab({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}><Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text></Pressable>; }
function Status({ attention, value }: { attention: boolean; value: string }) { return <Text style={[styles.status, attention && styles.statusAttention]}>{value}</Text>; }
function Action({ destructive, label, onPress }: { destructive?: boolean; label: string; onPress: () => void }) { return <Pressable accessibilityRole="button" onPress={onPress} style={[styles.action, destructive && styles.actionSecondary]}><Text style={[styles.actionText, destructive && styles.actionSecondaryText]}>{label}</Text></Pressable>; }
function Empty({ copy }: { copy: string }) { return <View style={styles.empty}><Text style={styles.emptyTitle}>Nothing here yet</Text><Text style={styles.helper}>{copy}</Text></View>; }

const styles = themedStyles(({ bg, fg, line }) => ({
  section: { marginTop: 22, padding: 17, borderWidth: 1, borderColor: line('#EADFD3'), borderRadius: 22, backgroundColor: bg('#FFFDF9') }, headingRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }, headingCopy: { flex: 1 }, title: { color: fg('#271812'), fontSize: 20, fontWeight: '900' }, helper: { color: fg('#71675F'), fontSize: 12, lineHeight: 18, marginTop: 5 }, refresh: { color: fg(ORANGE), fontSize: 11, fontWeight: '900', paddingVertical: 5 }, stats: { flexDirection: 'row', gap: 8, marginTop: 15 }, stat: { flex: 1, padding: 11, borderRadius: 13, backgroundColor: bg('#FFF3E9') }, statValue: { color: fg('#271812'), fontSize: 21, fontWeight: '900' }, statLabel: { color: fg('#8A7164'), fontSize: 7, fontWeight: '900', marginTop: 3 }, tabs: { flexDirection: 'row', padding: 4, borderRadius: 16, backgroundColor: bg('#F4EAE1'), marginTop: 16 }, tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12 }, tabActive: { backgroundColor: bg('#FFF') }, tabText: { color: fg('#7B7068'), fontSize: 11, fontWeight: '800' }, tabTextActive: { color: fg(ORANGE) }, card: { padding: 14, borderWidth: 1, borderColor: line('#EADFD3'), borderRadius: 16, backgroundColor: bg('#FFF'), marginTop: 12 }, cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }, reference: { color: fg(ORANGE), fontSize: 8, fontWeight: '900', letterSpacing: 0.7 }, customer: { color: fg('#271812'), fontSize: 16, fontWeight: '900', marginTop: 3 }, status: { color: fg('#28734D'), backgroundColor: bg('#E8F5ED'), borderRadius: 9, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 4, fontSize: 7, fontWeight: '900' }, statusAttention: { color: fg('#8E2F1A'), backgroundColor: bg('#F5D8D1') }, meta: { color: fg('#71675F'), fontSize: 11, lineHeight: 17, marginTop: 6 }, items: { paddingVertical: 8, marginTop: 7, borderTopWidth: 1, borderTopColor: line('#F0E7DE') }, item: { color: fg('#4E453F'), fontSize: 11, lineHeight: 18 }, payment: { color: fg(ORANGE), fontSize: 12, fontWeight: '800', lineHeight: 17 }, paymentDone: { color: fg('#28734D') }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }, action: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 20, backgroundColor: bg(ORANGE) }, actionSecondary: { borderWidth: 1, borderColor: line('#D9C8BC'), backgroundColor: bg('#FFF') }, actionText: { color: fg('#FFF'), fontSize: 10, fontWeight: '900' }, actionSecondaryText: { color: fg('#8E2F1A') }, empty: { alignItems: 'center', padding: 22, marginTop: 12, borderRadius: 15, backgroundColor: bg('#FFF8EE') }, emptyTitle: { color: fg('#271812'), fontSize: 15, fontWeight: '900' },
}));
