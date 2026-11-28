import { isAuthError, type User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';

import { t, type MessageKey } from '@/i18n';
import { toE164 } from '@/utils/phone';
import { supabase } from '../../lib/supabase';

export type AccountRole = 'customer' | 'owner';

/** Links in Kwetu's emails open the app on this screen, which finishes signing the person in. */
export const emailLinkTarget = () => Linking.createURL('auth-callback');

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export const isEmail = (email: string) => /^\S+@\S+\.\S+$/.test(email.trim());

export const MIN_PASSWORD_LENGTH = 8;
/** "At least 8 characters, with letters and numbers." */
export const passwordRule = () => t('password.rule', { min: MIN_PASSWORD_LENGTH });

/** What is wrong with a new password, or null when it is strong enough. */
export function passwordProblem(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) return t('password.tooShort', { min: MIN_PASSWORD_LENGTH });
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return t('password.lettersNumbers');
  return null;
}

/** Supabase error codes with a message of our own. */
const MESSAGES: Record<string, MessageKey> = {
  invalid_credentials: 'authError.invalidCredentials',
  email_not_confirmed: 'authError.emailNotConfirmed',
  user_already_exists: 'authError.exists',
  email_exists: 'authError.exists',
  weak_password: 'authError.weakPassword',
  email_address_invalid: 'authError.invalidEmail',
  over_email_send_rate_limit: 'authError.emailRateLimit',
  over_request_rate_limit: 'authError.requestRateLimit',
  otp_expired: 'authError.linkExpired',
  mfa_verification_failed: 'twoStep.wrongCode',
  mfa_verification_rejected: 'twoStep.wrongCode',
  mfa_challenge_expired: 'twoStep.expired',
  insufficient_aal: 'twoStep.codeFirst',
};

/** A message a customer can act on, instead of Supabase's raw error text. */
export function authErrorMessage(error: unknown) {
  if (isAuthError(error)) {
    const known = error.code ? MESSAGES[error.code] : undefined;
    if (known) return t(known, { rule: passwordRule() });
    if (/sending (confirmation|recovery|magic link)? ?email/i.test(error.message)) return t('authError.emailSendFailed');
  }
  return error instanceof Error ? error.message : t('common.tryAgain');
}

/** Supabase error codes from SMS sign-in, where a code is typed instead of a link being opened. */
const PHONE_MESSAGES: Record<string, MessageKey> = {
  otp_expired: 'phone.wrongCode',
  otp_disabled: 'phone.noAccount',
  phone_provider_disabled: 'phone.notReady',
  sms_send_failed: 'phone.sendFailed',
  over_sms_send_rate_limit: 'phone.tooManyCodes',
};

export function phoneAuthErrorMessage(error: unknown) {
  if (isAuthError(error)) {
    const known = error.code ? PHONE_MESSAGES[error.code] : undefined;
    if (known) return t(known);
    if (/signups not allowed for otp/i.test(error.message)) return t('phone.noAccount');
    if (/unsupported phone provider/i.test(error.message)) return t('phone.notReady');
  }
  return authErrorMessage(error);
}

/**
 * Sends a 6-digit sign-in code by SMS and returns the number in `+255…` form.
 * Without `newAccount`, only numbers that already belong to an account get a code.
 * With it, a new number gets an account with these details once the code is confirmed.
 */
export async function sendPhoneCode(phone: string, newAccount?: { name: string; role: AccountRole }) {
  const e164 = toE164(phone);
  if (!e164) throw new Error(t('form.invalidPhone'));
  const { error } = await supabase.auth.signInWithOtp({
    phone: e164,
    options: newAccount
      ? { channel: 'sms', shouldCreateUser: true, data: { full_name: newAccount.name.trim(), phone: e164, role: newAccount.role } }
      : { channel: 'sms', shouldCreateUser: false },
  });
  if (error) throw error;
  return e164;
}

/** Signs the person in with the code from the SMS. */
export async function verifyPhoneCode(e164: string, code: string): Promise<User | null> {
  const { data, error } = await supabase.auth.verifyOtp({ phone: e164, token: code, type: 'sms' });
  if (error) throw error;
  return data.user;
}

export type NewPhoneAccountField = 'name' | 'phone' | 'agreed';

/** Problems with the sign-up-by-phone form, by field. Empty when the code can be sent. */
export function newPhoneAccountProblems(account: { name: string; phone: string; agreed: boolean }) {
  const problems: Partial<Record<NewPhoneAccountField, string>> = {};
  if (account.name.trim().length < 2) problems.name = t('form.enterName');
  if (!account.phone.trim()) problems.phone = t('form.enterPhone');
  else if (!toE164(account.phone)) problems.phone = t('form.invalidPhone');
  if (!account.agreed) problems.agreed = t('form.agree');
  return problems;
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
  if (account.name.trim().length < 2) problems.name = t('form.enterName');
  if (!account.phone.trim()) problems.phone = t('form.enterPhone');
  else if (!toE164(account.phone)) problems.phone = t('form.invalidPhone');
  if (!account.email.trim()) problems.email = t('form.enterEmail');
  else if (!isEmail(account.email)) problems.email = t('form.invalidEmail');
  const passwordIssue = account.password ? passwordProblem(account.password) : t('form.choosePassword');
  if (passwordIssue) problems.password = passwordIssue;
  if (!account.confirmPassword) problems.confirmPassword = t('form.repeatPassword');
  else if (account.confirmPassword !== account.password) problems.confirmPassword = t('form.passwordsDiffer');
  if (!account.agreed) problems.agreed = t('form.agree');
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
