import { isAuthError, type User } from '@supabase/supabase-js';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { Alert, Text } from 'react-native';

import { AuthShell, authStyles, Field, METHOD_OPTIONS, Notice, PasswordField, PhoneCodeStep, PrimaryButton, Segmented, SwitchPrompt, TextLink } from '@/components/auth/auth-ui';
import { authErrorMessage, homeFor, isEmail, normalizeEmail, resendConfirmationEmail, sendPasswordReset, sendPhoneCode, signInWithEmail, verifyPhoneCode, type AuthMethod } from '@/data/auth';
import { toE164 } from '@/utils/phone';

export default function SignInScreen() {
  const params = useLocalSearchParams<{ role?: string; email?: string }>();
  const forOwner = params.role === 'owner';
  const [method, setMethod] = useState<AuthMethod>('email');
  const [email, setEmail] = useState(params.email ?? '');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [notice, setNotice] = useState<{ title: string; body: string } | null>(null);

  const finish = (user: User | null) => router.replace(homeFor(user));

  const run = async (failTitle: string, action: () => Promise<void>) => {
    setLoading(true);
    setNotice(null);
    try {
      await action();
    } catch (error) {
      if (isAuthError(error) && error.code === 'email_not_confirmed') setUnconfirmed(true);
      Alert.alert(failTitle, authErrorMessage(error, 'sign-in'));
    } finally {
      setLoading(false);
    }
  };

  const signIn = () => {
    if (!isEmail(email)) return Alert.alert('Check your email', 'Enter the email address you registered with.');
    if (!password) return Alert.alert('Enter your password', 'Type the password for your Kwetu account.');
    return run('Could not sign in', async () => finish(await signInWithEmail(email, password)));
  };

  const forgotPassword = () => {
    if (!isEmail(email)) return Alert.alert('Enter your email first', 'Type your account email above, then tap “Forgot password?” again.');
    return run('Could not send the email', async () => {
      await sendPasswordReset(email);
      setNotice({ title: 'Check your email', body: `If ${normalizeEmail(email)} has a Kwetu account, we sent it a link. Open it on this phone to choose a new password.` });
    });
  };

  const resendConfirmation = () => run('Could not send the email', async () => {
    await resendConfirmationEmail(email);
    setUnconfirmed(false);
    setNotice({ title: 'Confirmation email sent', body: `Open the link we sent to ${normalizeEmail(email)} on this phone. It signs you in.` });
  });

  const sendCode = () => {
    const e164 = toE164(phone);
    if (!e164) return Alert.alert('Check your number', 'Enter a mobile number such as 0712 345 678 or +255 712 345 678.');
    return run('Could not send code', async () => {
      await sendPhoneCode(e164);
      setCode('');
      setCodeSentTo(e164);
    });
  };

  const verifyCode = () => {
    if (!codeSentTo) return;
    if (!/^\d{6,10}$/.test(code)) return Alert.alert('Enter the code', 'Type the code from the SMS we sent you.');
    return run('Could not verify code', async () => finish(await verifyPhoneCode(codeSentTo, code)));
  };

  const changeMethod = (value: AuthMethod) => { setMethod(value); setCodeSentTo(null); setCode(''); setNotice(null); };
  const goToRegister = () => router.replace((forOwner ? '/register?role=owner' : '/register') as Href);

  return <AuthShell subtitle={forOwner ? 'Sign in to manage your restaurant.' : 'Sign in to see your orders, bookings and saved details.'} title="Welcome back">
    <Segmented disabled={loading} onChange={changeMethod} options={METHOD_OPTIONS} value={method} />

    {method === 'email' && <>
      <Field autoCapitalize="none" autoComplete="email" autoCorrect={false} editable={!loading} keyboardType="email-address" label="EMAIL" onChangeText={setEmail} placeholder="you@example.com" textContentType="emailAddress" value={email} />
      <PasswordField autoComplete="current-password" editable={!loading} label="PASSWORD" onChangeText={setPassword} onSubmitEditing={() => void signIn()} placeholder="Your password" textContentType="password" value={password} />
      <TextLink align="right" disabled={loading} label="Forgot password?" onPress={() => void forgotPassword()} />
      {notice && <Notice title={notice.title}>{notice.body}</Notice>}
      {unconfirmed && <TextLink align="center" disabled={loading} label="Resend confirmation email" onPress={() => void resendConfirmation()} />}
      <PrimaryButton label="Sign in" loading={loading} onPress={() => void signIn()} />
    </>}

    {method === 'phone' && (codeSentTo
      ? <PhoneCodeStep code={code} loading={loading} onChangeCode={setCode} onChangeNumber={() => { setCodeSentTo(null); setCode(''); }} onResend={() => void sendCode()} onVerify={() => void verifyCode()} phone={codeSentTo} />
      : <>
        <Field autoComplete="tel" editable={!loading} keyboardType="phone-pad" label="MOBILE NUMBER" onChangeText={setPhone} onSubmitEditing={() => void sendCode()} placeholder="0712 345 678" textContentType="telephoneNumber" value={phone} />
        <Text style={authStyles.helper}>We will text you a one-time code. Standard SMS rates may apply.</Text>
        <PrimaryButton label="Send code" loading={loading} onPress={() => void sendCode()} />
      </>)}

    <SwitchPrompt action="Create account" disabled={loading} onPress={goToRegister} question="New to Kwetu?" />
  </AuthShell>;
}
