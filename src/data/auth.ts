import { isAuthError, type User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';

import { toE164 } from '@/utils/phone';
import { supabase } from '../../lib/supabase';

export type AccountRole = 'customer' | 'owner';

/** Links in Kwetu's emails open the app on this screen, which finishes signing the person in. */
export const emailLinkTarget = () => Linking.createURL('auth-callback');

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export const isEmail = (email: string) => /^\S+@\S+\.\S+$/.test(email.trim());

export const MIN_PASSWORD_LENGTH = 8;
export const PASSWORD_RULE = `At least ${MIN_PASSWORD_LENGTH} characters, with letters and numbers.`;

/** What is wrong with a new password, or null when it is strong enough. */
export function passwordProblem(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Use both letters and numbers.';
  return null;
}

const MESSAGES: Record<string, string> = {
  invalid_credentials: 'That email and password do not match a Kwetu account. Check them, or create an account.',
  email_not_confirmed: 'Confirm your email first by opening the link we sent you. You can ask for a new link below.',
  user_already_exists: 'An account with this email already exists. Sign in instead.',
  email_exists: 'An account with this email already exists. Sign in instead.',
  weak_password: `Choose a stronger password. ${PASSWORD_RULE}`,
  email_address_invalid: 'Enter a valid email address.',
  over_email_send_rate_limit: 'Too many emails were sent from Kwetu in the last hour. Please wait a little and try again.',
  over_request_rate_limit: 'Too many attempts. Wait a minute, then try again.',
  otp_expired: 'That link is wrong or has expired. Request a new one and try again.',
};

/** A message a customer can act on, instead of Supabase's raw error text. */
export function authErrorMessage(error: unknown) {
  if (isAuthError(error)) {
    const known = error.code ? MESSAGES[error.code] : undefined;
    if (known) return known;
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

export type NewAccount = { name: string; phone: string; email: string; password: string; role: AccountRole };
export type NewAccountField = 'name' | 'phone' | 'email' | 'password' | 'confirmPassword' | 'agreed';

/** Every problem with the registration form, by field. Empty when the form can be sent. */
export function newAccountProblems(account: NewAccount & { confirmPassword: string; agreed: boolean }) {
  const problems: Partial<Record<NewAccountField, string>> = {};
  if (account.name.trim().length < 2) problems.name = 'Enter your full name.';
  if (!account.phone.trim()) problems.phone = 'Enter your phone number.';
  else if (!toE164(account.phone)) problems.phone = 'Enter a mobile number such as 0712 345 678 or +255 712 345 678.';
  if (!account.email.trim()) problems.email = 'Enter your email address.';
  else if (!isEmail(account.email)) problems.email = 'Enter a valid email address, for example you@example.com.';
  const passwordIssue = account.password ? passwordProblem(account.password) : 'Choose a password.';
  if (passwordIssue) problems.password = passwordIssue;
  if (!account.confirmPassword) problems.confirmPassword = 'Type the password again.';
  else if (account.confirmPassword !== account.password) problems.confirmPassword = 'The passwords do not match.';
  if (!account.agreed) problems.agreed = 'Tick the box to agree to the privacy policy.';
  return problems;
}

/**
 * Creates an email account with the person's name, phone and role saved on it.
 * `needsConfirmation` is true when they must open the emailed link first.
 */
export async function registerWithEmail({ email, name, password, phone, role }: NewAccount) {
  const { data, error } = await supabase.auth.signUp({
    email: normalizeEmail(email),
    password,
    options: { data: { full_name: name.trim(), phone: toE164(phone) ?? phone.trim(), role }, emailRedirectTo: emailLinkTarget() },
  });
  if (error) throw error;
  // With email confirmation on, Supabase answers an already-registered address with an empty
  // identity list instead of an error, so it does not reveal which emails have accounts.
  if (data.user && data.user.identities?.length === 0) return { user: null, needsConfirmation: false, alreadyRegistered: true };
  return { user: data.user, needsConfirmation: !data.session, alreadyRegistered: false };
}

/** Ends the session that sign-up may have started, so the person signs in themselves next. */
export async function endSignUpSession() {
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
}

export async function resendConfirmationEmail(email: string) {
  const { error } = await supabase.auth.resend({ type: 'signup', email: normalizeEmail(email), options: { emailRedirectTo: emailLinkTarget() } });
  if (error) throw error;
}

export async function sendPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email), { redirectTo: emailLinkTarget() });
  if (error) throw error;
}
