import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { fulfillmentLabel, getOrders, recordCashPayment, type OrderRecord, type OrderStatus, updateOrderStatus } from '@/data/guest-storage';
import { formatTsh } from '@/data/restaurants';
import { t, type MessageKey } from '@/i18n';
import { confirmAction, errorMessage, showMessage } from '@/utils/feedback';
import { onNotificationReceived } from '@/utils/push-notifications';
import { themedStyles } from '@/theme/theme';

const ORANGE = '#B93F1D';
const REFRESH_INTERVAL_MS = 30_000;

type Step = { next: OrderStatus; label: MessageKey };
const PICKUP_STEPS: Partial<Record<OrderStatus, Step>> = {
  pending: { next: 'accepted', label: 'ownerReq.accept' },
  accepted: { next: 'preparing', label: 'ownerReq.startPreparing' },
  preparing: { next: 'ready', label: 'ownerReq.readyPickup' },
};
const DELIVERY_STEPS: Partial<Record<OrderStatus, Step>> = {
  pending: { next: 'accepted', label: 'ownerReq.accept' },
  accepted: { next: 'preparing', label: 'ownerReq.startPreparing' },
  preparing: { next: 'ready', label: 'ownerReq.outForDelivery' },
};
// Kwetu is cash only. The last step is the restaurant confirming the customer has the food and paid in
// cash, which completes the order. "delivered" is only reached by orders from before this change.
const CASH_STEP_FROM: OrderStatus[] = ['ready', 'delivered'];
const ORDER_STATUS: Record<OrderStatus, MessageKey> = {
  pending: 'status.pending', accepted: 'status.accepted', preparing: 'status.preparing', ready: 'status.readyForPickup',
  delivered: 'status.delivered', completed: 'status.completed', declined: 'status.declined', cancelled: 'status.cancelled',
};
const DECLINABLE: OrderStatus[] = ['pending', 'accepted', 'preparing', 'ready'];

export function OwnerRequests({ restaurantId }: { restaurantId: number }) {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      setOrders((await getOrders()).filter((order) => order.restaurantId === restaurantId));
    } catch {
      if (!silent) showMessage(t('ownerReq.loadFailed'), t('common.tryAgain'));
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    let active = true;
    getOrders()
      .then((savedOrders) => { if (active) setOrders(savedOrders.filter((order) => order.restaurantId === restaurantId)); })
      .catch(() => { if (active) showMessage(t('ownerReq.loadFailed'), t('common.tryAgain')); })
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
      showMessage(t('ownerReq.updateFailed'), errorMessage(error));
    }
    await load({ silent: true });
  };

  const pendingOrders = orders.filter((order) => (order.status ?? 'pending') === 'pending').length;

  return <View style={styles.section}>
    <View style={styles.headingRow}><View style={styles.headingCopy}><Text style={styles.title}>{t('ownerReq.title')}</Text><Text style={styles.helper}>{t('ownerReq.helper')}</Text></View><Pressable onPress={() => void load()}><Text style={styles.refresh}>{t(loading ? 'common.loading' : 'ownerReq.refresh')}</Text></Pressable></View>
    <View style={styles.stats}><Stat label={t('ownerReq.newOrders')} value={pendingOrders} /><Stat label={t('ownerReq.total')} value={orders.length} /></View>
    {orders.length ? orders.map((order) => <OrderCard key={order.id} order={order} run={run} />) : <Empty copy={t('ownerReq.noOrders')} />}
  </View>;
}

type Run = (action: () => Promise<void>) => Promise<void>;

function orderStatusLabel(order: OrderRecord) {
  const status = order.status ?? 'pending';
  if (order.fulfillment === 'Delivery' && status === 'ready') return t('status.onTheWay');
  return t(ORDER_STATUS[status]);
}

function paymentLine(order: OrderRecord) {
  const amount = formatTsh(order.total);
  if (order.paymentStatus === 'paid') return t('ownerReq.paidCash', { amount });
  return t(order.fulfillment === 'Delivery' ? 'ownerReq.paysOnDelivery' : 'ownerReq.payCounter', { amount });
}

