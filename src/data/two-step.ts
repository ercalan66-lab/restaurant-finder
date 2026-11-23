import type { Factor, SupabaseClient } from '@supabase/supabase-js';

import { APP_NAME } from '@/constants/app-info';

/**
 * Two-step sign-in with an authenticator app (Supabase MFA, TOTP). After the password, the person types
 * the 6-digit code that an app such as Google Authenticator shows. Optional for everyone: customers,
 * owners and admins can turn it on. The database refuses an account's data to a session that skipped the code
 * (supabase/migrations/202611210005_two_step_sign_in.sql), so a stolen password alone is not enough.
 *
 * Every function takes the client it works on: the customer client, or the admin console's own client.
 */

/**
 * off: the account has no authenticator (or nobody is signed in).
 * needs-code: signed in with the password only; the code is still missing.
 * on: the account has an authenticator and this session passed the code step.
 */
export type TwoStepState = 'off' | 'needs-code' | 'on';

export async function twoStepState(client: SupabaseClient): Promise<TwoStepState> {
  const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return 'off';
  if (data.currentLevel === 'aal2') return 'on';
  return data.nextLevel === 'aal2' ? 'needs-code' : 'off';
}

/** The account's confirmed authenticator, if it has one. */
export async function authenticatorFactor(client: SupabaseClient): Promise<Factor | null> {
  const { data, error } = await client.auth.mfa.listFactors();
  if (error) throw error;
  return data.totp[0] ?? null;
}

export type AuthenticatorSetup = {
  factorId: string;
  /** The key to type into the authenticator app if the link does not open it. */
  secret: string;
  /** otpauth:// link that adds Kwetu to an installed authenticator app. */
  uri: string;
};

/** Starts adding an authenticator. A setup left unfinished earlier is removed first. */
export async function startAuthenticatorSetup(client: SupabaseClient): Promise<AuthenticatorSetup> {
  const { data: factors, error: listError } = await client.auth.mfa.listFactors();
  if (listError) throw listError;
  for (const factor of factors.all.filter((item) => item.factor_type === 'totp' && item.status === 'unverified')) {
    await client.auth.mfa.unenroll({ factorId: factor.id });
  }
  // The authenticator app shows the issuer and the email; the friendly name only has to be unique.
  const { data, error } = await client.auth.mfa.enroll({ factorType: 'totp', issuer: APP_NAME, friendlyName: `${APP_NAME} ${new Date().toISOString()}` });
  if (error) throw error;
  return { factorId: data.id, secret: data.totp.secret, uri: data.totp.uri };
}

/** Drops a setup the person did not finish. Failures are ignored: the next setup removes it anyway. */
export async function cancelAuthenticatorSetup(client: SupabaseClient, factorId: string) {
  await client.auth.mfa.unenroll({ factorId }).catch(() => undefined);
}

/** Checks a 6-digit code. On success this session has passed the code step (Supabase level aal2). */
export async function confirmAuthenticatorCode(client: SupabaseClient, factorId: string, code: string) {
  const { error } = await client.auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\D/g, '') });
  if (error) throw error;
}

/** Turns two-step sign-in off. Supabase allows it only on a session that passed the code step. */
export async function removeAuthenticator(client: SupabaseClient, factorId: string) {
  const { error } = await client.auth.mfa.unenroll({ factorId });
  if (error) throw error;
  await client.auth.refreshSession();
}

/** "JBSW Y3DP EHPK 3PXP": the setup key in groups of four, easier to read and type. */
export const groupedKey = (secret: string) => secret.replace(/(.{4})(?=.)/g, '$1 ');
