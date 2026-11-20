import { router, type Href } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatBooking } from '@/data/booking';
import {
  canCancelOrder,
  canCancelReservation,
  canPayInApp,
  cancelOrder,
  cancelReservation,
  paymentSummary,
  type OrderRecord,
  type ReservationRecord,
} from '@/data/guest-storage';
import { confirmAction, errorMessage } from '@/utils/feedback';

const ORANGE = '#ED6417';
const SHOWN = 8;

type Tone = 'ok' | 'waiting' | 'action' | 'bad';

function orderStatus(order: OrderRecord): { label: string; tone: Tone } {
  if (order.rejectedReason) return { label: 'NOT ACCEPTED', tone: 'bad' };
  switch (order.status ?? 'pending') {
    case 'pending': return { label: 'SENT', tone: 'waiting' };
    case 'accepted': return { label: 'ACCEPTED', tone: 'ok' };
    case 'preparing': return { label: 'PREPARING', tone: 'ok' };
    case 'ready': return { label: order.fulfillment === 'Delivery' ? 'ON THE WAY' : 'READY FOR PICKUP', tone: 'ok' };
    case 'delivered': return order.paymentStatus === 'paid' ? { label: 'DELIVERED', tone: 'ok' } : { label: 'ARRIVED · PAY NOW', tone: 'action' };
    case 'completed': return { label: 'COMPLETED', tone: 'ok' };
    case 'declined': return { label: 'DECLINED', tone: 'bad' };
    case 'cancelled': return { label: 'CANCELLED', tone: 'bad' };
  }
}

function reservationStatus(reservation: ReservationRecord): { label: string; tone: Tone } {
  if (reservation.rejectedReason) return { label: 'NOT ACCEPTED', tone: 'bad' };
  switch (reservation.status ?? 'pending') {
    case 'pending': return { label: 'REQUESTED', tone: 'waiting' };
    case 'confirmed': return { label: 'CONFIRMED', tone: 'ok' };
    case 'completed': return { label: 'COMPLETED', tone: 'ok' };
    case 'declined': return { label: 'DECLINED', tone: 'bad' };
    case 'cancelled': return { label: 'CANCELLED', tone: 'bad' };
  }
}

/** The customer's orders and bookings, with Pay, Cancel and Rate where allowed. */
export function ActivitySection({ loading, onChanged, orders, reservations, reviewed, signedIn }: {
  loading: boolean;
  onChanged: () => void;
  orders: OrderRecord[];
  reservations: ReservationRecord[];
  /** References of completed requests that already have a review. */
  reviewed: Set<string>;
  signedIn: boolean;
}) {
  const rateButton = (reference: string, completed: boolean) => {
    if (!completed) return null;
    if (reviewed.has(reference)) return <Text style={styles.reviewed}>★ Reviewed</Text>;
    return <Action label="Rate your visit" onPress={() => router.push(`/review/${reference}` as Href)} />;
  };
  const run = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (error) {
      Alert.alert('Could not cancel', errorMessage(error));
    }
    onChanged();
  };

  const confirmCancelOrder = (order: OrderRecord) => confirmAction('Cancel this order?', `${order.restaurantName} will be told you cancelled order ${order.id}.`, 'Cancel order', () => void run(() => cancelOrder(order)));
  const confirmCancelReservation = (reservation: ReservationRecord) => confirmAction('Cancel this booking?', `${reservation.restaurantName} will be told you no longer need the table for ${formatBooking(reservation.date, reservation.time)}.`, 'Cancel booking', () => void run(() => cancelReservation(reservation)));

  return <View style={styles.section}>
    <Text style={styles.title}>Your activity</Text>
    <Text style={styles.copy}>{signedIn ? 'Requests from this account and phone. Updates every few seconds.' : 'Requests made on this phone. Updates every few seconds.'}</Text>
    {loading ? <Text style={styles.empty}>Loading activity…</Text> : <>
      <Text style={styles.label}>ORDERS</Text>
      {orders.length ? orders.slice(0, SHOWN).map((order) => {
        const status = orderStatus(order);
        return <Card key={order.id} name={order.restaurantName} note={order.rejectedReason ?? (order.synced === false ? 'Not sent to the restaurant yet. It will be sent when you are online.' : undefined)} reference={order.id} status={status}
          meta={`TSh ${order.total.toLocaleString()} · ${order.fulfillment} · ${paymentSummary(order)}`}>
          {canPayInApp(order) && <Action label={`Pay TSh ${order.total.toLocaleString()}`} onPress={() => router.push(`/pay/${order.id}` as Href)} />}
          {canCancelOrder(order) && <Action label="Cancel order" onPress={() => confirmCancelOrder(order)} secondary />}
          {rateButton(order.id, order.status === 'completed' && !order.rejectedReason)}
        </Card>;
      }) : <Text style={styles.empty}>No food orders yet.</Text>}
      <Text style={styles.label}>RESERVATIONS</Text>
      {reservations.length ? reservations.slice(0, SHOWN).map((reservation) => <Card key={reservation.id} name={reservation.restaurantName}
        note={reservation.rejectedReason ?? (reservation.synced === false ? 'Not sent to the restaurant yet. It will be sent when you are online.' : undefined)}
        reference={reservation.id} status={reservationStatus(reservation)}
        meta={`${formatBooking(reservation.date, reservation.time)} · ${reservation.guests} ${reservation.guests === 1 ? 'guest' : 'guests'}`}>
        {canCancelReservation(reservation) && <Action label="Cancel booking" onPress={() => confirmCancelReservation(reservation)} secondary />}
        {rateButton(reservation.id, reservation.status === 'completed' && !reservation.rejectedReason)}
      </Card>) : <Text style={styles.empty}>No table reservations yet.</Text>}
    </>}
  </View>;
}

