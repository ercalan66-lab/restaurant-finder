import { useState, type ReactNode } from 'react';
import { Linking, Pressable, Text, TextInput, View } from 'react-native';

import { reviewRestaurant, WAITING_ALERT_MINUTES, type RestaurantActivity } from '@/data/admin';
import type { Restaurant } from '@/data/restaurants';
import { errorMessage, showMessage } from '@/utils/feedback';
import { themedStyles } from '@/theme/theme';

import { ACCENT, Action, adminStyles, Badge, formatMoney, formatWhen } from './admin-ui';

type Changes = Partial<Pick<Restaurant, 'approvalStatus' | 'rejectionReason'>>;
const open = (url: string) => void Linking.openURL(url).catch(() => showMessage('Could not open it', url));

const STATUS = {
  pending: { title: 'Waiting for your approval', copy: 'Customers cannot see it yet.', attention: true },
  approved: { title: 'Live', copy: 'Customers can see it and order from it.', attention: false },
  rejected: { title: 'Declined', copy: 'Customers cannot see it. When the owner saves changes, it comes back here for review.', attention: true },
} as const;

/** Approve, decline (with a reason the owner sees) or unpublish the restaurant. */
export function ApprovalCard({ hasOwner, onChanged, restaurant }: { hasOwner: boolean; onChanged: (changes: Changes) => void; restaurant: Restaurant }) {
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const status = STATUS[restaurant.approvalStatus];
  const live = restaurant.approvalStatus === 'approved';

  const review = async (approve: boolean) => {
    if (approve && !hasOwner) return showMessage('Hand it to its owner first', 'Enter the owner’s account under Owner below, so someone receives its orders. Then approve it.');
    if (!approve && !reason.trim()) return showMessage('Add a reason', 'Tell the owner why, so they know what to fix.');
    setBusy(true);
    try {
      await reviewRestaurant(restaurant.id, approve, reason.trim());
      onChanged(approve ? { approvalStatus: 'approved', rejectionReason: '' } : { approvalStatus: 'rejected', rejectionReason: reason.trim() });
      showMessage(approve ? 'Approved' : live ? 'Unpublished' : 'Declined', approve
        ? `${restaurant.name} is now live. The owner has been notified.`
        : `The owner of ${restaurant.name} has been told why.`);
      setAsking(false);
      setReason('');
    } catch (error) {
      showMessage('Could not save', errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return <View style={[adminStyles.card, status.attention && styles.cardAttention]}>
    <View style={adminStyles.cardTop}>
      <View style={adminStyles.cardCopy}>
        <Text style={adminStyles.eyebrow}>APPROVAL</Text>
        <Text style={adminStyles.name}>{status.title}</Text>
      </View>
      {!live && <Badge attention label={restaurant.approvalStatus === 'pending' ? 'NEEDS REVIEW' : 'DECLINED'} />}
    </View>
    <Text style={adminStyles.meta}>{status.copy}</Text>
    {restaurant.approvalStatus === 'rejected' && restaurant.rejectionReason ? <Text style={styles.reason}>Reason sent to the owner: {restaurant.rejectionReason}</Text> : null}
    {asking
      ? <View>
        <Text style={adminStyles.label}>{live ? 'WHY ARE YOU UNPUBLISHING IT?' : 'WHY IS IT DECLINED?'}</Text>
        <TextInput editable={!busy} multiline onChangeText={setReason} placeholder="For example: add a cover photo and at least three dishes with prices." style={[adminStyles.input, adminStyles.multiline]} value={reason} />
        <Text style={adminStyles.meta}>The owner sees this message and can fix the restaurant.</Text>
        <View style={adminStyles.actions}>
          <Action disabled={busy} label={busy ? 'Saving…' : live ? 'Unpublish' : 'Decline'} onPress={() => void review(false)} />
          <Action disabled={busy} label="Cancel" onPress={() => { setAsking(false); setReason(''); }} secondary />
        </View>
      </View>
      : <View style={adminStyles.actions}>
        {!live && <Action disabled={busy} label="Approve" onPress={() => void review(true)} />}
        <Action disabled={busy} label={live ? 'Unpublish' : restaurant.approvalStatus === 'rejected' ? 'Change the reason' : 'Decline'} onPress={() => setAsking(true)} secondary />
      </View>}
  </View>;
}

/** Contact details, location, order numbers and a menu summary, all read-only. */
export function RestaurantOverview({ activity, onOpenMenu, onOpenOrders, restaurant }: { activity: RestaurantActivity | null; onOpenMenu: () => void; onOpenOrders: () => void; restaurant: Restaurant }) {
  const hasPosition = restaurant.latitude != null && restaurant.longitude != null;
  const inStock = restaurant.menu.filter((item) => item.inStock).length;
  const stats = activity?.stats;

  return <>
    <Card title="CONTACT">
      <Row label="Phone" onPress={restaurant.phone ? () => open(`tel:${restaurant.phone.replace(/[^\d+]/g, '')}`) : undefined} value={restaurant.phone || 'Not given'} />
      <Row label="Email" onPress={restaurant.email ? () => open(`mailto:${restaurant.email}`) : undefined} value={restaurant.email || 'Not given'} />
      <Row label="Address" value={[restaurant.address, restaurant.area].filter(Boolean).join(', ') || 'Not given'} />
      <Row label="Open" value={`${restaurant.opensAt}–${restaurant.closesAt}`} />
      <Row label="Food" value={`${restaurant.cuisine}${restaurant.pricePerPerson ? ` · about ${formatMoney(restaurant.pricePerPerson)} per person` : ''}`} />
      {restaurant.facilities.length ? <Row label="Facilities" value={restaurant.facilities.join(', ')} /> : null}
      <Row label="Visible" value={restaurant.isActive ? 'Shown to customers (when approved)' : 'Hidden by the owner'} />
      {restaurant.createdAt ? <Row label="Added" value={formatWhen(restaurant.createdAt)} /> : null}
      {restaurant.description ? <Text style={styles.description}>{restaurant.description}</Text> : null}
    </Card>

    <Card title="LOCATION">
      {hasPosition
        ? <Text style={adminStyles.meta}>Map position {restaurant.latitude?.toFixed(5)}, {restaurant.longitude?.toFixed(5)}</Text>
        : <Text style={adminStyles.meta}>No map position yet. Add it in Details → Location.</Text>}
      <View style={adminStyles.actions}>
        {hasPosition && <Action label="Open in Google Maps" onPress={() => open(`https://www.google.com/maps/search/?api=1&query=${restaurant.latitude},${restaurant.longitude}`)} />}
        {restaurant.mapUrl ? <Action label="Owner’s map link" onPress={() => open(restaurant.mapUrl)} secondary /> : null}
      </View>
    </Card>

    <Card title="ORDERS">
      {!stats
        ? <Text style={adminStyles.meta}>Loading order numbers…</Text>
        : <>
          <View style={styles.grid}>
            <Tile label="Today" value={stats.ordersToday} />
            <Tile label="In progress" value={stats.inProgress} />
            <Tile attention={stats.waitingLong > 0} label={`No answer ${WAITING_ALERT_MINUTES}+ min`} value={stats.waitingLong} />
            <Tile label="Completed" value={stats.completed} />
            <Tile attention={stats.cancelled + stats.declined > 0} label="Cancelled or declined" value={stats.cancelled + stats.declined} />
            <Tile label="All orders" value={stats.ordersTotal} />
          </View>
          <Row label="Sales, 7 days" value={formatMoney(stats.sales7Days)} />
          <Row label="Sales, all time" value={formatMoney(stats.salesTotal)} />
          <Row label="Last order" value={stats.lastOrderAt ? formatWhen(stats.lastOrderAt) : 'No orders yet'} />
        </>}
      <Pressable accessibilityRole="button" onPress={onOpenOrders}><Text style={adminStyles.link}>See its orders ›</Text></Pressable>
    </Card>

    <Card title="MENU">
      <Row label="Dishes" value={`${restaurant.menu.length} (${inStock} in stock)`} />
      <Row label="Menu photos" value={String(restaurant.menuPhotoUrls.length)} />
      <Row label="Menu PDF" value={restaurant.menuPdfUrl ? 'Yes' : 'No'} />
      <Row label="Rating" value={restaurant.reviewCount > 0 ? `${restaurant.rating} ★ from ${restaurant.reviewCount} reviews` : restaurant.rating > 0 ? `${restaurant.rating} ★ (set by Kwetu)` : 'No reviews yet'} />
      <Pressable accessibilityRole="button" onPress={onOpenMenu}><Text style={adminStyles.link}>See and edit the menu ›</Text></Pressable>
    </Card>
  </>;
}

function Card({ children, title }: { children: ReactNode; title: string }) {
  return <View style={adminStyles.card}><Text style={adminStyles.eyebrow}>{title}</Text>{children}</View>;
}

function Row({ label, onPress, value }: { label: string; onPress?: () => void; value: string }) {
  return <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    {onPress
      ? <Text accessibilityRole="link" onPress={onPress} selectable style={[styles.rowValue, styles.rowLink]}>{value}</Text>
      : <Text selectable style={styles.rowValue}>{value}</Text>}
  </View>;
}

function Tile({ attention, label, value }: { attention?: boolean; label: string; value: number }) {
  return <View style={[styles.tile, attention && styles.tileAttention]}>
    <Text style={[styles.tileValue, attention && styles.tileValueAttention]}>{value}</Text>
    <Text style={styles.tileLabel}>{label}</Text>
  </View>;
}

const styles = themedStyles(({ bg, fg, line }) => ({
  cardAttention: { borderColor: line('#F0B9A8'), backgroundColor: bg('#FFF6F3') },
  reason: { color: fg('#8E2F1A'), fontSize: 12, lineHeight: 18, marginTop: 8, padding: 10, borderRadius: 10, backgroundColor: bg('#FBE9E5') },
  row: { flexDirection: 'row', gap: 12, marginTop: 8 },
  rowLabel: { width: 96, color: fg('#71675F'), fontSize: 12, fontWeight: '800' },
  rowValue: { flex: 1, color: fg('#271812'), fontSize: 13, lineHeight: 18 },
  rowLink: { color: fg(ACCENT), fontWeight: '800' },
  description: { color: fg('#4E453F'), fontSize: 12, lineHeight: 18, marginTop: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, marginBottom: 4 },
  tile: { flexGrow: 1, flexBasis: 96, padding: 10, borderWidth: 1, borderColor: line('#EADFD3'), borderRadius: 14, backgroundColor: bg('#FFF') },
  tileAttention: { borderColor: line('#F0B9A8'), backgroundColor: bg('#FDEEE9') },
  tileValue: { color: fg('#271812'), fontSize: 22, fontWeight: '900' },
  tileValueAttention: { color: fg(ACCENT) },
  tileLabel: { color: fg('#71675F'), fontSize: 11, fontWeight: '700', marginTop: 2 },
}));
