import { isAuthError } from '@supabase/supabase-js';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';

import { AuthShell, Field, Notice, PasswordField, PrimaryButton, SwitchPrompt, TextLink } from '@/components/auth/auth-ui';
import { authErrorMessage, isEmail, normalizeEmail, resendConfirmationEmail, sendPasswordReset, signInWithEmail } from '@/data/auth';
import { twoStepState } from '@/data/two-step';
import { t } from '@/i18n';
import { goHome } from '@/utils/navigation';
import { supabase } from '../../lib/supabase';

type FieldErrors = { email?: string; password?: string };
type Message = { tone: 'success' | 'error'; title: string; body: string };

/** The note shown when registration sends the person here (?registered=confirm|ready). */
function registeredMessage(registered: string | undefined, email: string): Message | null {
  if (registered === 'confirm') return { tone: 'success', title: t('signIn.created'), body: t('signIn.createdConfirm', { email }) };
  if (registered === 'ready') return { tone: 'success', title: t('signIn.created'), body: t('signIn.createdReady') };
  return null;
}

export default function SignInScreen() {
  const params = useLocalSearchParams<{ role?: string; email?: string; registered?: string }>();
  const forOwner = params.role === 'owner';
  const [email, setEmail] = useState(params.email ?? '');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<Message | null>(() => registeredMessage(params.registered, params.email ?? ''));
  const [unconfirmed, setUnconfirmed] = useState(params.registered === 'confirm');
  const [loading, setLoading] = useState(false);

  // Problems show on the screen, not in pop-ups, so they also appear in the web version.
  const run = async (failTitle: string, action: () => Promise<void>) => {
    setLoading(true);
    setMessage(null);
    try {
      await action();
    } catch (error) {
      if (isAuthError(error) && error.code === 'email_not_confirmed') setUnconfirmed(true);
      setMessage({ tone: 'error', title: failTitle, body: authErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  const signIn = () => {
    const problems: FieldErrors = {};
    if (!isEmail(email)) problems.email = t('signIn.enterEmail');
    if (!password) problems.password = t('signIn.enterPassword');
    setErrors(problems);
    if (problems.email || problems.password) return;
    return run(t('signIn.failed'), async () => {
      await signInWithEmail(email, password);
      // Accounts with two-step sign-in still need the code from their authenticator app.
      if (await twoStepState(supabase) === 'needs-code') router.replace('/two-step' as Href);
      else goHome();
    });
  };

  const forgotPassword = () => {
    if (!isEmail(email)) return setErrors({ email: t('signIn.forgotNeedsEmail') });
    setErrors({});
    return run(t('signIn.emailFailed'), async () => {
      await sendPasswordReset(email);
      setMessage({ tone: 'success', title: t('signIn.checkEmail'), body: t('signIn.resetSent', { email: normalizeEmail(email) }) });
    });
  };

  const resendConfirmation = () => run(t('signIn.emailFailed'), async () => {
    await resendConfirmationEmail(email);
    setUnconfirmed(false);
    setMessage({ tone: 'success', title: t('signIn.confirmSent'), body: t('signIn.confirmSentBody', { email: normalizeEmail(email) }) });
  });

  const typed = (setter: (value: string) => void, field: keyof FieldErrors) => (value: string) => {
    setter(value);
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  };
  const goToRegister = () => router.replace((forOwner ? '/register?role=owner' : '/register') as Href);

  return <AuthShell subtitle={t(forOwner ? 'signIn.subtitleOwner' : 'signIn.subtitle')} title={t('signIn.title')}>
    <Field autoCapitalize="none" autoComplete="email" autoCorrect={false} editable={!loading} error={errors.email} keyboardType="email-address" label={t('auth.email')} onChangeText={typed(setEmail, 'email')} placeholder="you@example.com" textContentType="emailAddress" value={email} />
    <PasswordField autoComplete="current-password" editable={!loading} error={errors.password} label={t('auth.password')} onChangeText={typed(setPassword, 'password')} onSubmitEditing={() => void signIn()} placeholder={t('signIn.passwordPlaceholder')} textContentType="password" value={password} />
    <TextLink align="right" disabled={loading} label={t('signIn.forgot')} onPress={() => void forgotPassword()} />
    {message && <Notice title={message.title} tone={message.tone}>{message.body}</Notice>}
    {unconfirmed && <TextLink align="center" disabled={loading} label={t('signIn.resend')} onPress={() => void resendConfirmation()} />}
    <PrimaryButton label={t('signIn.button')} loading={loading} onPress={() => void signIn()} />
    <SwitchPrompt action={t('register.title')} disabled={loading} onPress={goToRegister} question={t('signIn.newHere')} />
  </AuthShell>;
}
