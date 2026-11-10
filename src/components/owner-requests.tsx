import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  getOrders,
  getReservations,
  type OrderRecord,
  type OrderStatus,
  type ReservationRecord,
  type ReservationStatus,
  updateOrderStatus,
  updateReservationStatus,
} from '@/data/guest-storage';

const ORANGE = '#B93F1D';

export function OwnerRequests({ restaurantName }: { restaurantName: string }) {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [reservations, setReservations] = useState<ReservationRecord[]>([]);
  const [active, setActive] = useState<'orders' | 'reservations'>('orders');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [savedOrders, savedReservations] = await Promise.all([getOrders(), getReservations()]);
      const matches = (name: string) => name.trim().toLowerCase() === restaurantName.trim().toLowerCase();
      setOrders(savedOrders.filter((order) => matches(order.restaurantName)));
      setReservations(savedReservations.filter((reservation) => matches(reservation.restaurantName)));
    } catch {
      Alert.alert('Could not load requests', 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [restaurantName]);

  useEffect(() => {
    let active = true;
    const matches = (name: string) => name.trim().toLowerCase() === restaurantName.trim().toLowerCase();
    Promise.all([getOrders(), getReservations()])
      .then(([savedOrders, savedReservations]) => {
        if (!active) return;
        setOrders(savedOrders.filter((order) => matches(order.restaurantName)));
        setReservations(savedReservations.filter((reservation) => matches(reservation.restaurantName)));
      })
      .catch(() => { if (active) Alert.alert('Could not load requests', 'Please try again.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [restaurantName]);

  const setOrderStatus = async (id: string, status: OrderStatus) => {
    await updateOrderStatus(id, status);
    await load();
  };

  const setReservationStatus = async (id: string, status: ReservationStatus) => {
    await updateReservationStatus(id, status);
    await load();
  };

  const pendingOrders = orders.filter((order) => (order.status ?? 'pending') === 'pending').length;
  const pendingReservations = reservations.filter((reservation) => (reservation.status ?? 'pending') === 'pending').length;

  return <View style={styles.section}>
    <View style={styles.headingRow}><View><Text style={styles.title}>Customer requests</Text><Text style={styles.helper}>Manage orders and table bookings from this device.</Text></View><Pressable onPress={() => void load()}><Text style={styles.refresh}>{loading ? 'Loading…' : 'Refresh'}</Text></Pressable></View>
    <View style={styles.stats}><Stat label="NEW ORDERS" value={pendingOrders} /><Stat label="NEW BOOKINGS" value={pendingReservations} /><Stat label="TOTAL" value={orders.length + reservations.length} /></View>
    <View style={styles.tabs}>
      <Tab active={active === 'orders'} label={`Orders (${orders.length})`} onPress={() => setActive('orders')} />
      <Tab active={active === 'reservations'} label={`Reservations (${reservations.length})`} onPress={() => setActive('reservations')} />
    </View>
    {active === 'orders'
      ? orders.length ? orders.map((order) => <OrderCard key={order.id} order={order} onStatus={setOrderStatus} />) : <Empty copy="New food orders will appear here." />
      : reservations.length ? reservations.map((reservation) => <ReservationCard key={reservation.id} reservation={reservation} onStatus={setReservationStatus} />) : <Empty copy="New table requests will appear here." />}
  </View>;
}

function OrderCard({ order, onStatus }: { order: OrderRecord; onStatus: (id: string, status: OrderStatus) => Promise<void> }) {
  const status = order.status ?? 'pending';
  const next: Partial<Record<OrderStatus, OrderStatus>> = { pending: 'accepted', accepted: 'preparing', preparing: 'ready', ready: 'completed' };
  const labels: Partial<Record<OrderStatus, string>> = { accepted: 'Accept order', preparing: 'Start preparing', ready: 'Mark ready', completed: 'Complete order' };
  const nextStatus = next[status];
  return <View style={styles.card}>
    <View style={styles.cardTop}><View><Text style={styles.reference}>ORDER {order.id}</Text><Text style={styles.customer}>{order.guest.name}</Text></View><Status value={status} /></View>
    <Text style={styles.meta}>{order.fulfillment} · {order.guest.phone}</Text>
    {order.address ? <Text style={styles.meta}>{order.address}</Text> : null}
    <View style={styles.items}>{order.items.map((item) => <Text key={item.name} style={styles.item}>{item.quantity} × {item.name} · {item.price}</Text>)}</View>
    <Text style={styles.total}>TSh {order.total.toLocaleString()}</Text>
    <View style={styles.actions}>{nextStatus && <Action label={labels[nextStatus] ?? 'Update'} onPress={() => void onStatus(order.id, nextStatus)} />}{status !== 'completed' && status !== 'declined' && <Action destructive label="Decline" onPress={() => void onStatus(order.id, 'declined')} />}</View>
  </View>;
}

function ReservationCard({ reservation, onStatus }: { reservation: ReservationRecord; onStatus: (id: string, status: ReservationStatus) => Promise<void> }) {
  const status = reservation.status ?? 'pending';
  return <View style={styles.card}>
    <View style={styles.cardTop}><View><Text style={styles.reference}>BOOKING {reservation.id}</Text><Text style={styles.customer}>{reservation.name}</Text></View><Status value={status} /></View>
    <Text style={styles.meta}>{reservation.date} at {reservation.time} · {reservation.guests} guest{reservation.guests === 1 ? '' : 's'}</Text>
    <Text style={styles.meta}>{reservation.phone}{reservation.email ? ` · ${reservation.email}` : ''}</Text>
    <View style={styles.actions}>{status === 'pending' && <Action label="Confirm booking" onPress={() => void onStatus(reservation.id, 'confirmed')} />}{status === 'confirmed' && <Action label="Mark completed" onPress={() => void onStatus(reservation.id, 'completed')} />}{status !== 'completed' && status !== 'declined' && <Action destructive label="Decline" onPress={() => void onStatus(reservation.id, 'declined')} />}</View>
  </View>;
}

function Stat({ label, value }: { label: string; value: number }) { return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>; }
function Tab({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}><Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text></Pressable>; }
function Status({ value }: { value: string }) { return <Text style={[styles.status, (value === 'declined' || value === 'pending') && styles.statusAttention]}>{value.toUpperCase()}</Text>; }
function Action({ destructive, label, onPress }: { destructive?: boolean; label: string; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.action, destructive && styles.actionSecondary]}><Text style={[styles.actionText, destructive && styles.actionSecondaryText]}>{label}</Text></Pressable>; }
function Empty({ copy }: { copy: string }) { return <View style={styles.empty}><Text style={styles.emptyTitle}>Nothing here yet</Text><Text style={styles.helper}>{copy}</Text></View>; }

const styles = StyleSheet.create({
  section: { marginTop: 22, padding: 17, borderWidth: 1, borderColor: '#EADFD3', borderRadius: 22, backgroundColor: '#FFFDF9' }, headingRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }, title: { color: '#271812', fontSize: 20, fontWeight: '900' }, helper: { color: '#71675F', fontSize: 12, lineHeight: 18, marginTop: 5 }, refresh: { color: ORANGE, fontSize: 11, fontWeight: '900', paddingVertical: 5 }, stats: { flexDirection: 'row', gap: 8, marginTop: 15 }, stat: { flex: 1, padding: 11, borderRadius: 13, backgroundColor: '#FFF3E9' }, statValue: { color: '#271812', fontSize: 21, fontWeight: '900' }, statLabel: { color: '#8A7164', fontSize: 7, fontWeight: '900', marginTop: 3 }, tabs: { flexDirection: 'row', padding: 4, borderRadius: 16, backgroundColor: '#F4EAE1', marginTop: 16 }, tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12 }, tabActive: { backgroundColor: '#FFF' }, tabText: { color: '#7B7068', fontSize: 11, fontWeight: '800' }, tabTextActive: { color: ORANGE }, card: { padding: 14, borderWidth: 1, borderColor: '#EADFD3', borderRadius: 16, backgroundColor: '#FFF', marginTop: 12 }, cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }, reference: { color: ORANGE, fontSize: 8, fontWeight: '900', letterSpacing: 0.7 }, customer: { color: '#271812', fontSize: 16, fontWeight: '900', marginTop: 3 }, status: { color: '#28734D', backgroundColor: '#E8F5ED', borderRadius: 9, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 4, fontSize: 7, fontWeight: '900' }, statusAttention: { color: '#8E2F1A', backgroundColor: '#F5D8D1' }, meta: { color: '#71675F', fontSize: 11, lineHeight: 17, marginTop: 6 }, items: { paddingVertical: 8, marginTop: 7, borderTopWidth: 1, borderTopColor: '#F0E7DE' }, item: { color: '#4E453F', fontSize: 11, lineHeight: 18 }, total: { color: ORANGE, fontSize: 14, fontWeight: '900' }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }, action: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 20, backgroundColor: ORANGE }, actionSecondary: { borderWidth: 1, borderColor: '#D9C8BC', backgroundColor: '#FFF' }, actionText: { color: '#FFF', fontSize: 10, fontWeight: '900' }, actionSecondaryText: { color: '#8E2F1A' }, empty: { alignItems: 'center', padding: 22, marginTop: 12, borderRadius: 15, backgroundColor: '#FFF8EE' }, emptyTitle: { color: '#271812', fontSize: 15, fontWeight: '900' },
});
