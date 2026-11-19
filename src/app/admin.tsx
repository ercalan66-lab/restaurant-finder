import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ACCENT, Chips, type AdminSection } from '@/components/admin/admin-ui';
import { OverviewSection } from '@/components/admin/overview-section';
import { RequestsSection } from '@/components/admin/requests-section';
import { RestaurantsSection } from '@/components/admin/restaurants-section';
import { TeamSection } from '@/components/admin/team-section';
import { checkIsAdmin } from '@/data/admin';
import type { ApprovalStatus } from '@/data/restaurants';
import { goBackOrReplace } from '@/utils/navigation';

type Access = 'checking' | 'denied' | 'granted';

const SECTIONS: { value: AdminSection; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'restaurants', label: 'Restaurants' },
  { value: 'requests', label: 'Orders & bookings' },
  { value: 'team', label: 'Admins' },
];

export default function AdminScreen() {
  const [access, setAccess] = useState<Access>('checking');
  const [section, setSection] = useState<AdminSection>('overview');
  const [reviewTab, setReviewTab] = useState<ApprovalStatus>('pending');

  // Checked on every visit, so signing out or being removed as admin locks the console.
  useFocusEffect(useCallback(() => {
    let active = true;
    void checkIsAdmin().then((isAdmin) => { if (active) setAccess(isAdmin ? 'granted' : 'denied'); });
    return () => { active = false; };
  }, []));

  const openRestaurants = (tab: ApprovalStatus) => { setReviewTab(tab); setSection('restaurants'); };
  const recheck = () => void checkIsAdmin().then((isAdmin) => setAccess(isAdmin ? 'granted' : 'denied'));

  if (access === 'checking') return <Shell><Text style={styles.helper}>Loading…</Text></Shell>;
  if (access === 'denied') return <Shell>
    <Text style={styles.title}>Admins only</Text>
    <Text style={styles.helper}>Sign in with a Fork admin account to open the admin console. Another admin can add your account from Admins.</Text>
    <Pressable accessibilityRole="button" onPress={() => router.push('/auth')}><Text style={styles.link}>Sign in</Text></Pressable>
  </Shell>;

  return <Shell>
    <Text style={styles.eyebrow}>FORK ADMIN</Text>
    <Text style={styles.title}>Admin console</Text>
    <Chips onChange={setSection} options={SECTIONS} value={section} />
    {section === 'overview' && <OverviewSection onOpenRequests={() => setSection('requests')} onOpenRestaurants={openRestaurants} />}
    {section === 'restaurants' && <RestaurantsSection onTabChange={setReviewTab} tab={reviewTab} />}
    {section === 'requests' && <RequestsSection />}
    {section === 'team' && <TeamSection onLeftTeam={recheck} />}
  </Shell>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Pressable onPress={() => goBackOrReplace('/profile')}><Text style={styles.back}>‹ Back</Text></Pressable>
    {children}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF8EE' },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 18, paddingBottom: 60 },
  back: { color: ACCENT, fontSize: 14, fontWeight: '800', marginBottom: 22 },
  eyebrow: { color: ACCENT, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#271812', fontSize: 32, fontWeight: '900', marginTop: 5 },
  helper: { color: '#71675F', fontSize: 13, lineHeight: 19, marginTop: 6 },
  link: { color: ACCENT, fontSize: 13, fontWeight: '800', marginTop: 12 },
});
