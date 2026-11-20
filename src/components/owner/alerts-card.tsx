import { useEffect, useState } from 'react';
import { Linking, Text, View } from 'react-native';

import { t, type MessageKey } from '@/i18n';
import { getPushAvailability, registerDeviceForAccount } from '@/utils/push-notifications';

import { OWNER_COLORS, PrimaryButton } from './form-controls';
import { themedStyles } from '@/theme/theme';

type AlertsState = 'loading' | 'on' | 'off' | 'blocked' | 'failed' | 'unavailable';

// Message keys, not text: the text is looked up when the card renders, in the current language.
const copy: Record<Exclude<AlertsState, 'loading'>, { title: MessageKey; helper: MessageKey; action?: MessageKey }> = {
  on: { title: 'alerts.onTitle', helper: 'alerts.onHelp' },
  off: { title: 'alerts.offTitle', helper: 'alerts.offHelp', action: 'alerts.offAction' },
  blocked: { title: 'alerts.blockedTitle', helper: 'alerts.blockedHelp', action: 'alerts.blockedAction' },
  failed: { title: 'alerts.failedTitle', helper: 'alerts.failedHelp', action: 'alerts.failedAction' },
  unavailable: { title: 'alerts.unavailableTitle', helper: 'alerts.unavailableHelp' },
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
    <Text style={styles.title}>{state === 'on' ? '🔔 ' : ''}{t(title)}</Text>
    <Text style={styles.helper}>{t(helper)}</Text>
    {action ? <PrimaryButton busy={busy} busyLabel={t('alerts.turningOn')} label={t(action)} onPress={() => void act()} /> : null}
  </View>;
}

const styles = themedStyles(({ bg, fg, line }) => ({
  card: { marginTop: 12, padding: 15, borderRadius: 18, borderWidth: 1, borderColor: line(OWNER_COLORS.line), backgroundColor: bg('#FFF') },
  cardOn: { borderColor: line('#BFE0CB'), backgroundColor: bg('#F2FAF5') },
  title: { color: fg(OWNER_COLORS.ink), fontSize: 15, fontWeight: '900' },
  helper: { color: fg(OWNER_COLORS.muted), fontSize: 12, lineHeight: 18, marginTop: 4 },
}));
