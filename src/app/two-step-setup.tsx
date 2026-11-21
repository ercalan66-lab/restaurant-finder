import { AuthShell } from '@/components/auth/auth-ui';
import { AuthenticatorSetupForm } from '@/components/auth/two-step';
import { t } from '@/i18n';
import { showMessage } from '@/utils/feedback';
import { goBackOrReplace } from '@/utils/navigation';
import { supabase } from '../../lib/supabase';

/** Turns on two-step sign-in for the signed-in customer or owner (opened from the profile). */
export default function TwoStepSetupScreen() {
  const done = () => {
    goBackOrReplace('/profile');
    showMessage(t('twoStep.onTitle'), t('twoStep.onBody'));
  };

  return <AuthShell privacyNote={false} subtitle={t('twoStep.setupSubtitle')} title={t('twoStep.setupTitle')}>
    <AuthenticatorSetupForm client={supabase} onCancel={() => goBackOrReplace('/profile')} onDone={done} />
  </AuthShell>;
}
