import { isAuthError } from '@supabase/supabase-js';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';

import { AuthShell, Field, Notice, PasswordField, PrimaryButton, Segmented, SwitchPrompt, TextLink } from '@/components/auth/auth-ui';
import { PhoneCodeStep } from '@/components/auth/phone-code-step';
import { authErrorMessage, isEmail, normalizeEmail, phoneAuthErrorMessage, resendConfirmationEmail, sendPasswordReset, sendPhoneCode, signInWithEmail } from '@/data/auth';
import { twoStepState } from '@/data/two-step';
import { t } from '@/i18n';
import { goHome } from '@/utils/navigation';
import { toE164 } from '@/utils/phone';
import { supabase } from '../../lib/supabase';

type Method = 'phone' | 'email';
type FieldErrors = { email?: string; password?: string; phone?: string };
type Message = { tone: 'success' | 'error'; title: string; body: string };

const methodOptions = (): { value: Method; label: string }[] => [{ value: 'phone', label: t('auth.byPhone') }, { value: 'email', label: t('auth.byEmail') }];

/** The note shown when registration sends the person here (?registered=confirm|ready). */
function registeredMessage(registered: string | undefined, email: string): Message | null {
  if (registered === 'confirm') return { tone: 'success', title: t('signIn.created'), body: t('signIn.createdConfirm', { email }) };
  if (registered === 'ready') return { tone: 'success', title: t('signIn.created'), body: t('signIn.createdReady') };
  return null;
}

/** Accounts with two-step sign-in still need the code from their authenticator app. */
async function finishSignIn() {
  if (await twoStepState(supabase) === 'needs-code') router.replace('/two-step' as Href);
  else goHome();
}

export default function SignInScreen() {
  const params = useLocalSearchParams<{ role?: string; email?: string; registered?: string }>();
  const forOwner = params.role === 'owner';
  // Coming from email registration keeps the email form; otherwise SMS sign-in comes first.
  const [method, setMethod] = useState<Method>(params.email || params.registered ? 'email' : 'phone');
  const [email, setEmail] = useState(params.email ?? '');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<Message | null>(() => registeredMessage(params.registered, params.email ?? ''));
  const [unconfirmed, setUnconfirmed] = useState(params.registered === 'confirm');
  const [loading, setLoading] = useState(false);

  // Problems show on the screen, not in pop-ups, so they also appear in the web version.
  const run = async (failTitle: string, action: () => Promise<void>, describe: (error: unknown) => string = authErrorMessage) => {
    setLoading(true);
    setMessage(null);
    try {
      await action();
    } catch (error) {
      if (isAuthError(error) && error.code === 'email_not_confirmed') setUnconfirmed(true);
      setMessage({ tone: 'error', title: failTitle, body: describe(error) });
    } finally {
      setLoading(false);
    }
  };

  const switchMethod = (next: Method) => {
    setMethod(next);
    setErrors({});
    setMessage(null);
  };

  const signIn = () => {
    const problems: FieldErrors = {};
    if (!isEmail(email)) problems.email = t('signIn.enterEmail');
    if (!password) problems.password = t('signIn.enterPassword');
    setErrors(problems);
    if (problems.email || problems.password) return;
    return run(t('signIn.failed'), async () => {
      await signInWithEmail(email, password);
      await finishSignIn();
    });
  };

  const sendCode = () => {
    const e164 = toE164(phone);
    if (!e164) return setErrors({ phone: phone.trim() ? t('form.invalidPhone') : t('form.enterPhone') });
    setErrors({});
    return run(t('phone.sendFailedTitle'), async () => {
      setCodeSentTo(await sendPhoneCode(e164));
    }, phoneAuthErrorMessage);
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
  const notice = message && <Notice title={message.title} tone={message.tone}>{message.body}</Notice>;

  return <AuthShell subtitle={t(forOwner ? 'signIn.subtitleOwner' : 'signIn.subtitle')} title={t('signIn.title')}>
    <Segmented disabled={loading} onChange={switchMethod} options={methodOptions()} value={method} />
    {method === 'phone'
      ? codeSentTo
        ? <PhoneCodeStep onChangeNumber={() => setCodeSentTo(null)} onDone={() => void finishSignIn()} phone={codeSentTo} resend={() => sendPhoneCode(codeSentTo)} />
        : <>
          <Field autoComplete="tel" editable={!loading} error={errors.phone} hint={t('phone.signInHint')} keyboardType="phone-pad" label={t('register.phone')} onChangeText={typed(setPhone, 'phone')} onSubmitEditing={() => void sendCode()} placeholder="0712 345 678" textContentType="telephoneNumber" value={phone} />
          {notice}
          <PrimaryButton label={t('phone.sendCode')} loading={loading} onPress={() => void sendCode()} />
        </>
      : <>
        <Field autoCapitalize="none" autoComplete="email" autoCorrect={false} editable={!loading} error={errors.email} keyboardType="email-address" label={t('auth.email')} onChangeText={typed(setEmail, 'email')} placeholder="you@example.com" textContentType="emailAddress" value={email} />
        <PasswordField autoComplete="current-password" editable={!loading} error={errors.password} label={t('auth.password')} onChangeText={typed(setPassword, 'password')} onSubmitEditing={() => void signIn()} placeholder={t('signIn.passwordPlaceholder')} textContentType="password" value={password} />
        <TextLink align="right" disabled={loading} label={t('signIn.forgot')} onPress={() => void forgotPassword()} />
        {notice}
        {unconfirmed && <TextLink align="center" disabled={loading} label={t('signIn.resend')} onPress={() => void resendConfirmation()} />}
        <PrimaryButton label={t('signIn.button')} loading={loading} onPress={() => void signIn()} />
      </>}
    <SwitchPrompt action={t('register.title')} disabled={loading} onPress={goToRegister} question={t('signIn.newHere')} />
  </AuthShell>;
}
