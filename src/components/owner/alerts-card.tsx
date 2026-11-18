import { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { getPushAvailability, registerDeviceForAccount } from '@/utils/push-notifications';

import { OWNER_COLORS, PrimaryButton } from './form-controls';

type AlertsState = 'loading' | 'on' | 'off' | 'blocked' | 'failed' | 'unavailable';

const copy: Record<Exclude<AlertsState, 'loading'>, { title: string; helper: string; action?: string }> = {
  on: { title: 'New order alerts are on', helper: 'This phone gets a notification for every new order and booking.' },
  off: { title: 'Get alerts for new orders', helper: 'Be notified the moment a customer orders or books a table, even when the app is closed.', action: 'Turn on alerts' },
  blocked: { title: 'Alerts are blocked', helper: 'Allow notifications for Fork in your phone settings, then come back here.', action: 'Open settings' },
  failed: { title: 'Alerts could not be set up', helper: 'This phone could not be linked to your account. Check your connection and try again.', action: 'Try again' },
  unavailable: { title: 'Alerts need the Fork app on a phone', helper: 'Order notifications work in the installed app on a real phone, not in a browser or simulator.' },
};

async function currentState(): Promise<AlertsState> {
  const availability = await getPushAvailability();
  if (availability === 'granted') return (await registerDeviceForAccount({ ask: false })) ? 'on' : 'failed';
  return availability === 'undetermined' ? 'off' : availability === 'denied' ? 'blocked' : 'unavailable';
}

export function AlertsCard() {
  const [state, setState] = useState<AlertsState>('loading');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void currentState().then((next) => { if (active) setState(next); });
    return () => { active = false; };
  }, []);

  const act = async () => {
    if (state === 'blocked') return void Linking.openSettings();
    setBusy(true);
    try {
      setState((await registerDeviceForAccount({ ask: true })) ? 'on' : await currentState());
    } finally {
      setBusy(false);
    }
  };

  if (state === 'loading') return null;
  const { title, helper, action } = copy[state];
  return <View style={[styles.card, state === 'on' && styles.cardOn]}>
    <Text style={styles.title}>{state === 'on' ? '🔔 ' : ''}{title}</Text>
    <Text style={styles.helper}>{helper}</Text>
    {action ? <PrimaryButton busy={busy} busyLabel="Turning on…" label={action} onPress={() => void act()} /> : null}
  </View>;
}

const styles = StyleSheet.create({
  card: { marginTop: 12, padding: 15, borderRadius: 18, borderWidth: 1, borderColor: OWNER_COLORS.line, backgroundColor: '#FFF' },
  cardOn: { borderColor: '#BFE0CB', backgroundColor: '#F2FAF5' },
  title: { color: OWNER_COLORS.ink, fontSize: 15, fontWeight: '900' },
  helper: { color: OWNER_COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
});
