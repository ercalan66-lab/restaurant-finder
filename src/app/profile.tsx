import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { User } from '@supabase/supabase-js';

import { ActivitySection } from '@/components/activity-section';
import { TwoStepCard } from '@/components/auth/two-step-card';
import { deleteMyAccount } from '@/data/account';
import { getGuestProfile, getMyOrders, refreshRequestStatuses, saveGuestProfile, type GuestProfile, type OrderRecord } from '@/data/guest-storage';
import { fetchReviewedReferences } from '@/data/reviews';
import { useTwoStepGuard } from '@/hooks/use-two-step-guard';
import { t } from '@/i18n';
import { confirmAction, errorMessage, showMessage } from '@/utils/feedback';
import { goBackOrReplace, goHome } from '@/utils/navigation';
import { formatAccountPhone, toE164 } from '@/utils/phone';
import { onNotificationReceived, unregisterDevice } from '@/utils/push-notifications';
import { supabase } from '../../lib/supabase';
import { themedStyles } from '@/theme/theme';

// Phone sign-in accounts have no email, so fall back to the phone number.
const accountLabel = (user: User | null) => user ? user.email || formatAccountPhone(user.phone) || t('profile.signedIn') : null;

/** The name, phone and email given at registration (or last saved to the account). */
function accountDetails(user: User): GuestProfile {
  const details = user.user_metadata ?? {};
  return {
    name: typeof details.full_name === 'string' ? details.full_name.trim() : '',
    phone: (typeof details.phone === 'string' ? details.phone : '') || formatAccountPhone(user.phone) || '',
    email: user.email ?? '',
  };
}

const ORANGE = '#ED6417';
const ACTIVITY_REFRESH_MS = 15_000;
const SAVED_PAUSE_MS = 900;

type SaveStatus = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved' } | { kind: 'error'; message: string };

/** Latest statuses first (works for guests too), then this person's orders, and which completed ones are reviewed. */
async function loadActivity() {
  await refreshRequestStatuses().catch(() => false);
  const orders = await getMyOrders();
  const completed = orders.filter((order) => order.status === 'completed').map((order) => order.id);
  const reviewed = await fetchReviewedReferences(completed);
  return { orders, reviewed };
}

