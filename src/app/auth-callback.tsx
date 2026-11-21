import * as Linking from 'expo-linking';
import { router, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { passwordProblem, passwordRule } from '@/data/auth';
import { t } from '@/i18n';
import { parseAuthLink } from '@/utils/auth-link';
import { errorMessage, showMessage } from '@/utils/feedback';
import { goHome } from '@/utils/navigation';
import { supabase } from '../../lib/supabase';
import { themedStyles } from '@/theme/theme';

const ACCENT = '#B93F1D';

type Result = { kind: 'signed-in' } | { kind: 'new-password' } | { kind: 'error'; message: string };

/**
 * Turns the link from a Kwetu email into a signed-in session. Only one-time codes (PKCE) are accepted:
 * they work only with the secret this phone kept when it asked for the email. Links that carry sign-in
 * tokens themselves are refused, because anyone could craft one to sign a phone into their own account.
 */
async function completeEmailLink(url: string): Promise<Result> {
  const link = parseAuthLink(url);
  if (link.error) return { kind: 'error', message: link.error };
  if (!link.code) return { kind: 'error', message: t(link.accessToken ? 'callback.oldLink' : 'callback.noDetails') };
  try {
    const { data, error } = await supabase.auth.exchangeCodeForSession(link.code);
    if (error) throw error;
    // Supabase remembers on this phone whether the email was a password reset, and returns it as
    // redirectType (supabase-js sets it at runtime but leaves it out of the declared return type).
    const { redirectType } = data as typeof data & { redirectType?: string | null };
    return redirectType === 'recovery' || link.type === 'recovery' ? { kind: 'new-password' } : { kind: 'signed-in' };
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) };
  }
}

/** Where links in Kwetu's emails open the app: confirms a new account, or starts a password reset. */
export default function AuthCallbackScreen() {
  const url = Linking.useLinkingURL();
  const [result, setResult] = useState<Result | null>(null);
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!url || handled.current === url) return;
    handled.current = url;
    void completeEmailLink(url).then((outcome) => {
      if (outcome.kind !== 'signed-in') return setResult(outcome);
      goHome();
      showMessage(t('callback.welcome'), t('callback.welcomeBody'));
    });
  }, [url]);

  return <SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={styles.eyebrow}>{t('auth.eyebrow')}</Text>
    {result?.kind === 'new-password'
      ? <NewPasswordForm />
      : result?.kind === 'error' || !url
        ? <>
          <Text style={styles.title}>{t('callback.failedTitle')}</Text>
          <Text style={styles.helper}>{result?.kind === 'error' ? result.message : t('callback.openOnPhone')}</Text>
          <Text style={styles.helper}>{t('callback.help')}</Text>
          <Pressable accessibilityRole="button" onPress={() => router.replace('/sign-in' as Href)} style={styles.button}><Text style={styles.buttonText}>{t('callback.goToSignIn')}</Text></Pressable>
        </>
        : <>
          <Text style={styles.title}>{t('callback.signingIn')}</Text>
          <ActivityIndicator color={ACCENT} style={styles.spinner} />
        </>}
  </ScrollView></SafeAreaView>;
}

function NewPasswordForm() {
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const problem = passwordProblem(password);
    if (problem) return showMessage(t('callback.weakPassword'), `${problem} ${passwordRule()}`);
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setSaving(false);
      return showMessage(t('callback.changeFailed'), error.message);
    }
    goHome();
    showMessage(t('callback.changed'), t('callback.changedBody'));
  };

  return <View>
    <Text style={styles.title}>{t('callback.newTitle')}</Text>
    <Text style={styles.helper}>{t('callback.newHelp')}</Text>
    <Text style={styles.label}>{t('callback.newLabel')}</Text>
    <TextInput autoCapitalize="none" autoComplete="new-password" autoFocus editable={!saving} onChangeText={setPassword} onSubmitEditing={() => void save()} placeholder={passwordRule()} secureTextEntry style={styles.input} value={password} />
    <Pressable accessibilityRole="button" disabled={saving} onPress={() => void save()} style={[styles.button, saving && styles.disabled]}><Text style={styles.buttonText}>{t(saving ? 'common.saving' : 'callback.save')}</Text></Pressable>
  </View>;
}

const styles = themedStyles(({ bg, fg, line }) => ({
  safeArea: { flex: 1, backgroundColor: bg('#FFF8EE') },
  content: { width: '100%', maxWidth: 560, alignSelf: 'center', padding: 22, paddingTop: 48, paddingBottom: 60 },
  eyebrow: { color: fg(ACCENT), fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: fg('#271812'), fontSize: 30, fontWeight: '900', marginTop: 6 },
  helper: { color: fg('#71675F'), fontSize: 14, lineHeight: 21, marginTop: 10 },
  spinner: { marginTop: 28 },
  label: { color: fg('#71675F'), fontSize: 9, fontWeight: '900', letterSpacing: 0.8, marginTop: 20, marginBottom: 7 },
  input: { height: 50, borderWidth: 1, borderColor: line('#EADFD3'), borderRadius: 14, paddingHorizontal: 15, color: fg('#271812'), backgroundColor: bg('#FFF') },
  button: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 26, backgroundColor: bg(ACCENT), marginTop: 25 },
  buttonText: { color: fg('#FFF'), fontSize: 13, fontWeight: '900' },
  disabled: { opacity: 0.6 },
}));
