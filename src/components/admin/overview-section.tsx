import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { AUTO_CANCEL_MINUTES, fetchOverview, WAITING_ALERT_MINUTES, type AdminOverview } from '@/data/admin';
import type { ApprovalStatus } from '@/data/restaurants';
import { errorMessage } from '@/utils/feedback';

import { ACCENT, formatMoney, LoadError, SectionHeading, type Loadable } from './admin-ui';
import { themedStyles } from '@/theme/theme';

const loadOverview = (): Promise<Loadable<AdminOverview>> =>
  fetchOverview().then((value) => ({ kind: 'ready' as const, value }), (error: unknown) => ({ kind: 'error' as const, message: errorMessage(error) }));

type Props = { onOpenRequests: () => void; onOpenRestaurants: (tab: ApprovalStatus) => void };

export function OverviewSection({ onOpenRequests, onOpenRestaurants }: Props) {
  const [state, setState] = useState<Loadable<AdminOverview>>({ kind: 'loading' });
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    void loadOverview().then((result) => { if (active) setState(result); });
    return () => { active = false; };
  }, []));

  const refresh = () => {
    setRefreshing(true);
    void loadOverview().then((result) => { setState(result); setRefreshing(false); });
  };

  return <View>
    <SectionHeading helper="How Kwetu is doing right now. Tap a number to see the list behind it." loading={refreshing || state.kind === 'loading'} onRefresh={refresh} title="Overview" />
    {state.kind === 'error' && <LoadError message={state.message} onRetry={refresh} />}
    {state.kind === 'ready' && <>
      <Text style={styles.group}>RESTAURANTS</Text>
      <View style={styles.grid}>
        <Tile attention={state.value.restaurantsWaiting > 0} caption="Waiting for review" onPress={() => onOpenRestaurants('pending')} value={String(state.value.restaurantsWaiting)} />
        <Tile caption="Live" onPress={() => onOpenRestaurants('approved')} value={String(state.value.restaurantsLive)} />
        <Tile caption="Declined" onPress={() => onOpenRestaurants('rejected')} value={String(state.value.restaurantsChangesRequested)} />
      </View>
      <Text style={styles.group}>TODAY</Text>
      <View style={styles.grid}>
        <Tile caption="Orders placed" onPress={onOpenRequests} value={String(state.value.ordersToday)} />
        <Tile caption="Orders in progress" onPress={onOpenRequests} value={String(state.value.ordersInProgress)} />
        <Tile attention={state.value.ordersWaitingLong > 0} caption={`No answer for ${WAITING_ALERT_MINUTES}+ min`} onPress={onOpenRequests} value={String(state.value.ordersWaitingLong)} />
      </View>
      <Text style={styles.note}>Orders nobody answers are cancelled after {AUTO_CANCEL_MINUTES} minutes, and the customer is told.</Text>
      <View style={styles.sales}>
        <Text style={styles.salesLabel}>SALES, LAST 7 DAYS</Text>
        <Text style={styles.salesValue}>{formatMoney(state.value.salesLast7Days)}</Text>
        <Text style={styles.salesCopy}>Value of completed orders across all restaurants, paid in cash.</Text>
      </View>
    </>}
  </View>;
}

function Tile({ attention, caption, onPress, value }: { attention?: boolean; caption: string; onPress: () => void; value: string }) {
  return <Pressable accessibilityHint="Opens the list" accessibilityRole="button" onPress={onPress} style={[styles.tile, attention && styles.tileAttention]}>
    <Text style={[styles.tileValue, attention && styles.tileValueAttention]}>{value}</Text>
    <Text style={styles.tileCaption}>{caption}</Text>
  </Pressable>;
}

const styles = themedStyles(({ bg, fg, line }) => ({
  group: { color: fg('#8A7164'), fontSize: 9, fontWeight: '900', letterSpacing: 1, marginTop: 20, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  note: { color: fg('#71675F'), fontSize: 11, lineHeight: 16, marginTop: 8 },
  tile: { flexGrow: 1, flexBasis: 100, padding: 14, borderWidth: 1, borderColor: line('#EADFD3'), borderRadius: 16, backgroundColor: bg('#FFF') },
  tileAttention: { borderColor: line('#F0B9A8'), backgroundColor: bg('#FDEEE9') },
  tileValue: { color: fg('#271812'), fontSize: 26, fontWeight: '900' },
  tileValueAttention: { color: fg(ACCENT) },
  tileCaption: { color: fg('#71675F'), fontSize: 11, fontWeight: '700', marginTop: 4 },
  sales: { marginTop: 20, padding: 18, borderRadius: 20, backgroundColor: bg('#271812') },
  salesLabel: { color: fg('#F29A52'), fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  salesValue: { color: fg('#FFF'), fontSize: 28, fontWeight: '900', marginTop: 6 },
  salesCopy: { color: fg('#D8CEC8'), fontSize: 12, lineHeight: 18, marginTop: 6 },
}));
