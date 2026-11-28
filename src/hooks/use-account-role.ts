import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

import { supabase } from '../../lib/supabase';

/** guest: not signed in; customer: a signed-in customer; owner: a restaurant account. */
export type AppRole = 'guest' | 'customer' | 'owner';
export type AccountRole = { role: AppRole; userId: string | null };

const roleOf = (session: Session | null): AccountRole => !session
  ? { role: 'guest', userId: null }
  : { role: session.user.user_metadata?.role === 'owner' ? 'owner' : 'customer', userId: session.user.id };

/**
 * Who is using the app, kept up to date on sign-in and sign-out. null until the saved session has
 * been read (a moment after launch). Restaurant accounts only use their own dashboard: they do not
 * browse or order (the database refuses their orders too, 202611280005_role_separation.sql).
 */
export function useAccountRole(): AccountRole | null {
  const [account, setAccount] = useState<AccountRole | null>(null);
  useEffect(() => {
    // Also fires right away with the current session.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setAccount(roleOf(session)));
    return () => data.subscription.unsubscribe();
  }, []);
  return account;
}
