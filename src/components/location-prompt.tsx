import * as Linking from 'expo-linking';
import { Pressable, Text, View } from 'react-native';

import type { LocationStatus } from '@/data/user-location';
import { t, type MessageKey } from '@/i18n';
import { themedStyles } from '@/theme/theme';

const ORANGE = '#ED6417';

const COPY: Partial<Record<LocationStatus, { title: MessageKey; action: MessageKey }>> = {
  undetermined: { title: 'location.askTitle', action: 'location.askAction' },
  denied: { title: 'location.deniedTitle', action: 'location.deniedAction' },
  unavailable: { title: 'location.unavailableTitle', action: 'location.unavailableAction' },
};

/** Asks for location only when the person taps, and explains that it stays on the phone. */
export function LocationPrompt({ onRequest, status }: { onRequest: () => void; status: LocationStatus }) {
  const copy = COPY[status];
  if (!copy) return null;
  const act = () => status === 'denied' ? void Linking.openSettings() : onRequest();
  return <View style={styles.card}>
    <Text style={styles.icon}>📍</Text>
    <View style={styles.copy}>
      <Text style={styles.title}>{t(copy.title)}</Text>
      <Text style={styles.note}>{t('location.note')}</Text>
    </View>
    <Pressable accessibilityRole="button" onPress={act} style={styles.button}><Text style={styles.buttonText}>{t(copy.action)}</Text></Pressable>
  </View>;
}

const styles = themedStyles(({ bg, fg, line }) => ({
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, marginBottom: 16, borderRadius: 16, borderWidth: 1, borderColor: line('#F3D9C5'), backgroundColor: bg('#FFF4EA') },
  icon: { fontSize: 22 },
  copy: { flex: 1 },
  title: { color: fg('#3B2A1A'), fontSize: 12, fontWeight: '800', lineHeight: 17 },
  note: { color: fg('#8A7164'), fontSize: 10, marginTop: 2 },
  button: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 18, backgroundColor: bg(ORANGE) },
  buttonText: { color: fg('#FFF'), fontSize: 11, fontWeight: '900' },
}));
