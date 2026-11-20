import { isAuthError, type User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';

import { supabase } from '../../lib/supabase';

export type AccountRole = 'customer' | 'owner';
export type AuthMethod = 'email' | 'phone';
type Context = 'sign-in' | 'register';

/** Links in Kwetu's emails open the app on this screen, which finishes signing the person in. */
export const emailLinkTarget = () => Linking.createURL('auth-callback');

/** Where a signed-in person lands: owners on their dashboard, everyone else on their profile. */
export const homeFor = (user: User | null | undefined) => user?.user_metadata?.role === 'owner' ? '/owner' : '/profile';

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export const isEmail = (email: string) => /^\S+@\S+\.\S+$/.test(email.trim());

const MESSAGES: Record<string, string | Record<Context, string>> = {
  invalid_credentials: 'That email and password do not match a Kwetu account. Check them, or create an account.',
  email_not_confirmed: 'Confirm your email first by opening the link we sent you. You can ask for a new link below.',
  user_already_exists: 'An account with this email already exists. Sign in instead.',
  email_exists: 'An account with this email already exists. Sign in instead.',
  weak_password: 'Choose a stronger password: at least 6 characters.',
  email_address_invalid: 'Enter a valid email address.',
  over_email_send_rate_limit: 'Too many emails were sent from Kwetu in the last hour. Please wait a little and try again.',
  over_request_rate_limit: 'Too many attempts. Wait a minute, then try again.',
  otp_disabled: {
    'sign-in': 'There is no account for this number yet. Tap “Create account” to register.',
    register: 'Phone sign-up is turned off for this app. Please use email.',
  },
  phone_provider_disabled: 'Phone sign-in is not enabled for this app yet. Please use email for now.',
  sms_send_failed: 'We could not send the SMS. Check the number and try again.',
  over_sms_send_rate_limit: 'Too many codes requested. Wait a minute, then try again.',
  otp_expired: 'That code or link is wrong or has expired. Request a new one and try again.',
};

/** A message a customer can act on, instead of Supabase's raw error text. */
export function authErrorMessage(error: unknown, context: Context) {
  if (isAuthError(error)) {
    const known = error.code ? MESSAGES[error.code] : undefined;
    if (typeof known === 'string') return known;
    if (known) return known[context];
    if (/sending (confirmation|recovery|magic link)? ?email/i.test(error.message)) {
      return 'Kwetu could not send the email right now. Please try again in a few minutes.';
    }
  }
  return error instanceof Error ? error.message : 'Please try again.';
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const { data, error } = await supabase.auth.signInWithPassword({ email: normalizeEmail(email), password });
  if (error) throw error;
  return data.user;
}

export type Registration = { name: string; role: AccountRole };

/** Creates an email account. `needsConfirmation` is true when the person must open the emailed link first. */
export async function registerWithEmail(email: string, password: string, { name, role }: Registration) {
  const { data, error } = await supabase.auth.signUp({
    email: normalizeEmail(email),
    password,
    options: { data: { full_name: name.trim(), role }, emailRedirectTo: emailLinkTarget() },
  });
  if (error) throw error;
  // With email confirmation on, Supabase answers an already-registered address with an empty
  // identity list instead of an error, so it does not reveal which emails have accounts.
  if (data.user && data.user.identities?.length === 0) return { user: null, needsConfirmation: false, alreadyRegistered: true };
  return { user: data.user, needsConfirmation: !data.session, alreadyRegistered: false };
}

export async function resendConfirmationEmail(email: string) {
  const { error } = await supabase.auth.resend({ type: 'signup', email: normalizeEmail(email), options: { emailRedirectTo: emailLinkTarget() } });
  if (error) throw error;
}

export async function sendPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email), { redirectTo: emailLinkTarget() });
  if (error) throw error;
}

/** Texts a one-time code. Only registration may create an account; signing in with an unknown number is an error. */
export async function sendPhoneCode(phoneE164: string, registration?: Registration) {
  const { error } = await supabase.auth.signInWithOtp({
    phone: phoneE164,
    options: registration
      ? { channel: 'sms', shouldCreateUser: true, data: { full_name: registration.name.trim(), role: registration.role } }
      : { channel: 'sms', shouldCreateUser: false },
  });
  if (error) throw error;
}

export async function verifyPhoneCode(phoneE164: string, code: string): Promise<User | null> {
  const { data, error } = await supabase.auth.verifyOtp({ phone: phoneE164, token: code, type: 'sms' });
  if (error) throw error;
  return data.user;
}
