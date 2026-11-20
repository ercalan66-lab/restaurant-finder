import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { AuthShell, authStyles, Checkbox, Field, Notice, PasswordField, PrimaryButton, Segmented, SwitchPrompt } from '@/components/auth/auth-ui';
import { authErrorMessage, endSignUpSession, newAccountProblems, normalizeEmail, passwordRule, registerWithEmail, type AccountRole } from '@/data/auth';
import { saveGuestProfile } from '@/data/guest-storage';
import { t, tn } from '@/i18n';
import { toE164 } from '@/utils/phone';
import { showMessage } from '@/utils/feedback';
import { themedStyles } from '@/theme/theme';

const roleOptions = (): { value: AccountRole; label: string }[] => [{ value: 'customer', label: t('register.customer') }, { value: 'owner', label: t('register.owner') }];

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
        showMessage(t('register.alreadyTitle'), t('register.alreadyBody', { email: normalizeEmail(email) }));
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

  return <AuthShell privacyNote={false} subtitle={t('register.subtitle')} title={t('register.title')}>
    <Text style={authStyles.label}>{t('register.iAm')}</Text>
    <Segmented disabled={loading} onChange={setRole} options={roleOptions()} value={role} />

    <Field autoCapitalize="words" autoComplete="name" editable={!loading} error={errors.name} label={t('register.fullName')} onChangeText={setName} placeholder={t('register.namePlaceholder')} textContentType="name" value={name} />
    <Field autoComplete="tel" editable={!loading} error={errors.phone} hint={t(role === 'owner' ? 'register.phoneHintOwner' : 'register.phoneHint')} keyboardType="phone-pad" label={t('register.phone')} onChangeText={setPhone} placeholder="0712 345 678" textContentType="telephoneNumber" value={phone} />
    <Field autoCapitalize="none" autoComplete="email" autoCorrect={false} editable={!loading} error={errors.email} hint={t('register.emailHint')} keyboardType="email-address" label={t('auth.email')} onChangeText={setEmail} placeholder="you@example.com" textContentType="emailAddress" value={email} />
    <PasswordField autoComplete="new-password" editable={!loading} error={errors.password} hint={passwordRule()} label={t('auth.password')} onChangeText={setPassword} placeholder={t('register.passwordPlaceholder')} textContentType="newPassword" value={password} />
    <PasswordField autoComplete="new-password" editable={!loading} error={errors.confirmPassword} label={t('register.confirmPassword')} onChangeText={setConfirmPassword} onSubmitEditing={() => void createAccount()} placeholder={t('register.confirmPlaceholder')} textContentType="newPassword" value={confirmPassword} />

    <Checkbox checked={agreed} error={errors.agreed} onChange={setAgreed}>
      {t('register.agreeBefore')}<Text onPress={() => router.push('/privacy' as Href)} style={styles.link}>{t('auth.privacyLink')}</Text>{t('register.agreeAfter')}
    </Checkbox>

    {serverError ? <Notice title={t('register.failed')} tone="error">{serverError}</Notice> : null}
    {errorCount > 0 && <Text accessibilityLiveRegion="polite" style={styles.summary}>{tn('register.fixFields', errorCount)}</Text>}
    <PrimaryButton label={t('register.title')} loading={loading} onPress={() => void createAccount()} />

    <SwitchPrompt action={t('signIn.button')} disabled={loading} onPress={() => goToSignIn()} question={t('register.haveAccount')} />
  </AuthShell>;
}

const styles = themedStyles(({ fg }) => ({
  link: { color: fg('#B93F1D'), fontWeight: '800', textDecorationLine: 'underline' },
  summary: { color: fg('#B3261E'), fontSize: 12, fontWeight: '700', marginTop: 14 },
}));
