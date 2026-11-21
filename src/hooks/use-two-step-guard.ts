import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback } from 'react';

import { twoStepState } from '@/data/two-step';
import { supabase } from '../../lib/supabase';

/**
 * Sends the person to the code screen when they are signed in with their password only, for example
 * because the app was closed before they typed the code. Such a session cannot use the account's data.
 */
export function useTwoStepGuard() {
  useFocusEffect(useCallback(() => {
    let active = true;
    void twoStepState(supabase).then((state) => {
      if (active && state === 'needs-code') router.replace('/two-step' as Href);
    });
    return () => { active = false; };
  }, []));
}
