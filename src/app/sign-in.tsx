import { isAuthError } from '@supabase/supabase-js';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';

import { AuthShell, Field, Notice, PasswordField, PrimaryButton, SwitchPrompt, TextLink } from '@/components/auth/auth-ui';
import { authErrorMessage, homeFor, isEmail, normalizeEmail, resendConfirmationEmail, sendPasswordReset, signInWithEmail } from '@/data/auth';

type FieldErrors = { email?: string; password?: string };
type Message = { tone: 'success' | 'error'; title: string; body: string };

export default function SignInScreen() {
  const params = useLocalSearchParams<{ role?: string; email?: string }>();
  const forOwner = params.role === 'owner';
  const [email, setEmail] = useState(params.email ?? '');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<Message | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);
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
    if (!isEmail(email)) problems.email = 'Enter the email address you registered with.';
    if (!password) problems.password = 'Enter your password.';
    setErrors(problems);
    if (problems.email || problems.password) return;
    return run('Could not sign in', async () => {
      const user = await signInWithEmail(email, password);
      router.replace(homeFor(user));
    });
  };

  const forgotPassword = () => {
    if (!isEmail(email)) return setErrors({ email: 'Type your account email here first, then tap “Forgot password?” again.' });
    setErrors({});
    return run('Could not send the email', async () => {
      await sendPasswordReset(email);
      setMessage({ tone: 'success', title: 'Check your email', body: `If ${normalizeEmail(email)} has a Kwetu account, we sent it a link. Open it on this phone to choose a new password.` });
    });
  };

  const resendConfirmation = () => run('Could not send the email', async () => {
    await resendConfirmationEmail(email);
    setUnconfirmed(false);
    setMessage({ tone: 'success', title: 'Confirmation email sent', body: `Open the link we sent to ${normalizeEmail(email)} on this phone. It signs you in.` });
  });

  const typed = (setter: (value: string) => void, field: keyof FieldErrors) => (value: string) => {
    setter(value);
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  };
  const goToRegister = () => router.replace((forOwner ? '/register?role=owner' : '/register') as Href);

  return <AuthShell subtitle={forOwner ? 'Sign in to manage your restaurant.' : 'Sign in to see your orders, bookings and saved details.'} title="Welcome back">
    <Field autoCapitalize="none" autoComplete="email" autoCorrect={false} editable={!loading} error={errors.email} keyboardType="email-address" label="EMAIL" onChangeText={typed(setEmail, 'email')} placeholder="you@example.com" textContentType="emailAddress" value={email} />
    <PasswordField autoComplete="current-password" editable={!loading} error={errors.password} label="PASSWORD" onChangeText={typed(setPassword, 'password')} onSubmitEditing={() => void signIn()} placeholder="Your password" textContentType="password" value={password} />
    <TextLink align="right" disabled={loading} label="Forgot password?" onPress={() => void forgotPassword()} />
    {message && <Notice title={message.title} tone={message.tone}>{message.body}</Notice>}
    {unconfirmed && <TextLink align="center" disabled={loading} label="Resend confirmation email" onPress={() => void resendConfirmation()} />}
    <PrimaryButton label="Sign in" loading={loading} onPress={() => void signIn()} />
    <SwitchPrompt action="Create account" disabled={loading} onPress={goToRegister} question="New to Kwetu?" />
  </AuthShell>;
}