function Card({ children, meta, name, note, reference, status }: { children?: React.ReactNode; meta: string; name: string; note?: string; reference: string; status: { label: string; tone: Tone } }) {
  return <View style={styles.card}>
    <View style={styles.heading}>
      <View style={styles.headingCopy}><Text style={styles.name}>{name}</Text><Text style={styles.reference}>{reference}</Text></View>
      <Text style={[styles.status, tones[status.tone]]}>{status.label}</Text>
    </View>
    <Text style={styles.meta}>{meta}</Text>
    {note ? <Text style={styles.note}>{note}</Text> : null}
    {children ? <View style={styles.actions}>{children}</View> : null}
  </View>;
}

function Action({ label, onPress, secondary }: { label: string; onPress: () => void; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={[styles.action, secondary && styles.actionSecondary]}><Text style={[styles.actionText, secondary && styles.actionSecondaryText]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  section: { marginTop: 28, padding: 17, borderWidth: 1, borderColor: '#E9DFD2', borderRadius: 20, backgroundColor: '#FFF' },
  title: { color: '#171612', fontSize: 21, fontWeight: '900' },
  copy: { color: '#777268', fontSize: 11, lineHeight: 17, marginTop: 4 },
  label: { color: '#777268', fontSize: 9, fontWeight: '900', letterSpacing: 0.8, marginTop: 18, marginBottom: 7 },
  empty: { color: '#918A81', fontSize: 12, paddingVertical: 12 },
  card: { padding: 13, borderWidth: 1, borderColor: '#F0E7DE', borderRadius: 14, backgroundColor: '#FFFDF9', marginBottom: 8 },
  heading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  headingCopy: { flex: 1 },
  name: { color: '#171612', fontSize: 13, fontWeight: '900' },
  reference: { color: ORANGE, fontSize: 8, fontWeight: '900', marginTop: 3 },
  meta: { color: '#71675F', fontSize: 10, lineHeight: 15, marginTop: 7 },
  note: { color: '#8E2F1A', fontSize: 10, lineHeight: 15, marginTop: 5 },
  status: { borderRadius: 9, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 4, fontSize: 7, fontWeight: '900' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  action: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 18, backgroundColor: ORANGE },
  actionSecondary: { borderWidth: 1, borderColor: '#E3D6CA', backgroundColor: '#FFF' },
  actionText: { color: '#FFF', fontSize: 11, fontWeight: '900' },
  actionSecondaryText: { color: '#8E2F1A' },
  reviewed: { color: '#EAA000', fontSize: 11, fontWeight: '900', paddingVertical: 9 },
});

const tones = StyleSheet.create({
  ok: { color: '#28734D', backgroundColor: '#E8F5ED' },
  waiting: { color: '#6B5A30', backgroundColor: '#FFF7DE' },
  action: { color: '#FFF', backgroundColor: ORANGE },
  bad: { color: '#8E2F1A', backgroundColor: '#F5D8D1' },
});
