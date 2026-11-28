import type { SupabaseClient } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { authErrorMessage } from '@/data/auth';
import {
  authenticatorFactor,
  cancelAuthenticatorSetup,
  confirmAuthenticatorCode,
  groupedKey,
  startAuthenticatorSetup,
  type AuthenticatorSetup,
} from '@/data/two-step';
import { t } from '@/i18n';
import { themedStyles } from '@/theme/theme';

import { ACCENT, authStyles, Field, Notice, PrimaryButton, TextLink } from './auth-ui';

const CODE_LENGTH = 6;
const cleanCode = (value: string) => value.replace(/\D/g, '').slice(0, CODE_LENGTH);

/** The 6-digit code box with its button and error message. Also used for codes sent by SMS. */
export function CodeInput({ busy, buttonLabel, onSubmit, problem }: { busy: boolean; buttonLabel: string; onSubmit: (code: string) => void; problem: string }) {
  const [code, setCode] = useState('');
  const submit = () => { if (code.length === CODE_LENGTH) onSubmit(code); };
  return <>
    <Field
      autoComplete="one-time-code"
      autoFocus
      editable={!busy}
      error={problem || undefined}
      keyboardType="number-pad"
      label={t('twoStep.codeLabel')}
      maxLength={CODE_LENGTH}
      onChangeText={(value) => setCode(cleanCode(value))}
      onSubmitEditing={submit}
      placeholder="123456"
      style={[authStyles.input, styles.codeInput]}
      textContentType="oneTimeCode"
      value={code}
    />
    <PrimaryButton disabled={code.length !== CODE_LENGTH} label={buttonLabel} loading={busy} onPress={submit} />
  </>;
}

/**
 * Asks for the code after the password. `onDone` runs once the session has passed the code step;
 * `onCancel` should sign the half-finished session out.
 */
export function CodeStep({ cancelLabel, client, onCancel, onDone }: { cancelLabel: string; client: SupabaseClient; onCancel: () => void; onDone: () => void }) {
  // undefined while loading; null when the account has no authenticator after all.
  const [factorId, setFactorId] = useState<string | null | undefined>(undefined);
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    authenticatorFactor(client)
      .then((factor) => { if (active) setFactorId(factor?.id ?? null); })
      .catch((error: unknown) => { if (active) setProblem(authErrorMessage(error)); });
    return () => { active = false; };
  }, [client]);

  const verify = async (code: string) => {
    if (!factorId) return;
    setBusy(true);
    setProblem('');
    try {
      await confirmAuthenticatorCode(client, factorId, code);
      onDone();
    } catch (error) {
      setProblem(authErrorMessage(error));
      setBusy(false);
    }
  };

  return <View>
    <Text style={styles.heading}>{t('twoStep.codeTitle')}</Text>
    <Text style={styles.copy}>{t('twoStep.codeBody')}</Text>
    {factorId ? <CodeInput busy={busy} buttonLabel={t('twoStep.confirm')} onSubmit={(code) => void verify(code)} problem={problem} />
      : problem ? <Notice title={t('twoStep.failedTitle')} tone="error">{problem}</Notice>
        : factorId === null ? <PrimaryButton label={t('twoStep.continue')} onPress={onDone} />
          : <ActivityIndicator color={ACCENT} style={styles.spinner} />}
    <Text style={styles.copy}>{t('twoStep.lostPhone')}</Text>
    <TextLink align="center" disabled={busy} label={cancelLabel} onPress={onCancel} />
  </View>;
}

/** Adds an authenticator app to the account: open the app (or type the key), then confirm one code. */
export function AuthenticatorSetupForm({ client, onCancel, onDone }: { client: SupabaseClient; onCancel: () => void; onDone: () => void }) {
  const [setup, setSetup] = useState<AuthenticatorSetup | null>(null);
  const [loadProblem, setLoadProblem] = useState('');
  const [problem, setProblem] = useState('');
  const [noApp, setNoApp] = useState(false);
  const [busy, setBusy] = useState(false);
  const finished = useRef(false);

  useEffect(() => {
    let active = true;
    let started: AuthenticatorSetup | null = null;
    startAuthenticatorSetup(client)
      .then((result) => { started = result; if (active) setSetup(result); else void cancelAuthenticatorSetup(client, result.factorId); })
      .catch((error: unknown) => { if (active) setLoadProblem(authErrorMessage(error)); });
    // Leaving without confirming a code removes the half-made setup.
    return () => {
      active = false;
      if (started && !finished.current) void cancelAuthenticatorSetup(client, started.factorId);
    };
  }, [client]);

  const openApp = async () => {
    if (!setup) return;
    try {
      await Linking.openURL(setup.uri);
      setNoApp(false);
    } catch {
      setNoApp(true);
    }
  };

  const verify = async (code: string) => {
    if (!setup) return;
    setBusy(true);
    setProblem('');
    try {
      await confirmAuthenticatorCode(client, setup.factorId, code);
      finished.current = true;
      onDone();
    } catch (error) {
      setProblem(authErrorMessage(error));
      setBusy(false);
    }
  };

  if (loadProblem) return <View>
    <Notice title={t('twoStep.failedTitle')} tone="error">{loadProblem}</Notice>
    <TextLink align="center" label={t('common.back')} onPress={onCancel} />
  </View>;
  if (!setup) return <ActivityIndicator color={ACCENT} style={styles.spinner} />;

  return <View>
    <Text style={styles.step}>1</Text>
    <Text style={styles.copy}>{t('twoStep.setupInstall')}</Text>
    <Text style={styles.step}>2</Text>
    <Text style={styles.copy}>{t('twoStep.setupAdd')}</Text>
    <PrimaryButton label={t('twoStep.openApp')} onPress={() => void openApp()} />
    {noApp && <Notice title={t('twoStep.noAppTitle')} tone="error">{t('twoStep.noAppBody')}</Notice>}
    <Text style={authStyles.label}>{t('twoStep.keyLabel')}</Text>
    <Text selectable style={styles.key}>{groupedKey(setup.secret)}</Text>
    <Text style={styles.note}>{t('twoStep.keyNote')}</Text>
    <Text style={styles.step}>3</Text>
    <Text style={styles.copy}>{t('twoStep.setupConfirm')}</Text>
    <CodeInput busy={busy} buttonLabel={t('twoStep.turnOn')} onSubmit={(code) => void verify(code)} problem={problem} />
    <TextLink align="center" disabled={busy} label={t('common.cancel')} onPress={onCancel} />
  </View>;
}

const styles = themedStyles(({ bg, fg, line }) => ({
  heading: { color: fg('#271812'), fontSize: 20, fontWeight: '900', marginTop: 4 },
  copy: { color: fg('#71675F'), fontSize: 13, lineHeight: 19, marginTop: 8 },
  note: { color: fg('#8A7F76'), fontSize: 11, lineHeight: 16, marginTop: 6 },
  spinner: { marginVertical: 24 },
  step: { alignSelf: 'flex-start', minWidth: 26, height: 26, borderRadius: 13, overflow: 'hidden', textAlign: 'center', lineHeight: 26, color: fg('#FFF'), backgroundColor: bg(ACCENT), fontSize: 13, fontWeight: '900', marginTop: 22 },
  key: { color: fg('#271812'), fontSize: 17, fontWeight: '800', letterSpacing: 1.5, padding: 14, borderWidth: 1, borderColor: line('#EADFD3'), borderRadius: 14, backgroundColor: bg('#FFF') },
  codeInput: { fontSize: 22, fontWeight: '800', letterSpacing: 8, textAlign: 'center' },
}));
