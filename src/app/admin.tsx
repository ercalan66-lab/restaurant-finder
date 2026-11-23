import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ACCENT, Chips, type AdminSection } from '@/components/admin/admin-ui';
import { OverviewSection } from '@/components/admin/overview-section';
import { RequestsSection } from '@/components/admin/requests-section';
import { RestaurantsSection } from '@/components/admin/restaurants-section';
import { ReviewsSection } from '@/components/admin/reviews-section';
import { TeamSection } from '@/components/admin/team-section';
import { Field, Notice, PasswordField, PrimaryButton } from '@/components/auth/auth-ui';
import { AuthenticatorSetupForm, CodeStep } from '@/components/auth/two-step';
import { TwoStepCard } from '@/components/auth/two-step-card';
import { adminAccess, adminSignIn, adminSignOut, type AdminAccess } from '@/data/admin';
import { authErrorMessage, isEmail } from '@/data/auth';
import type { ApprovalStatus } from '@/data/restaurants';
import { t } from '@/i18n';
import { showMessage } from '@/utils/feedback';
import { goBackOrReplace } from '@/utils/navigation';
import { themedStyles } from '@/theme/theme';
import { adminSupabase } from '../../lib/supabase';

type Access = 'checking' | AdminAccess;

const SECTIONS: { value: AdminSection; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'restaurants', label: 'Restaurants' },
  { value: 'requests', label: 'Orders' },
  { value: 'reviews', label: 'Reviews' },
  { value: 'team', label: 'Admins' },
];

/**
 * The admin console. It is opened by holding the KWETU logo on the home screen, and has its own
 * sign-in: the customer account on the phone is never used, changed or signed out here.
 */
export default function AdminScreen() {
  const [access, setAccess] = useState<Access>('checking');
  const [section, setSection] = useState<AdminSection>('overview');
  const [reviewTab, setReviewTab] = useState<ApprovalStatus>('pending');
  // Two-step sign-in is optional for admins: they turn it on from the Admins section.
  const [settingUp, setSettingUp] = useState(false);

  // Checked on every visit, so being removed as admin locks the console.
  useFocusEffect(useCallback(() => {
    let active = true;
    void adminAccess().then((next) => { if (active) setAccess(next); });
    return () => { active = false; };
  }, []));

  const openRestaurants = (tab: ApprovalStatus) => { setReviewTab(tab); setSection('restaurants'); };
  const recheck = () => void adminAccess().then(setAccess);
  const signOut = async () => {
    await adminSignOut().catch(() => undefined);
    setSection('overview');
    setAccess('denied');
  };

  if (access === 'checking') return <Shell><Text style={styles.helper}>Loading…</Text></Shell>;
  if (access === 'denied') return <Shell><AdminSignIn onSignedIn={setAccess} /></Shell>;
  if (access === 'needs-code') return <Shell>
    <Text style={styles.eyebrow}>KWETU ADMIN</Text>
    <Text style={styles.title}>Admin sign-in</Text>
    <CodeStep cancelLabel="Cancel and sign out" client={adminSupabase} onCancel={() => void signOut()} onDone={recheck} />
  </Shell>;
  if (settingUp) return <Shell>
    <Text style={styles.eyebrow}>KWETU ADMIN</Text>
    <Text style={styles.title}>Turn on two-step sign-in</Text>
    <Text style={styles.helper}>Optional. After your password, the admin sign-in will also ask for a code from an authenticator app.</Text>
    <AuthenticatorSetupForm client={adminSupabase} onCancel={() => setSettingUp(false)} onDone={() => { setSettingUp(false); showMessage(t('twoStep.onTitle'), t('twoStep.onBody')); }} />
  </Shell>;

  return <Shell>
    <View style={styles.headerRow}>
      <Text style={styles.eyebrow}>KWETU ADMIN</Text>
      <Pressable accessibilityRole="button" hitSlop={8} onPress={() => void signOut()}><Text style={styles.signOut}>Sign out</Text></Pressable>
    </View>
    <Text style={styles.title}>Admin console</Text>
    <Chips onChange={setSection} options={SECTIONS} value={section} />
    {section === 'overview' && <OverviewSection onOpenRequests={() => setSection('requests')} onOpenRestaurants={openRestaurants} />}
    {section === 'restaurants' && <RestaurantsSection onTabChange={setReviewTab} tab={reviewTab} />}
    {section === 'requests' && <RequestsSection />}
    {section === 'reviews' && <ReviewsSection />}
    {section === 'team' && <>
      <TwoStepCard client={adminSupabase} onTurnOn={() => setSettingUp(true)} />
      <TeamSection onLeftTeam={recheck} />
    </>}
  </Shell>;
}

function AdminSignIn({ onSignedIn }: { onSignedIn: (access: AdminAccess) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [problem, setProblem] = useState('');
  const [loading, setLoading] = useState(false);

  const signIn = async () => {
    const next = { email: isEmail(email) ? undefined : 'Enter your admin email address.', password: password ? undefined : 'Enter your password.' };
    setErrors(next);
    setProblem('');
    if (next.email || next.password) return;
    setLoading(true);
    try {
      const access = await adminSignIn(email, password);
      setPassword('');
      onSignedIn(access);
    } catch (error) {
      setProblem(authErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return <>
    <Text style={styles.eyebrow}>KWETU ADMIN</Text>
    <Text style={styles.title}>Admin sign-in</Text>
    <Text style={styles.helper}>For Kwetu admins only. This is separate from the customer account on this phone, which stays as it is.</Text>
    <Field autoCapitalize="none" autoComplete="email" autoCorrect={false} editable={!loading} error={errors.email} keyboardType="email-address" label="ADMIN EMAIL" onChangeText={(value) => { setEmail(value); setErrors((current) => ({ ...current, email: undefined })); }} placeholder="admin@example.com" textContentType="emailAddress" value={email} />
    <PasswordField autoComplete="current-password" editable={!loading} error={errors.password} label="PASSWORD" onChangeText={(value) => { setPassword(value); setErrors((current) => ({ ...current, password: undefined })); }} onSubmitEditing={() => void signIn()} placeholder="Your password" textContentType="password" value={password} />
    {problem ? <Notice title="Could not sign in" tone="error">{problem}</Notice> : null}
    <PrimaryButton label="Sign in to admin console" loading={loading} onPress={() => void signIn()} />
  </>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Pressable onPress={() => goBackOrReplace('/')}><Text style={styles.back}>‹ Back</Text></Pressable>
    {children}
  </ScrollView></SafeAreaView>;
}

const styles = themedStyles(({ bg, fg }) => ({
  safeArea: { flex: 1, backgroundColor: bg('#FFF8EE') },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 18, paddingBottom: 60 },
  back: { color: fg(ACCENT), fontSize: 14, fontWeight: '800', marginBottom: 22 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { color: fg(ACCENT), fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  signOut: { color: fg(ACCENT), fontSize: 13, fontWeight: '800' },
  title: { color: fg('#271812'), fontSize: 32, fontWeight: '900', marginTop: 5 },
  helper: { color: fg('#71675F'), fontSize: 13, lineHeight: 19, marginTop: 6 },
}));