export default function ProfileScreen() {
  useTwoStepGuard();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ kind: 'idle' });
  const saving = saveStatus.kind === 'saving';
  // The saved details: the account's registration details when signed in, otherwise the copy kept
  // on this device. While they exist and are not being edited, the form is locked and shows
  // "✓ Saved" with an "Edit profile" button.
  const [savedProfile, setSavedProfile] = useState<GuestProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const editingRef = useRef(false);
  useEffect(() => { editingRef.current = editing; }, [editing]);
  const locked = savedProfile !== null && !editing;
  const [account, setAccount] = useState<string | null>(null);
  const [accountNotice, setAccountNotice] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    getGuestProfile().then((profile) => {
      setName((current) => current || profile.name);
      setPhone((current) => current || profile.phone);
      setEmail((current) => current || profile.email);
      if (profile.name && profile.phone) setSavedProfile((current) => current ?? profile);
    }).catch(() => undefined);
    const applyUser = (user: User | null) => {
      setAccount(accountLabel(user));
      // Never overwrite what the person is typing (sessions refresh in the background).
      if (!user || editingRef.current) return;
      // The account's details win over this phone's copy, so they match on every phone.
      const fromAccount = accountDetails(user);
      setName((current) => fromAccount.name || current);
      setPhone((current) => fromAccount.phone || current);
      setEmail((current) => fromAccount.email || current);
      if (fromAccount.name && fromAccount.phone) {
        setSavedProfile((current) => ({ ...fromAccount, email: fromAccount.email || current?.email || '' }));
      }
    };
    supabase.auth.getUser().then(({ data }) => applyUser(data.user)).catch(() => undefined);
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => applyUser(session?.user ?? null));
    return () => listener.subscription.unsubscribe();
  }, []);

  const applyActivity = useCallback(({ orders: nextOrders, reviewed: nextReviewed }: Awaited<ReturnType<typeof loadActivity>>) => {
    setOrders(nextOrders);
    setReviewed(nextReviewed);
    setHistoryLoading(false);
  }, []);
  const reloadActivity = useCallback(() => void loadActivity().then(applyActivity).catch(() => setHistoryLoading(false)), [applyActivity]);

  // Live status: refresh when the screen opens, every 15 seconds, and when a notification arrives.
  useFocusEffect(useCallback(() => {
    reloadActivity();
    const timer = setInterval(reloadActivity, ACTIVITY_REFRESH_MS);
    const stop = onNotificationReceived(reloadActivity);
    return () => { clearInterval(timer); stop(); };
  }, [reloadActivity]));

  const signOut = async () => {
    await unregisterDevice();
    const { error } = await supabase.auth.signOut();
    if (error) return showMessage(t('profile.signOutFailed'), error.message);
    setAccount(null);
    setAccountNotice(t('profile.signedOut'));
  };

  const deleteAccount = () => confirmAction(
    t('profile.deleteTitle'),
    t('profile.deleteBody'),
    t('profile.deleteAccount'),
    () => void (async () => {
      setDeleting(true);
      try {
        await deleteMyAccount();
        setAccount(null);
        setName(''); setPhone(''); setEmail('');
        setSavedProfile(null); setEditing(false);
        setOrders([]);
        setAccountNotice(t('profile.deleted'));
      } catch (error) {
        showMessage(t('profile.deleteFailed'), errorMessage(error));
      } finally {
        setDeleting(false);
      }
    })(),
  );

  // Feedback stays on the screen (not in a pop-up), because pop-ups do not show in the web version.
  const save = async () => {
    if (!name.trim()) return setSaveStatus({ kind: 'error', message: t('profile.nameRequired') });
    if (!phone.trim()) return setSaveStatus({ kind: 'error', message: t('profile.phoneRequired') });
    setSaveStatus({ kind: 'saving' });
    try {
      const cleanPhone = toE164(phone) ?? phone.trim();
      // Signed in: keep the account up to date too, so other phones and Settings show the new details.
      // (The email here is only a contact email; the sign-in email is not changed.)
      if (account) {
        const { error } = await supabase.auth.updateUser({ data: { full_name: name.trim(), phone: cleanPhone } });
        if (error) throw error;
      }
      const saved = await saveGuestProfile({ name: name.trim(), phone: cleanPhone, email: email.trim() });
      setName(saved.name);
      setPhone(saved.phone);
      setEmail(saved.email);
      setSavedProfile(saved);
      setEditing(false);
      setSaveStatus({ kind: 'saved' });
    } catch (error) {
      const reason = error instanceof Error ? error.message : t('profile.unknownError');
      setSaveStatus({ kind: 'error', message: t('profile.saveFailed', { reason }) });
    }
  };
  // After a successful save, "✓ Saved" shows for a moment, then the app returns to the home page.
  // Typing in that moment cancels it (the status goes back to idle).
  useEffect(() => {
    if (saveStatus.kind !== 'saved') return;
    const timer = setTimeout(goHome, SAVED_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [saveStatus.kind]);
  // Typing again after a problem clears the red message.
  const edit = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    if (saveStatus.kind === 'saved' || saveStatus.kind === 'error') setSaveStatus({ kind: 'idle' });
  };
  const startEditing = () => { setEditing(true); setSaveStatus({ kind: 'idle' }); };
  // Cancel puts back the saved details and locks the form again.
  const cancelEditing = () => {
    if (savedProfile) { setName(savedProfile.name); setPhone(savedProfile.phone); setEmail(savedProfile.email); }
    setEditing(false);
    setSaveStatus({ kind: 'idle' });
  };

  return <SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Pressable onPress={() => goBackOrReplace('/')}><Text style={styles.back}>{t('common.back')}</Text></Pressable>
    <Text style={styles.eyebrow}>{t('profile.eyebrow')}</Text><Text style={styles.title}>{t('profile.title')}</Text><Text style={styles.subtitle}>{t('profile.subtitle')}</Text>

    <View style={styles.accountCard}>
      <Text style={styles.accountLabel}>{t('profile.account')}</Text>
      <Text style={styles.accountValue}>{account ?? t('profile.notSignedIn')}</Text>
      <View style={styles.accountActions}>
        <Pressable disabled={deleting} onPress={account ? () => void signOut() : () => router.push('/sign-in' as Href)}><Text style={styles.accountAction}>{t(account ? 'profile.signOut' : 'profile.signInOrCreate')}</Text></Pressable>
        {account && <Pressable disabled={deleting} onPress={deleteAccount}><Text style={[styles.accountAction, styles.deleteAction]}>{t(deleting ? 'profile.deleting' : 'profile.deleteAccount')}</Text></Pressable>}
      </View>
      {accountNotice ? <Text accessibilityRole="alert" style={styles.accountNotice}>{accountNotice}</Text> : null}
    </View>
    {account && <TwoStepCard />}

    <Text style={styles.label}>{t('profile.name')}</Text><TextInput autoComplete="name" editable={!locked && !saving} onChangeText={edit(setName)} placeholder={t('profile.namePlaceholder')} style={[styles.input, locked && styles.inputLocked]} value={name} />
    <Text style={styles.label}>{t('profile.phone')}</Text><TextInput autoComplete="tel" editable={!locked && !saving} keyboardType="phone-pad" onChangeText={edit(setPhone)} placeholder="+255..." style={[styles.input, locked && styles.inputLocked]} value={phone} />
    <Text style={styles.label}>{t('profile.emailOptional')}</Text><TextInput autoCapitalize="none" autoComplete="email" editable={!locked && !saving} keyboardType="email-address" onChangeText={edit(setEmail)} placeholder="you@example.com" style={[styles.input, locked && styles.inputLocked]} value={email} />
    {locked
      ? <View style={styles.buttonRow}>
        <View accessibilityLabel={t('profile.savedLabel')} accessibilityRole="text" style={[styles.button, styles.buttonSaved, styles.rowButton]}><Text style={styles.buttonText}>{t('profile.saved')}</Text></View>
        <Pressable accessibilityRole="button" onPress={startEditing} style={[styles.secondaryButton, styles.rowButton]}><Text style={styles.secondaryButtonText}>{t('profile.edit')}</Text></Pressable>
      </View>
      : <View style={styles.buttonRow}>
        <Pressable accessibilityRole="button" accessibilityState={{ busy: saving, disabled: saving }} disabled={saving} onPress={() => void save()} style={[styles.button, styles.rowButton, saving && styles.buttonDisabled]}>
          <Text style={styles.buttonText}>{t(saving ? 'common.saving' : 'profile.save')}</Text>
        </Pressable>
        {savedProfile && <Pressable accessibilityRole="button" disabled={saving} onPress={cancelEditing} style={[styles.secondaryButton, styles.rowButton]}><Text style={styles.secondaryButtonText}>{t('common.cancel')}</Text></Pressable>}
      </View>}
    {saveStatus.kind === 'saved' && <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.savedMessage}>{t('profile.savedMessage')}</Text>}
    {saveStatus.kind === 'error' && <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.errorMessage}>{saveStatus.message}</Text>}

    <ActivitySection loading={historyLoading} onChanged={reloadActivity} orders={orders} reviewed={reviewed} signedIn={Boolean(account)} />

    <View style={styles.ownerCard}><Text style={styles.ownerEyebrow}>{t('profile.ownerEyebrow')}</Text><Text style={styles.ownerTitle}>{t('profile.ownerTitle')}</Text><Text style={styles.ownerCopy}>{t('profile.ownerCopy')}</Text><Pressable onPress={() => router.push((account ? '/owner' : '/sign-in?role=owner') as Href)} style={styles.ownerButton}><Text style={styles.ownerButtonText}>{t('profile.ownerButton')}</Text></Pressable></View>

    <Pressable onPress={() => router.push('/privacy' as Href)} style={styles.privacyLink}><Text style={styles.privacyText}>{t('settings.privacy')}</Text></Pressable>
  </ScrollView></SafeAreaView>;
}

