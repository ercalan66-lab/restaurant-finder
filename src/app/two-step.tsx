import { router, type Href } from 'expo-router';

import { AuthShell } from '@/components/auth/auth-ui';
import { CodeStep } from '@/components/auth/two-step';
import { t } from '@/i18n';
import { goHome } from '@/utils/navigation';
import { supabase } from '../../lib/supabase';

/** After the password: the code from the authenticator app finishes signing in. */
export default function TwoStepScreen() {
  const cancel = async () => {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    router.replace('/sign-in' as Href);
  };

  return <AuthShell privacyNote={false} subtitle={t('twoStep.screenSubtitle')} title={t('twoStep.screenTitle')}>
    <CodeStep cancelLabel={t('twoStep.cancelSignIn')} client={supabase} onCancel={() => void cancel()} onDone={goHome} />
  </AuthShell>;
}
