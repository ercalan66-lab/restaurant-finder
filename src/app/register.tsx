import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { AuthShell, authStyles, Checkbox, Field, Notice, PasswordField, PrimaryButton, Segmented, SwitchPrompt, TextLink } from '@/components/auth/auth-ui';
import { authErrorMessage, homeFor, newAccountProblems, normalizeEmail, PASSWORD_RULE, registerWithEmail, resendConfirmationEmail, type AccountRole } from '@/data/auth';
import { saveGuestProfile } from '@/data/guest-storage';
import { toE164 } from '@/utils/phone';
import { showMessage } from '@/utils/feedback';

const ROLE_OPTIONS: { value: AccountRole; label: string }[] = [{ value: 'customer', label: 'Customer' }, { value: 'owner', label: 'Restaurant owner' }];

export default function RegisterScreen() {
  const params = useLocalSearchParams<{ role?: string }>();
  const [role, setRole] = useState<AccountRole>(params.role === 'owner' ? 'owner' : 'customer');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  // Field errors appear after the first "Create account" tap, then update as the person types.
  const [attempted, setAttempted] = useState(false);
  const [serverError, setServerError] = useState('');
  const [emailSentTo, setEmailSentTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = { name, phone, email, password, confirmPassword, agreed, role };
  const errors = attempted ? newAccountProblems(form) : {};
  const errorCount = Object.keys(errors).length;

  const goToSignIn = (prefill?: string) => {
    const query = [role === 'owner' ? 'role=owner' : '', prefill ? `email=${encodeURIComponent(prefill)}` : ''].filter(Boolean).join('&');
    router.replace(`/sign-in${query ? `?${query}` : ''}` as Href);
  };

  const createAccount = async () => {
    setAttempted(true);
    setServerError('');
    if (Object.keys(newAccountProblems(form)).length) return;
    setLoading(true);
    try {
      const result = await registerWithEmail({ name, phone, email, password, role });
      if (result.alreadyRegistered) {
        showMessage('You already have an account', `${normalizeEmail(email)} is already registered. Sign in instead, or use “Forgot password?”.`);
        return goToSignIn(normalizeEmail(email));
      }
      // Prefill orders and bookings on this device with the same details.
      await saveGuestProfile({ name: name.trim(), phone: toE164(phone) ?? phone.trim(), email: normalizeEmail(email) }).catch(() => undefined);
      if (result.needsConfirmation) return setEmailSentTo(normalizeEmail(email));
      router.replace(homeFor(result.user));
    } catch (error) {
      setServerError(authErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (!emailSentTo) return;
    setLoading(true);
    try {
      await resendConfirmationEmail(emailSentTo);
      showMessage('Email sent again', `Check ${emailSentTo}, including the spam folder.`);
    } catch (error) {
      showMessage('Could not send the email', authErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  // After signing up, the page waits for the person to open the link in their inbox.
  if (emailSentTo) {
    return <AuthShell subtitle="One more step to finish creating your account." title="Check your email">
      <Notice title="Confirmation link sent">{`We sent a link to ${emailSentTo}. Open it on this phone: it confirms your email and signs you in. Check the spam folder if it has not arrived within a minute.`}</Notice>
      <TextLink align="center" disabled={loading} label="Send the email again" onPress={() => void resend()} />
      <PrimaryButton label="I confirmed it – sign in" loading={loading} onPress={() => goToSignIn(emailSentTo)} />
      <TextLink align="center" disabled={loading} label="Use a different email" onPress={() => setEmailSentTo(null)} />
    </AuthShell>;
  }

  return <AuthShell privacyNote={false} subtitle="Fill in all the details below to create your Kwetu account." title="Create account">
    <Text style={authStyles.label}>I AM A</Text>
    <Segmented disabled={loading} onChange={setRole} options={ROLE_OPTIONS} value={role} />

    <Field autoCapitalize="words" autoComplete="name" editable={!loading} error={errors.name} label="FULL NAME" onChangeText={setName} placeholder="e.g. Asha Mohamed" textContentType="name" value={name} />
    <Field autoComplete="tel" editable={!loading} error={errors.phone} hint={role === 'owner' ? 'Customers and Kwetu can reach you on this number.' : 'Restaurants use it to confirm your orders and bookings.'} keyboardType="phone-pad" label="PHONE NUMBER" onChangeText={setPhone} placeholder="0712 345 678" textContentType="telephoneNumber" value={phone} />
    <Field autoCapitalize="none" autoComplete="email" autoCorrect={false} editable={!loading} error={errors.email} hint="You sign in with this email. We send a link to confirm it." keyboardType="email-address" label="EMAIL" onChangeText={setEmail} placeholder="you@example.com" textContentType="emailAddress" value={email} />
    <PasswordField autoComplete="new-password" editable={!loading} error={errors.password} hint={PASSWORD_RULE} label="PASSWORD" onChangeText={setPassword} placeholder="Create a password" textContentType="newPassword" value={password} />
    <PasswordField autoComplete="new-password" editable={!loading} error={errors.confirmPassword} label="CONFIRM PASSWORD" onChangeText={setConfirmPassword} onSubmitEditing={() => void createAccount()} placeholder="Type the password again" textContentType="newPassword" value={confirmPassword} />

    <Checkbox checked={agreed} error={errors.agreed} onChange={setAgreed}>
      I agree to Kwetu&apos;s <Text onPress={() => router.push('/privacy' as Href)} style={styles.link}>privacy policy</Text>.
    </Checkbox>

    {serverError ? <Notice title="Could not create your account" tone="error">{serverError}</Notice> : null}
    {errorCount > 0 && <Text accessibilityLiveRegion="polite" style={styles.summary}>Please fix the {errorCount === 1 ? 'field' : `${errorCount} fields`} marked in red.</Text>}
    <PrimaryButton label="Create account" loading={loading} onPress={() => void createAccount()} />

    <SwitchPrompt action="Sign in" disabled={loading} onPress={() => goToSignIn()} question="Already have an account?" />
  </AuthShell>;
}

const styles = StyleSheet.create({
  link: { color: '#B93F1D', fontWeight: '800', textDecorationLine: 'underline' },
  summary: { color: '#B3261E', fontSize: 12, fontWeight: '700', marginTop: 14 },
});
