import { router, type Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { formatBooking } from '@/data/booking';
import {
  canCancelOrder,
  canCancelReservation,
  canPayInApp,
  cancelOrder,
  cancelReservation,
  fulfillmentLabel,
  paymentSummary,
  type OrderRecord,
  type ReservationRecord,
} from '@/data/guest-storage';
import { formatTsh } from '@/data/restaurants';
import { t, tn, type MessageKey } from '@/i18n';
import { confirmAction, errorMessage, showMessage } from '@/utils/feedback';
import { themedStyles } from '@/theme/theme';

const ORANGE = '#ED6417';
const SHOWN = 8;

type Tone = 'ok' | 'waiting' | 'action' | 'bad';
type Status = { label: MessageKey; tone: Tone };

function orderStatus(order: OrderRecord): Status {
  if (order.rejectedReason) return { label: 'status.notAccepted', tone: 'bad' };
  switch (order.status ?? 'pending') {
    case 'pending': return { label: 'status.sent', tone: 'waiting' };
    case 'accepted': return { label: 'status.accepted', tone: 'ok' };
    case 'preparing': return { label: 'status.preparing', tone: 'ok' };
    case 'ready': return { label: order.fulfillment === 'Delivery' ? 'status.onTheWay' : 'status.readyForPickup', tone: 'ok' };
    case 'delivered': return order.paymentStatus === 'paid' ? { label: 'status.delivered', tone: 'ok' } : { label: 'status.arrivedPay', tone: 'action' };
    case 'completed': return { label: 'status.completed', tone: 'ok' };
    case 'declined': return { label: 'status.declined', tone: 'bad' };
    case 'cancelled': return { label: 'status.cancelled', tone: 'bad' };
  }
}

function reservationStatus(reservation: ReservationRecord): Status {
  if (reservation.rejectedReason) return { label: 'status.notAccepted', tone: 'bad' };
  switch (reservation.status ?? 'pending') {
    case 'pending': return { label: 'status.requested', tone: 'waiting' };
    case 'confirmed': return { label: 'status.confirmed', tone: 'ok' };
    case 'completed': return { label: 'status.completed', tone: 'ok' };
    case 'declined': return { label: 'status.declined', tone: 'bad' };
    case 'cancelled': return { label: 'status.cancelled', tone: 'bad' };
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
    if (reviewed.has(reference)) return <Text style={styles.reviewed}>{t('activity.reviewed')}</Text>;
    return <Action label={t('activity.rate')} onPress={() => router.push(`/review/${reference}` as Href)} />;
  };
  const run = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (error) {
      showMessage(t('activity.cancelFailed'), errorMessage(error));
    }
    onChanged();
  };

  const confirmCancelOrder = (order: OrderRecord) => confirmAction(t('activity.cancelOrderTitle'), t('activity.cancelOrderBody', { restaurant: order.restaurantName, reference: order.id }), t('activity.cancelOrder'), () => void run(() => cancelOrder(order)));
  const confirmCancelReservation = (reservation: ReservationRecord) => confirmAction(t('activity.cancelBookingTitle'), t('activity.cancelBookingBody', { restaurant: reservation.restaurantName, when: formatBooking(reservation.date, reservation.time) }), t('activity.cancelBooking'), () => void run(() => cancelReservation(reservation)));
  const notSent = (synced: boolean | undefined) => (synced === false ? t('activity.notSent') : undefined);

  return <View style={styles.section}>
    <Text style={styles.title}>{t('activity.title')}</Text>
    <Text style={styles.copy}>{t(signedIn ? 'activity.copySignedIn' : 'activity.copy')}</Text>
    {loading ? <Text style={styles.empty}>{t('activity.loading')}</Text> : <>
      <Text style={styles.label}>{t('activity.orders')}</Text>
      {orders.length ? orders.slice(0, SHOWN).map((order) => {
        const status = orderStatus(order);
        return <Card key={order.id} name={order.restaurantName} note={order.rejectedReason ?? notSent(order.synced)} reference={order.id} status={status}
          meta={`${formatTsh(order.total)} · ${fulfillmentLabel(order.fulfillment)} · ${paymentSummary(order)}`}>
          {canPayInApp(order) && <Action label={t('activity.pay', { amount: formatTsh(order.total) })} onPress={() => router.push(`/pay/${order.id}` as Href)} />}
          {canCancelOrder(order) && <Action label={t('activity.cancelOrder')} onPress={() => confirmCancelOrder(order)} secondary />}
          {rateButton(order.id, order.status === 'completed' && !order.rejectedReason)}
        </Card>;
      }) : <Text style={styles.empty}>{t('activity.noOrders')}</Text>}
      <Text style={styles.label}>{t('activity.reservations')}</Text>
      {reservations.length ? reservations.slice(0, SHOWN).map((reservation) => <Card key={reservation.id} name={reservation.restaurantName}
        note={reservation.rejectedReason ?? notSent(reservation.synced)}
        reference={reservation.id} status={reservationStatus(reservation)}
        meta={`${formatBooking(reservation.date, reservation.time)} · ${tn('count.guests', reservation.guests)}`}>
        {canCancelReservation(reservation) && <Action label={t('activity.cancelBooking')} onPress={() => confirmCancelReservation(reservation)} secondary />}
        {rateButton(reservation.id, reservation.status === 'completed' && !reservation.rejectedReason)}
      </Card>) : <Text style={styles.empty}>{t('activity.noReservations')}</Text>}
    </>}
  </View>;
}

