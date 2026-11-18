import { isAuthError } from '@supabase/supabase-js';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../../lib/supabase';
import { goBackOrReplace } from '@/utils/navigation';
import { toE164 } from '@/utils/phone';

type AccountRole = 'customer' | 'owner';
type AuthMode = 'sign-in' | 'register';
type AuthMethod = 'email' | 'phone';

function phoneAuthMessage(error: unknown, mode: AuthMode) {
  if (isAuthError(error)) {
    switch (error.code) {
      case 'otp_disabled': return mode === 'sign-in' ? 'There is no account for this number yet. Tap “Create account” to register.' : 'Phone sign-up is turned off for this app.';
      case 'phone_provider_disabled': return 'Phone sign-in is not enabled for this app yet. Please use email for now.';
      case 'sms_send_failed': return 'We could not send the SMS. Check the number and try again.';
      case 'over_sms_send_rate_limit': return 'Too many codes requested. Wait a minute, then try again.';
      case 'otp_expired': return 'That code is wrong or has expired. Check the SMS or request a new code.';
    }
  }
  return error instanceof Error ? error.message : 'Please try again.';
}

export default function AuthScreen() {
  const params = useLocalSearchParams<{ role?: AccountRole }>();
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [method, setMethod] = useState<AuthMethod>('email');
  const [role, setRole] = useState<AccountRole>(params.role === 'owner' ? 'owner' : 'customer');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);
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

  const resetCode = () => { setCodeSentTo(null); setCode(''); };
  const changeMode = () => { resetCode(); setMode((current) => current === 'sign-in' ? 'register' : 'sign-in'); };
  const changeMethod = (value: AuthMethod) => { resetCode(); setMethod(value); };

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

  const sendCode = async () => {
    const e164 = toE164(phone);
    if (!e164) return Alert.alert('Check your number', 'Enter a mobile number such as 0712 345 678 or +255 712 345 678.');
    if (mode === 'register' && !name.trim()) return Alert.alert('Name required', 'Enter your name.');
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: e164,
        // Only registration may create an account; signing in with an unknown number is an error.
        options: mode === 'register'
          ? { channel: 'sms', shouldCreateUser: true, data: { full_name: name.trim(), role } }
          : { channel: 'sms', shouldCreateUser: false },
      });
      if (error) throw error;
      setCode('');
      setCodeSentTo(e164);
    } catch (error) {
      Alert.alert('Could not send code', phoneAuthMessage(error, mode));
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (!codeSentTo) return;
    if (!/^\d{6,10}$/.test(code)) return Alert.alert('Enter the code', 'Type the code from the SMS we sent you.');
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ phone: codeSentTo, token: code, type: 'sms' });
      if (error) throw error;
      // The SIGNED_IN listener above routes to the profile or owner dashboard.
    } catch (error) {
      Alert.alert('Could not verify code', phoneAuthMessage(error, mode));
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

  const onPrimaryPress = method === 'email' ? submit : codeSentTo ? verifyCode : sendCode;
  const primaryLabel = loading
    ? 'Please wait…'
    : method === 'email'
      ? mode === 'sign-in' ? 'Sign in' : 'Create account'
      : codeSentTo ? 'Verify and continue' : 'Send code';

  return <SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Pressable onPress={() => goBackOrReplace('/')}><Text style={styles.back}>‹ Back</Text></Pressable>
    <Text style={styles.eyebrow}>FORK ACCOUNT</Text><Text style={styles.title}>{mode === 'sign-in' ? 'Welcome back' : 'Create account'}</Text>
    <Text style={styles.subtitle}>{mode === 'sign-in' ? 'Sign in to access your profile and restaurant tools.' : 'Choose how you will use the app.'}</Text>
    <View accessibilityRole="tablist" style={styles.methods}>{(['email', 'phone'] as const).map((value) => <Pressable accessibilityRole="tab" accessibilityState={{ selected: method === value }} disabled={loading} key={value} onPress={() => changeMethod(value)} style={[styles.method, method === value && styles.methodActive]}><Text style={[styles.methodText, method === value && styles.methodTextActive]}>{value === 'email' ? 'Email' : 'Phone'}</Text></Pressable>)}</View>
    {codeSentTo
      ? <>
        <Text style={styles.codeHint}>Enter the code we sent by SMS to <Text style={styles.codePhone}>{codeSentTo}</Text>.</Text>
        <Text style={styles.label}>VERIFICATION CODE</Text>
        <TextInput autoComplete="one-time-code" autoFocus editable={!loading} keyboardType="number-pad" maxLength={10} onChangeText={(value) => setCode(value.replace(/\D/g, ''))} onSubmitEditing={() => void verifyCode()} placeholder="••••••" placeholderTextColor="#CDBFB3" style={[styles.input, styles.codeInput]} value={code} />
        <View style={styles.codeLinks}><Pressable disabled={loading} onPress={() => void sendCode()}><Text style={styles.link}>Resend code</Text></Pressable><Pressable disabled={loading} onPress={resetCode}><Text style={styles.link}>Use a different number</Text></Pressable></View>
      </>
      : <>
        {mode === 'register' && <><View style={styles.roles}>{(['customer', 'owner'] as const).map((value) => <Pressable key={value} onPress={() => setRole(value)} style={[styles.role, role === value && styles.roleActive]}><Text style={[styles.roleText, role === value && styles.roleTextActive]}>{value === 'customer' ? 'Customer' : 'Restaurant owner'}</Text></Pressable>)}</View><Text style={styles.label}>FULL NAME</Text><TextInput autoComplete="name" editable={!loading} onChangeText={setName} placeholder="Your name" style={styles.input} value={name} /></>}
        {method === 'email'
          ? <>
            <Text style={styles.label}>EMAIL</Text><TextInput autoCapitalize="none" autoComplete="email" editable={!loading} keyboardType="email-address" onChangeText={setEmail} placeholder="you@example.com" style={styles.input} value={email} />
            <Text style={styles.label}>PASSWORD</Text><View style={styles.passwordRow}><TextInput autoCapitalize="none" autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} editable={!loading} onChangeText={setPassword} placeholder="At least 6 characters" secureTextEntry={!showPassword} style={styles.passwordInput} value={password} /><Pressable accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} onPress={() => setShowPassword((current) => !current)} style={styles.showButton}><Text style={styles.showText}>{showPassword ? 'Hide' : 'Show'}</Text></Pressable></View>
            {mode === 'sign-in' && <Pressable disabled={loading} onPress={() => void resetPassword()}><Text style={styles.forgot}>Forgot password?</Text></Pressable>}
          </>
          : <>
            <Text style={styles.label}>MOBILE NUMBER</Text><TextInput autoComplete="tel" editable={!loading} keyboardType="phone-pad" onChangeText={setPhone} onSubmitEditing={() => void sendCode()} placeholder="0712 345 678" style={styles.input} value={phone} />
            <Text style={styles.helper}>We will text you a one-time code. Standard SMS rates may apply.</Text>
          </>}
      </>}
    <Pressable disabled={loading} onPress={() => void onPrimaryPress()} style={[styles.button, loading && styles.disabled]}><Text style={styles.buttonText}>{primaryLabel}</Text></Pressable>
    <View style={styles.switchRow}><Text style={styles.switchCopy}>{mode === 'sign-in' ? 'New to Fork?' : 'Already registered?'}</Text><Pressable disabled={loading} onPress={changeMode}><Text style={styles.switchLink}>{mode === 'sign-in' ? 'Create account' : 'Sign in'}</Text></Pressable></View>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF8EE' }, content: { width: '100%', maxWidth: 560, alignSelf: 'center', padding: 22, paddingBottom: 60 }, back: { color: '#B93F1D', fontSize: 14, fontWeight: '800', marginBottom: 28 }, eyebrow: { color: '#B93F1D', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, title: { color: '#271812', fontSize: 36, fontWeight: '900', marginTop: 6 }, subtitle: { color: '#71675F', fontSize: 14, lineHeight: 21, marginTop: 7, marginBottom: 20 }, roles: { flexDirection: 'row', gap: 9, marginTop: 16, marginBottom: 4 }, role: { flex: 1, alignItems: 'center', paddingVertical: 13, borderWidth: 1, borderColor: '#EADFD3', borderRadius: 22, backgroundColor: '#FFF' }, roleActive: { borderColor: '#B93F1D', backgroundColor: '#B93F1D' }, roleText: { color: '#71675F', fontSize: 12, fontWeight: '900' }, roleTextActive: { color: '#FFF' }, label: { color: '#71675F', fontSize: 9, fontWeight: '900', letterSpacing: 0.8, marginTop: 16, marginBottom: 7 }, input: { height: 50, borderWidth: 1, borderColor: '#EADFD3', borderRadius: 14, paddingHorizontal: 15, color: '#271812', backgroundColor: '#FFF' }, passwordRow: { height: 50, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#EADFD3', borderRadius: 14, backgroundColor: '#FFF' }, passwordInput: { flex: 1, height: 48, paddingHorizontal: 15, color: '#271812' }, showButton: { height: 48, justifyContent: 'center', paddingHorizontal: 15 }, showText: { color: '#B93F1D', fontSize: 11, fontWeight: '900' }, forgot: { alignSelf: 'flex-end', color: '#B93F1D', fontSize: 11, fontWeight: '800', marginTop: 10 }, button: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 26, backgroundColor: '#B93F1D', marginTop: 25 }, disabled: { opacity: 0.6 }, buttonText: { color: '#FFF', fontSize: 13, fontWeight: '900' }, switchRow: { flexDirection: 'row', justifyContent: 'center', gap: 7, marginTop: 22 }, switchCopy: { color: '#71675F', fontSize: 12 }, switchLink: { color: '#B93F1D', fontSize: 12, fontWeight: '900' },
  methods: { flexDirection: 'row', padding: 4, borderRadius: 16, backgroundColor: '#F4EAE1' }, method: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12 }, methodActive: { backgroundColor: '#FFF' }, methodText: { color: '#7B7068', fontSize: 12, fontWeight: '800' }, methodTextActive: { color: '#B93F1D' },
  helper: { color: '#8A7F76', fontSize: 11, lineHeight: 16, marginTop: 8 }, codeHint: { color: '#71675F', fontSize: 13, lineHeight: 20, marginTop: 18 }, codePhone: { color: '#271812', fontWeight: '900' }, codeInput: { fontSize: 22, fontWeight: '900', letterSpacing: 6, textAlign: 'center' }, codeLinks: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }, link: { color: '#B93F1D', fontSize: 11, fontWeight: '800', paddingVertical: 4 },
});
