import type { User } from '@supabase/supabase-js';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { Alert, Text } from 'react-native';

import { AuthShell, authStyles, Field, METHOD_OPTIONS, Notice, PasswordField, PhoneCodeStep, PrimaryButton, Segmented, SwitchPrompt, TextLink } from '@/components/auth/auth-ui';
import { authErrorMessage, homeFor, isEmail, normalizeEmail, registerWithEmail, resendConfirmationEmail, sendPhoneCode, verifyPhoneCode, type AccountRole, type AuthMethod } from '@/data/auth';
import { toE164 } from '@/utils/phone';

const ROLE_OPTIONS: { value: AccountRole; label: string }[] = [{ value: 'customer', label: 'Customer' }, { value: 'owner', label: 'Restaurant owner' }];
const MIN_PASSWORD = 6;

export default function RegisterScreen() {
  const params = useLocalSearchParams<{ role?: string }>();
  const [role, setRole] = useState<AccountRole>(params.role === 'owner' ? 'owner' : 'customer');
  const [method, setMethod] = useState<AuthMethod>('email');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);
  const [emailSentTo, setEmailSentTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const finish = (user: User | null) => router.replace(homeFor(user));
  const goToSignIn = (prefill?: string) => {
    const query = [role === 'owner' ? 'role=owner' : '', prefill ? `email=${encodeURIComponent(prefill)}` : ''].filter(Boolean).join('&');
    router.replace(`/sign-in${query ? `?${query}` : ''}` as Href);
  };

  const run = async (failTitle: string, action: () => Promise<void>) => {
    setLoading(true);
    try {
      await action();
    } catch (error) {
      Alert.alert(failTitle, authErrorMessage(error, 'register'));
    } finally {
      setLoading(false);
    }
  };

  const createEmailAccount = () => {
    if (!name.trim()) return Alert.alert('Name required', 'Enter your name.');
    if (!isEmail(email)) return Alert.alert('Check your email', 'Enter a valid email address, for example you@example.com.');
    if (password.length < MIN_PASSWORD) return Alert.alert('Choose a longer password', `Use at least ${MIN_PASSWORD} characters.`);
    return run('Could not create account', async () => {
      const result = await registerWithEmail(email, password, { name, role });
      if (result.alreadyRegistered) {
        Alert.alert('You already have an account', `${normalizeEmail(email)} is already registered. Sign in instead, or use “Forgot password?”.`);
        return goToSignIn(normalizeEmail(email));
      }
      if (result.needsConfirmation) return setEmailSentTo(normalizeEmail(email));
      finish(result.user);
    });
  };

  const resend = () => run('Could not send the email', async () => {
    if (!emailSentTo) return;
    await resendConfirmationEmail(emailSentTo);
    Alert.alert('Email sent again', `Check ${emailSentTo}, including the spam folder.`);
  });

  const sendCode = () => {
    if (!name.trim()) return Alert.alert('Name required', 'Enter your name.');
    const e164 = toE164(phone);
    if (!e164) return Alert.alert('Check your number', 'Enter a mobile number such as 0712 345 678 or +255 712 345 678.');
    return run('Could not send code', async () => {
      await sendPhoneCode(e164, { name, role });
      setCode('');
      setCodeSentTo(e164);
    });
  };

  const verifyCode = () => {
    if (!codeSentTo) return;
    if (!/^\d{6,10}$/.test(code)) return Alert.alert('Enter the code', 'Type the code from the SMS we sent you.');
    return run('Could not verify code', async () => finish(await verifyPhoneCode(codeSentTo, code)));
  };

  const changeMethod = (value: AuthMethod) => { setMethod(value); setCodeSentTo(null); setCode(''); };

  // After an email sign-up, the page waits for the person to open the link in their inbox.
  if (emailSentTo) {
    return <AuthShell subtitle="One more step to finish creating your account." title="Check your email">
      <Notice title="Confirmation link sent">{`We sent a link to ${emailSentTo}. Open it on this phone: it confirms your email and signs you in. Check the spam folder if it has not arrived within a minute.`}</Notice>
      <TextLink align="center" disabled={loading} label="Send the email again" onPress={() => void resend()} />
      <PrimaryButton label="I confirmed it – sign in" loading={loading} onPress={() => goToSignIn(emailSentTo)} />
      <TextLink align="center" disabled={loading} label="Use a different email" onPress={() => setEmailSentTo(null)} />
    </AuthShell>;
  }

  return <AuthShell subtitle="Choose how you will use Kwetu, then add your details." title="Create account">
    <Text style={authStyles.label}>I AM A</Text>
    <Segmented disabled={loading || Boolean(codeSentTo)} onChange={setRole} options={ROLE_OPTIONS} value={role} />
    <Field autoCapitalize="words" autoComplete="name" editable={!loading && !codeSentTo} label="FULL NAME" onChangeText={setName} placeholder="Your name" textContentType="name" value={name} />

    <Text style={authStyles.label}>SIGN UP WITH</Text>
    <Segmented disabled={loading} onChange={changeMethod} options={METHOD_OPTIONS} value={method} />

    {method === 'email' && <>
      <Field autoCapitalize="none" autoComplete="email" autoCorrect={false} editable={!loading} keyboardType="email-address" label="EMAIL" onChangeText={setEmail} placeholder="you@example.com" textContentType="emailAddress" value={email} />
      <PasswordField autoComplete="new-password" editable={!loading} label="PASSWORD" onChangeText={setPassword} onSubmitEditing={() => void createEmailAccount()} placeholder={`At least ${MIN_PASSWORD} characters`} textContentType="newPassword" value={password} />
      <Text style={authStyles.helper}>We will email you a link to confirm your address.</Text>
      <PrimaryButton label="Create account" loading={loading} onPress={() => void createEmailAccount()} />
    </>}

    {method === 'phone' && (codeSentTo
      ? <PhoneCodeStep code={code} loading={loading} onChangeCode={setCode} onChangeNumber={() => { setCodeSentTo(null); setCode(''); }} onResend={() => void sendCode()} onVerify={() => void verifyCode()} phone={codeSentTo} />
      : <>
        <Field autoComplete="tel" editable={!loading} keyboardType="phone-pad" label="MOBILE NUMBER" onChangeText={setPhone} onSubmitEditing={() => void sendCode()} placeholder="0712 345 678" textContentType="telephoneNumber" value={phone} />
        <Text style={authStyles.helper}>We will text you a one-time code. Standard SMS rates may apply.</Text>
        <PrimaryButton label="Send code" loading={loading} onPress={() => void sendCode()} />
      </>)}

    <SwitchPrompt action="Sign in" disabled={loading} onPress={() => goToSignIn()} question="Already have an account?" />
  </AuthShell>;
}