const styles = themedStyles(({ bg, fg, line }) => ({
  safeArea: { flex: 1, backgroundColor: bg('#FFF8ED') }, content: { width: '100%', maxWidth: 620, alignSelf: 'center', padding: 20, paddingBottom: 60 }, back: { color: fg(ORANGE), fontSize: 14, fontWeight: '800', marginBottom: 25 }, eyebrow: { color: fg(ORANGE), fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, title: { color: fg('#171612'), fontSize: 34, fontWeight: '900', marginTop: 6 }, subtitle: { color: fg('#777268'), fontSize: 14, lineHeight: 20, marginTop: 7, marginBottom: 20 },
  accountCard: { padding: 14, borderWidth: 1, borderColor: line('#E9DFD2'), borderRadius: 15, backgroundColor: bg('#FFF') }, accountLabel: { color: fg('#777268'), fontSize: 9, fontWeight: '900', letterSpacing: 0.7 }, accountValue: { color: fg('#171612'), fontSize: 13, fontWeight: '800', marginTop: 5 }, accountActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 9 }, accountAction: { color: fg(ORANGE), fontSize: 12, fontWeight: '900' }, deleteAction: { color: fg('#9B321C') }, accountNotice: { color: fg('#28734D'), backgroundColor: bg('#E8F5ED'), borderRadius: 10, padding: 10, fontSize: 12, lineHeight: 17, marginTop: 10 },
  label: { color: fg('#777268'), fontSize: 10, fontWeight: '900', letterSpacing: 0.7, marginTop: 16, marginBottom: 7 }, input: { height: 50, borderWidth: 1, borderColor: line('#E9DFD2'), borderRadius: 14, paddingHorizontal: 15, color: fg('#171612'), backgroundColor: bg('#FFF') }, savedMessage: { color: fg('#28734D'), backgroundColor: bg('#E8F5ED'), borderRadius: 12, padding: 12, fontSize: 12, lineHeight: 17, marginTop: 18 }, button: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 26, backgroundColor: bg(ORANGE), marginTop: 20 }, buttonDisabled: { opacity: 0.6 }, buttonSaved: { backgroundColor: bg('#2E8B57') }, buttonRow: { flexDirection: 'row', gap: 10, marginTop: 20 }, rowButton: { flex: 1, marginTop: 0 }, secondaryButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 26, borderWidth: 1.5, borderColor: line(ORANGE), backgroundColor: bg('#FFF') }, secondaryButtonText: { color: fg(ORANGE), fontSize: 13, fontWeight: '900' }, inputLocked: { backgroundColor: bg('#F6F0E8'), color: fg('#4F4A43') }, errorMessage: { color: fg('#8E2F1A'), backgroundColor: bg('#FBE5DF'), borderRadius: 12, padding: 12, fontSize: 12, lineHeight: 17, marginTop: 12 }, buttonText: { color: fg('#FFF'), fontSize: 13, fontWeight: '900' },
  ownerCard: { marginTop: 28, padding: 20, borderRadius: 22, backgroundColor: bg('#271812') }, ownerEyebrow: { color: fg('#F29A52'), fontSize: 9, fontWeight: '900', letterSpacing: 1 }, ownerTitle: { color: fg('#FFF'), fontSize: 21, fontWeight: '900', marginTop: 6 }, ownerCopy: { color: fg('#D8CEC8'), fontSize: 12, lineHeight: 18, marginTop: 7 }, ownerButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 23, backgroundColor: bg('#B93F1D'), marginTop: 16 }, ownerButtonText: { color: fg('#FFF'), fontSize: 12, fontWeight: '900' },
  privacyLink: { alignSelf: 'center', paddingVertical: 12, marginTop: 18 }, privacyText: { color: fg('#777268'), fontSize: 12, fontWeight: '700', textDecorationLine: 'underline' },
}));
