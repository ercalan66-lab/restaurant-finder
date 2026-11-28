import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { phoneAuthErrorMessage, verifyPhoneCode } from '@/data/auth';
import { t } from '@/i18n';
import { themedStyles } from '@/theme/theme';
import { formatPhoneForDisplay } from '@/utils/phone';

import { TextLink } from './auth-ui';
import { CodeInput } from './two-step';

/** Supabase lets a number ask for a new code once a minute. */
const RESEND_SECONDS = 60;

/**
 * Second step of SMS sign-in: type the code sent to `phone` (`+255…`). `onDone` runs once the
 * person is signed in; `resend` asks for another code.
 */
export function PhoneCodeStep({ onChangeNumber, onDone, phone, resend }: { onChangeNumber: () => void; onDone: () => void; phone: string; resend: () => Promise<unknown> }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [note, setNote] = useState('');
  const [wait, setWait] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  const verify = async (code: string) => {
    setBusy(true);
    setProblem('');
    try {
      await verifyPhoneCode(phone, code);
      onDone();
    } catch (error) {
      setProblem(phoneAuthErrorMessage(error));
      setBusy(false);
    }
  };

  const sendAgain = async () => {
    setProblem('');
    setNote('');
    try {
      await resend();
      setWait(RESEND_SECONDS);
      setNote(t('phone.sentAgain'));
    } catch (error) {
      setProblem(phoneAuthErrorMessage(error));
    }
  };

  return <View>
    <Text style={styles.copy}>{t('phone.codeSent', { phone: formatPhoneForDisplay(phone) })}</Text>
    <CodeInput busy={busy} buttonLabel={t('phone.verify')} onSubmit={(code) => void verify(code)} problem={problem} />
    {note ? <Text accessibilityLiveRegion="polite" style={styles.note}>{note}</Text> : null}
    {wait > 0
      ? <Text style={styles.note}>{t('phone.resendIn', { seconds: wait })}</Text>
      : <TextLink align="center" disabled={busy} label={t('phone.resend')} onPress={() => void sendAgain()} />}
    <TextLink align="center" disabled={busy} label={t('phone.changeNumber')} onPress={onChangeNumber} />
  </View>;
}

const styles = themedStyles(({ fg }) => ({
  copy: { color: fg('#71675F'), fontSize: 13, lineHeight: 19, marginTop: 18 },
  note: { color: fg('#8A7F76'), fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 14 },
}));
