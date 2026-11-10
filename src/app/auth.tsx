import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../../lib/supabase';
import { goBackOrReplace } from '@/utils/navigation';

type AccountRole = 'customer' | 'owner';

export default function AuthScreen() {
  const params = useLocalSearchParams<{ role?: AccountRole }>();
  const [mode, setMode] = useState<'sign-in' | 'register'>('sign-in');
  const [role, setRole] = useState<AccountRole>(params.role === 'owner' ? 'owner' : 'customer');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== 'SIGNED_IN' || !session?.user) return;
      const accountRole = session.user.user_metadata?.role as AccountRole | undefined;
      router.replace(accountRole === 'owner' ? '/owner' : '/profile');
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const submit = async () => {
    if (!email.trim() || password.length < 6) {
      return Alert.alert('Check your details', 'Enter a valid email and a password of at least 6 characters.');
    }
    if (mode === 'register' && !name.trim()) return Alert.alert('Name required', 'Enter your name.');
    setLoading(true);
    try {
      if (mode === 'sign-in') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: { data: { full_name: name.trim(), role } },
        });
        if (error) throw error;
        if (!data.session) {
          Alert.alert('Check your email', 'Confirm your email address, then return here to sign in.');
          setMode('sign-in');
        } else {
          router.replace(role === 'owner' ? '/owner' : '/profile');
        }
      }
    } catch (error) {
      Alert.alert(mode === 'sign-in' ? 'Could not sign in' : 'Could not register', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!email.trim()) return Alert.alert('Email required', 'Enter your account email first.');
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
    setLoading(false);
    if (error) return Alert.alert('Could not send reset email', error.message);
    Alert.alert('Check your email', 'We sent password-reset instructions if an account exists for this address.');
  };

  return <SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Pressable onPress={() => goBackOrReplace('/')}><Text style={styles.back}>‹ Back</Text></Pressable>
    <Text style={styles.eyebrow}>FORK ACCOUNT</Text><Text style={styles.title}>{mode === 'sign-in' ? 'Welcome back' : 'Create account'}</Text>
    <Text style={styles.subtitle}>{mode === 'sign-in' ? 'Sign in to access your profile and restaurant tools.' : 'Choose how you will use the app.'}</Text>
    {mode === 'register' && <><View style={styles.roles}>{(['customer', 'owner'] as const).map((value) => <Pressable key={value} onPress={() => setRole(value)} style={[styles.role, role === value && styles.roleActive]}><Text style={[styles.roleText, role === value && styles.roleTextActive]}>{value === 'customer' ? 'Customer' : 'Restaurant owner'}</Text></Pressable>)}</View><Text style={styles.label}>FULL NAME</Text><TextInput autoComplete="name" editable={!loading} onChangeText={setName} placeholder="Your name" style={styles.input} value={name} /></>}
    <Text style={styles.label}>EMAIL</Text><TextInput autoCapitalize="none" autoComplete="email" editable={!loading} keyboardType="email-address" onChangeText={setEmail} placeholder="you@example.com" style={styles.input} value={email} />
    <Text style={styles.label}>PASSWORD</Text><View style={styles.passwordRow}><TextInput autoCapitalize="none" autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} editable={!loading} onChangeText={setPassword} placeholder="At least 6 characters" secureTextEntry={!showPassword} style={styles.passwordInput} value={password} /><Pressable accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} onPress={() => setShowPassword((current) => !current)} style={styles.showButton}><Text style={styles.showText}>{showPassword ? 'Hide' : 'Show'}</Text></Pressable></View>
    {mode === 'sign-in' && <Pressable disabled={loading} onPress={() => void resetPassword()}><Text style={styles.forgot}>Forgot password?</Text></Pressable>}
    <Pressable disabled={loading} onPress={submit} style={[styles.button, loading && styles.disabled]}><Text style={styles.buttonText}>{loading ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}</Text></Pressable>
    <View style={styles.switchRow}><Text style={styles.switchCopy}>{mode === 'sign-in' ? 'New to Fork?' : 'Already registered?'}</Text><Pressable onPress={() => setMode((current) => current === 'sign-in' ? 'register' : 'sign-in')}><Text style={styles.switchLink}>{mode === 'sign-in' ? 'Create account' : 'Sign in'}</Text></Pressable></View>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF8EE' }, content: { width: '100%', maxWidth: 560, alignSelf: 'center', padding: 22, paddingBottom: 60 }, back: { color: '#B93F1D', fontSize: 14, fontWeight: '800', marginBottom: 28 }, eyebrow: { color: '#B93F1D', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, title: { color: '#271812', fontSize: 36, fontWeight: '900', marginTop: 6 }, subtitle: { color: '#71675F', fontSize: 14, lineHeight: 21, marginTop: 7, marginBottom: 20 }, roles: { flexDirection: 'row', gap: 9, marginBottom: 4 }, role: { flex: 1, alignItems: 'center', paddingVertical: 13, borderWidth: 1, borderColor: '#EADFD3', borderRadius: 22, backgroundColor: '#FFF' }, roleActive: { borderColor: '#B93F1D', backgroundColor: '#B93F1D' }, roleText: { color: '#71675F', fontSize: 12, fontWeight: '900' }, roleTextActive: { color: '#FFF' }, label: { color: '#71675F', fontSize: 9, fontWeight: '900', letterSpacing: 0.8, marginTop: 16, marginBottom: 7 }, input: { height: 50, borderWidth: 1, borderColor: '#EADFD3', borderRadius: 14, paddingHorizontal: 15, color: '#271812', backgroundColor: '#FFF' }, passwordRow: { height: 50, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#EADFD3', borderRadius: 14, backgroundColor: '#FFF' }, passwordInput: { flex: 1, height: 48, paddingHorizontal: 15, color: '#271812' }, showButton: { height: 48, justifyContent: 'center', paddingHorizontal: 15 }, showText: { color: '#B93F1D', fontSize: 11, fontWeight: '900' }, forgot: { alignSelf: 'flex-end', color: '#B93F1D', fontSize: 11, fontWeight: '800', marginTop: 10 }, button: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 26, backgroundColor: '#B93F1D', marginTop: 25 }, disabled: { opacity: 0.6 }, buttonText: { color: '#FFF', fontSize: 13, fontWeight: '900' }, switchRow: { flexDirection: 'row', justifyContent: 'center', gap: 7, marginTop: 22 }, switchCopy: { color: '#71675F', fontSize: 12 }, switchLink: { color: '#B93F1D', fontSize: 12, fontWeight: '900' },
});
