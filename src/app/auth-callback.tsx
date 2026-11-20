import * as Linking from 'expo-linking';
import { router, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { homeFor } from '@/data/auth';
import { parseAuthLink } from '@/utils/auth-link';
import { errorMessage } from '@/utils/feedback';
import { supabase } from '../../lib/supabase';

const ACCENT = '#B93F1D';

type Result = { kind: 'signed-in' } | { kind: 'new-password' } | { kind: 'error'; message: string };

async function homeForSignedInUser() {
  const { data } = await supabase.auth.getUser();
  return homeFor(data.user);
}

/** Turns the link from a Kwetu email into a signed-in session. */
async function completeEmailLink(url: string): Promise<Result> {
  const link = parseAuthLink(url);
  if (link.error) return { kind: 'error', message: link.error };
  try {
    if (link.accessToken && link.refreshToken) {
      const { error } = await supabase.auth.setSession({ access_token: link.accessToken, refresh_token: link.refreshToken });
      if (error) throw error;
    } else if (link.code) {
      const { error } = await supabase.auth.exchangeCodeForSession(link.code);
      if (error) throw error;
    } else {
      return { kind: 'error', message: 'This link has no sign-in details.' };
    }
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) };
  }
  return link.type === 'recovery' ? { kind: 'new-password' } : { kind: 'signed-in' };
}

/** Where links in Kwetu's emails open the app: confirms a new account, or starts a password reset. */
export default function AuthCallbackScreen() {
  const url = Linking.useLinkingURL();
  const [result, setResult] = useState<Result | null>(null);
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!url || handled.current === url) return;
    handled.current = url;
    void completeEmailLink(url).then(async (outcome) => {
      if (outcome.kind !== 'signed-in') return setResult(outcome);
      router.replace(await homeForSignedInUser());
      Alert.alert('Welcome to Kwetu', 'Your email is confirmed and you are signed in.');
    });
  }, [url]);

  return <SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={styles.eyebrow}>KWETU ACCOUNT</Text>
    {result?.kind === 'new-password'
      ? <NewPasswordForm />
      : result?.kind === 'error' || !url
        ? <>
          <Text style={styles.title}>This link did not work</Text>
          <Text style={styles.helper}>{result?.kind === 'error' ? result.message : 'Open the link from your Kwetu email on this phone.'}</Text>
          <Text style={styles.helper}>Email links work once and expire after a while. If you already confirmed your email, just sign in with your password; otherwise ask for a new email from the sign-in screen.</Text>
          <Pressable accessibilityRole="button" onPress={() => router.replace('/sign-in' as Href)} style={styles.button}><Text style={styles.buttonText}>Go to sign in</Text></Pressable>
        </>
        : <>
          <Text style={styles.title}>Signing you in…</Text>
          <ActivityIndicator color={ACCENT} style={styles.spinner} />
        </>}
  </ScrollView></SafeAreaView>;
}

function NewPasswordForm() {
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (password.length < 6) return Alert.alert('Choose a longer password', 'Use at least 6 characters.');
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setSaving(false);
      return Alert.alert('Could not change password', error.message);
    }
    router.replace(await homeForSignedInUser());
    Alert.alert('Password changed', 'You are signed in with your new password.');
  };

  return <View>
    <Text style={styles.title}>Choose a new password</Text>
    <Text style={styles.helper}>You opened a password reset link. Enter the password you want to use from now on.</Text>
    <Text style={styles.label}>NEW PASSWORD</Text>
    <TextInput autoCapitalize="none" autoComplete="new-password" autoFocus editable={!saving} onChangeText={setPassword} onSubmitEditing={() => void save()} placeholder="At least 6 characters" secureTextEntry style={styles.input} value={password} />
    <Pressable accessibilityRole="button" disabled={saving} onPress={() => void save()} style={[styles.button, saving && styles.disabled]}><Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save password'}</Text></Pressable>
  </View>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF8EE' },
  content: { width: '100%', maxWidth: 560, alignSelf: 'center', padding: 22, paddingTop: 48, paddingBottom: 60 },
  eyebrow: { color: ACCENT, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#271812', fontSize: 30, fontWeight: '900', marginTop: 6 },
  helper: { color: '#71675F', fontSize: 14, lineHeight: 21, marginTop: 10 },
  spinner: { marginTop: 28 },
  label: { color: '#71675F', fontSize: 9, fontWeight: '900', letterSpacing: 0.8, marginTop: 20, marginBottom: 7 },
  input: { height: 50, borderWidth: 1, borderColor: '#EADFD3', borderRadius: 14, paddingHorizontal: 15, color: '#271812', backgroundColor: '#FFF' },
  button: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 26, backgroundColor: ACCENT, marginTop: 25 },
  buttonText: { color: '#FFF', fontSize: 13, fontWeight: '900' },
  disabled: { opacity: 0.6 },
});
