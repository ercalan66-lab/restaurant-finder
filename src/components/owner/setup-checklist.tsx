import { Pressable, Text, View } from 'react-native';

import type { Restaurant } from '@/data/restaurants';
import { t, type MessageKey } from '@/i18n';

import { OWNER_COLORS } from './form-controls';
import { themedStyles } from '@/theme/theme';

export type OwnerTab = 'orders' | 'menu' | 'photos' | 'details';

type Step = { key: string; label: MessageKey; done: boolean; tab: OwnerTab };

/** What a restaurant page still needs before customers see a complete listing, in the order to do it. */
export function setupSteps(restaurant: Restaurant): Step[] {
  return [
    { key: 'cover', label: 'setup.cover', done: restaurant.coverUrl !== null, tab: 'photos' },
    { key: 'place', label: 'setup.place', done: restaurant.galleryUrls.length > 0, tab: 'photos' },
    { key: 'menu', label: 'setup.menu', done: restaurant.menuPhotoUrls.length > 0 || restaurant.menuPdfUrl !== null, tab: 'menu' },
    { key: 'dishes', label: 'setup.dishes', done: restaurant.menu.length > 0, tab: 'menu' },
    { key: 'location', label: 'setup.location', done: restaurant.latitude !== null, tab: 'details' },
  ];
}

/** A short to-do list at the top of the dashboard. Hidden once every step is done. */
export function SetupChecklist({ onOpen, restaurant }: { onOpen: (tab: OwnerTab) => void; restaurant: Restaurant }) {
  const steps = setupSteps(restaurant);
  const done = steps.filter((step) => step.done).length;
  if (done === steps.length) return null;

  return <View style={styles.card}>
    <Text style={styles.title}>{t('setup.title')}</Text>
    <Text style={styles.progressText}>{t('setup.progress', { done, total: steps.length })}</Text>
    <View style={styles.track}><View style={[styles.fill, { width: `${(done / steps.length) * 100}%` }]} /></View>
    {steps.map((step) => <Pressable accessibilityRole="button" accessibilityState={{ checked: step.done }} disabled={step.done} key={step.key} onPress={() => onOpen(step.tab)} style={styles.step}>
      <Text style={[styles.tick, step.done && styles.tickDone]}>{step.done ? '✓' : ''}</Text>
      <Text style={[styles.stepLabel, step.done && styles.stepDone]}>{t(step.label)}</Text>
      {!step.done && <Text style={styles.go}>{t('setup.go')}</Text>}
    </Pressable>)}
  </View>;
}

const styles = themedStyles(({ bg, fg, line }) => ({
  card: { marginTop: 18, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: line('#EBD9A8'), backgroundColor: bg('#FFF7DE') },
  title: { color: fg(OWNER_COLORS.ink), fontSize: 17, fontWeight: '900' },
  progressText: { color: fg(OWNER_COLORS.muted), fontSize: 12, fontWeight: '700', marginTop: 4 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 10, marginBottom: 6, backgroundColor: bg('#F1E3BD') },
  fill: { height: 8, borderRadius: 4, backgroundColor: bg(OWNER_COLORS.accent) },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, borderTopWidth: 1, borderTopColor: line('#F1E3BD') },
  tick: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: line('#D8C08A'), textAlign: 'center', lineHeight: 22, overflow: 'hidden', color: fg('#FFF'), fontSize: 14, fontWeight: '900' },
  tickDone: { borderColor: line('#2E8B57'), backgroundColor: bg('#2E8B57') },
  stepLabel: { flex: 1, color: fg(OWNER_COLORS.ink), fontSize: 14, fontWeight: '800' },
  stepDone: { color: fg(OWNER_COLORS.muted), fontWeight: '600', textDecorationLine: 'line-through' },
  go: { color: fg(OWNER_COLORS.accent), fontSize: 13, fontWeight: '900' },
}));