function Card({ children, meta, name, note, reference, status }: { children?: React.ReactNode; meta: string; name: string; note?: string; reference: string; status: Status }) {
  return <View style={styles.card}>
    <View style={styles.heading}>
      <View style={styles.headingCopy}><Text style={styles.name}>{name}</Text><Text style={styles.reference}>{reference}</Text></View>
      <Text style={[styles.status, tones[status.tone]]}>{t(status.label)}</Text>
    </View>
    <Text style={styles.meta}>{meta}</Text>
    {note ? <Text style={styles.note}>{note}</Text> : null}
    {children ? <View style={styles.actions}>{children}</View> : null}
  </View>;
}

function Action({ label, onPress, secondary }: { label: string; onPress: () => void; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={[styles.action, secondary && styles.actionSecondary]}><Text style={[styles.actionText, secondary && styles.actionSecondaryText]}>{label}</Text></Pressable>;
}

const styles = themedStyles(({ bg, fg, line }) => ({
  section: { marginTop: 28, padding: 17, borderWidth: 1, borderColor: line('#E9DFD2'), borderRadius: 20, backgroundColor: bg('#FFF') },
  title: { color: fg('#171612'), fontSize: 21, fontWeight: '900' },
  copy: { color: fg('#777268'), fontSize: 11, lineHeight: 17, marginTop: 4 },
  label: { color: fg('#777268'), fontSize: 9, fontWeight: '900', letterSpacing: 0.8, marginTop: 18, marginBottom: 7 },
  empty: { color: fg('#918A81'), fontSize: 12, paddingVertical: 12 },
  card: { padding: 13, borderWidth: 1, borderColor: line('#F0E7DE'), borderRadius: 14, backgroundColor: bg('#FFFDF9'), marginBottom: 8 },
  heading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  headingCopy: { flex: 1 },
  name: { color: fg('#171612'), fontSize: 13, fontWeight: '900' },
  reference: { color: fg(ORANGE), fontSize: 8, fontWeight: '900', marginTop: 3 },
  meta: { color: fg('#71675F'), fontSize: 10, lineHeight: 15, marginTop: 7 },
  note: { color: fg('#8E2F1A'), fontSize: 10, lineHeight: 15, marginTop: 5 },
  status: { borderRadius: 9, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 4, fontSize: 7, fontWeight: '900' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  action: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 18, backgroundColor: bg(ORANGE) },
  actionSecondary: { borderWidth: 1, borderColor: line('#E3D6CA'), backgroundColor: bg('#FFF') },
  actionText: { color: fg('#FFF'), fontSize: 11, fontWeight: '900' },
  actionSecondaryText: { color: fg('#8E2F1A') },
  reviewed: { color: fg('#EAA000'), fontSize: 11, fontWeight: '900', paddingVertical: 9 },
}));

const tones = themedStyles(({ bg, fg }) => ({
  ok: { color: fg('#28734D'), backgroundColor: bg('#E8F5ED') },
  waiting: { color: fg('#6B5A30'), backgroundColor: bg('#FFF7DE') },
  action: { color: fg('#FFF'), backgroundColor: bg(ORANGE) },
  bad: { color: fg('#8E2F1A'), backgroundColor: bg('#F5D8D1') },
}));
