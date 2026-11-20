import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { AuthShell, authStyles, Checkbox, Field, Notice, PasswordField, PrimaryButton, Segmented, SwitchPrompt } from '@/components/auth/auth-ui';
import { authErrorMessage, endSignUpSession, newAccountProblems, normalizeEmail, PASSWORD_RULE, registerWithEmail, type AccountRole } from '@/data/auth';
import { saveGuestProfile } from '@/data/guest-storage';
import { toE164 } from '@/utils/phone';
import { showMessage } from '@/utils/feedback';
import { themedStyles } from '@/theme/theme';

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
  const [loading, setLoading] = useState(false);

  const form = { name, phone, email, password, confirmPassword, agreed, role };
  const errors = attempted ? newAccountProblems(form) : {};
  const errorCount = Object.keys(errors).length;

  /** `registered` tells the sign-in page to say the account was created, and whether the email still needs confirming. */
  const goToSignIn = (prefill?: string, registered?: 'confirm' | 'ready') => {
    const query = [
      role === 'owner' ? 'role=owner' : '',
      prefill ? `email=${encodeURIComponent(prefill)}` : '',
      registered ? `registered=${registered}` : '',
    ].filter(Boolean).join('&');
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
      // Everyone signs in after registering, even when Supabase already started a session.
      if (!result.needsConfirmation) await endSignUpSession();
      goToSignIn(normalizeEmail(email), result.needsConfirmation ? 'confirm' : 'ready');
    } catch (error) {
      setServerError(authErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

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

const styles = themedStyles(({ fg }) => ({
  link: { color: fg('#B93F1D'), fontWeight: '800', textDecorationLine: 'underline' },
  summary: { color: fg('#B3261E'), fontSize: 12, fontWeight: '700', marginTop: 14 },
}));
