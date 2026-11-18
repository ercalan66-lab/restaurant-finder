import { unregisterDevice } from '@/utils/push-notifications';

import { supabase } from '../../lib/supabase';
import { clearLocalData } from './guest-storage';

/**
 * Permanently deletes the signed-in account (required by the App Store and Google Play).
 * The database hides the owner's restaurant and removes personal details from past requests;
 * this phone's saved details and history are cleared too.
 */
export async function deleteMyAccount() {
  await unregisterDevice();
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;
  // The account no longer exists on the server, so only the local session needs clearing.
  await supabase.auth.signOut({ scope: 'local' });
  await clearLocalData();
}