function OrderCard({ order, run }: { order: OrderRecord; run: Run }) {
  const status = order.status ?? 'pending';
  const delivery = order.fulfillment === 'Delivery';
  const step = (delivery ? DELIVERY_STEPS : PICKUP_STEPS)[status];
  const awaitingCash = CASH_STEP_FROM.includes(status) && order.paymentStatus !== 'paid';
  const amount = formatTsh(order.total);
  const name = order.guest.name;

  const decline = () => confirmAction(t('ownerReq.declineOrderTitle'), t('ownerReq.declineOrderBody', { name }), t('ownerReq.decline'), () => void run(() => updateOrderStatus(order.id, 'declined')));
  const cashLabel = t(delivery ? 'ownerReq.deliveredPaid' : 'ownerReq.collectedPaid');
  const cashReceived = () => confirmAction(
    t(delivery ? 'ownerReq.deliveredTitle' : 'ownerReq.collectedTitle'),
    t(delivery ? 'ownerReq.deliveredBody' : 'ownerReq.collectedBody', { name, amount }),
    cashLabel,
    () => void run(() => recordCashPayment(order.id)),
  );

  return <View style={styles.card}>
    <View style={styles.cardTop}><View style={styles.headingCopy}><Text style={styles.reference}>{t('ownerReq.order', { reference: order.id })}</Text><Text style={styles.customer}>{name}</Text></View><Status value={orderStatusLabel(order)} attention={status === 'pending' || status === 'declined' || status === 'cancelled' || (status === 'delivered' && awaitingCash)} /></View>
    <Text style={styles.meta}>{fulfillmentLabel(order.fulfillment)} · {order.guest.phone}</Text>
    {order.address ? <Text style={styles.meta}>{order.address}</Text> : null}
    <View style={styles.items}>{order.items.map((item) => <Text key={item.name} style={styles.item}>{item.quantity} × {item.name} · {item.price}</Text>)}</View>
    <Text style={[styles.payment, order.paymentStatus === 'paid' && styles.paymentDone]}>{paymentLine(order)}</Text>
    <View style={styles.actions}>
      {step && <Action label={t(step.label)} onPress={() => void run(() => updateOrderStatus(order.id, step.next))} />}
      {awaitingCash && <Action label={cashLabel} onPress={cashReceived} />}
      {DECLINABLE.includes(status) && <Action destructive label={t('ownerReq.decline')} onPress={decline} />}
    </View>
  </View>;
}

function Stat({ label, value }: { label: string; value: number }) { return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>; }
function Status({ attention, value }: { attention: boolean; value: string }) { return <Text style={[styles.status, attention && styles.statusAttention]}>{value}</Text>; }
function Action({ destructive, label, onPress }: { destructive?: boolean; label: string; onPress: () => void }) { return <Pressable accessibilityRole="button" onPress={onPress} style={[styles.action, destructive && styles.actionSecondary]}><Text style={[styles.actionText, destructive && styles.actionSecondaryText]}>{label}</Text></Pressable>; }
function Empty({ copy }: { copy: string }) { return <View style={styles.empty}><Text style={styles.emptyTitle}>{t('ownerReq.empty')}</Text><Text style={styles.helper}>{copy}</Text></View>; }

const styles = themedStyles(({ bg, fg, line }) => ({
  section: { marginTop: 22, padding: 17, borderWidth: 1, borderColor: line('#EADFD3'), borderRadius: 22, backgroundColor: bg('#FFFDF9') }, headingRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }, headingCopy: { flex: 1 }, title: { color: fg('#271812'), fontSize: 20, fontWeight: '900' }, helper: { color: fg('#71675F'), fontSize: 12, lineHeight: 18, marginTop: 5 }, refresh: { color: fg(ORANGE), fontSize: 11, fontWeight: '900', paddingVertical: 5 }, stats: { flexDirection: 'row', gap: 8, marginTop: 15 }, stat: { flex: 1, padding: 11, borderRadius: 13, backgroundColor: bg('#FFF3E9') }, statValue: { color: fg('#271812'), fontSize: 21, fontWeight: '900' }, statLabel: { color: fg('#8A7164'), fontSize: 7, fontWeight: '900', marginTop: 3 }, card: { padding: 14, borderWidth: 1, borderColor: line('#EADFD3'), borderRadius: 16, backgroundColor: bg('#FFF'), marginTop: 12 }, cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }, reference: { color: fg(ORANGE), fontSize: 8, fontWeight: '900', letterSpacing: 0.7 }, customer: { color: fg('#271812'), fontSize: 16, fontWeight: '900', marginTop: 3 }, status: { color: fg('#28734D'), backgroundColor: bg('#E8F5ED'), borderRadius: 9, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 4, fontSize: 7, fontWeight: '900' }, statusAttention: { color: fg('#8E2F1A'), backgroundColor: bg('#F5D8D1') }, meta: { color: fg('#71675F'), fontSize: 11, lineHeight: 17, marginTop: 6 }, items: { paddingVertical: 8, marginTop: 7, borderTopWidth: 1, borderTopColor: line('#F0E7DE') }, item: { color: fg('#4E453F'), fontSize: 11, lineHeight: 18 }, payment: { color: fg(ORANGE), fontSize: 12, fontWeight: '800', lineHeight: 17 }, paymentDone: { color: fg('#28734D') }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }, action: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 20, backgroundColor: bg(ORANGE) }, actionSecondary: { borderWidth: 1, borderColor: line('#D9C8BC'), backgroundColor: bg('#FFF') }, actionText: { color: fg('#FFF'), fontSize: 10, fontWeight: '900' }, actionSecondaryText: { color: fg('#8E2F1A') }, empty: { alignItems: 'center', padding: 22, marginTop: 12, borderRadius: 15, backgroundColor: bg('#FFF8EE') }, emptyTitle: { color: fg('#271812'), fontSize: 15, fontWeight: '900' },
}));
