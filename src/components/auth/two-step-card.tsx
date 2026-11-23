import type { SupabaseClient } from '@supabase/supabase-js';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { authErrorMessage } from '@/data/auth';
import { authenticatorFactor, removeAuthenticator } from '@/data/two-step';
import { t } from '@/i18n';
import { confirmAction, showMessage } from '@/utils/feedback';
import { themedStyles } from '@/theme/theme';
import { supabase } from '../../../lib/supabase';

import { ACCENT } from './auth-ui';

const openSetupScreen = () => router.push('/two-step-setup' as Href);

/**
 * Shows whether two-step sign-in is on, and turns it on or off. By default it is the profile card of the
 * signed-in customer or owner; the admin console passes its own client and shows the setup itself.
 */
export function TwoStepCard({ client = supabase, onTurnOn = openSetupScreen }: { client?: SupabaseClient; onTurnOn?: () => void }) {
  // undefined while loading; null when off.
  const [factorId, setFactorId] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    authenticatorFactor(client)
      .then((factor) => { if (active) setFactorId(factor?.id ?? null); })
      .catch(() => { if (active) setFactorId(null); });
    return () => { active = false; };
  }, [client]));

  const turnOff = (id: string) => confirmAction(t('twoStep.offTitle'), t('twoStep.offBody'), t('twoStep.turnOff'), () => void (async () => {
    setBusy(true);
    try {
      await removeAuthenticator(client, id);
      setFactorId(null);
      showMessage(t('twoStep.offDone'), t('twoStep.offBody'));
    } catch (error) {
      showMessage(t('twoStep.offFailed'), authErrorMessage(error));
    } finally {
      setBusy(false);
    }
  })());

  if (factorId === undefined) return null;
  const on = factorId !== null;

  return <View style={styles.card}>
    <View style={styles.top}>
      <Text style={styles.title}>{t('twoStep.cardTitle')}</Text>
      <Text style={[styles.badge, on && styles.badgeOn]}>{on ? '✓' : '—'}</Text>
    </View>
    <Text style={styles.copy}>{t(on ? 'twoStep.cardOn' : 'twoStep.cardOff')}</Text>
    <Pressable
      accessibilityRole="button"
      disabled={busy}
      onPress={on ? () => turnOff(factorId) : onTurnOn}
      style={[styles.button, on && styles.buttonOff, busy && styles.disabled]}>
      <Text style={[styles.buttonText, on && styles.buttonOffText]}>{t(on ? 'twoStep.turnOff' : 'twoStep.turnOnShort')}</Text>
    </Pressable>
  </View>;
}

const styles = themedStyles(({ bg, fg, line }) => ({
  card: { marginTop: 12, padding: 14, borderWidth: 1, borderColor: line('#E9DFD2'), borderRadius: 15, backgroundColor: bg('#FFF') },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  title: { flex: 1, color: fg('#171612'), fontSize: 14, fontWeight: '900' },
  badge: { minWidth: 24, height: 24, borderRadius: 12, overflow: 'hidden', textAlign: 'center', lineHeight: 24, color: fg('#8A7F76'), backgroundColor: bg('#F4EAE1'), fontSize: 12, fontWeight: '900' },
  badgeOn: { color: fg('#FFF'), backgroundColor: bg('#2E8B57') },
  copy: { color: fg('#71675F'), fontSize: 12, lineHeight: 18, marginTop: 6 },
  button: { alignSelf: 'flex-start', minHeight: 38, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 19, backgroundColor: bg(ACCENT), marginTop: 12 },
  buttonOff: { borderWidth: 1, borderColor: line('#D9C8BC'), backgroundColor: bg('#FFF') },
  buttonText: { color: fg('#FFF'), fontSize: 12, fontWeight: '900' },
  buttonOffText: { color: fg('#8E2F1A') },
  disabled: { opacity: 0.6 },
}));
