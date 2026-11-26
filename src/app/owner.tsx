import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AlertsCard } from '@/components/owner/alerts-card';
import { OWNER_COLORS, PrimaryButton, Section, TextButton } from '@/components/owner/form-controls';
import { LocationManager } from '@/components/owner/location-manager';
import { MenuManager } from '@/components/owner/menu-manager';
import { MenuPdfManager } from '@/components/owner/menu-pdf-manager';
import { MenuPhotosManager } from '@/components/owner/menu-photos-manager';
import { PhotoManager } from '@/components/owner/photo-manager';
import { RestaurantDetailsForm } from '@/components/owner/restaurant-details-form';
import { SetupChecklist, setupSteps, type OwnerTab } from '@/components/owner/setup-checklist';
import { OwnerRequests } from '@/components/owner-requests';
import { createRestaurant, fetchMyRestaurant, updateRestaurant, type RestaurantDetails } from '@/data/owner-restaurant';
import type { Restaurant } from '@/data/restaurants';
import { useTwoStepGuard } from '@/hooks/use-two-step-guard';
import { t, type MessageKey } from '@/i18n';
import { errorMessage, showMessage } from '@/utils/feedback';
import { goBackOrReplace } from '@/utils/navigation';
import { formatAccountPhone } from '@/utils/phone';
import { supabase } from '../../lib/supabase';
import { themedStyles } from '@/theme/theme';

const emptyDetails: RestaurantDetails = { name: '', cuisine: 'African', area: '', address: '', description: '', phone: '', email: '', opensAt: '08:00', closesAt: '22:00', mapUrl: '', facilities: [], pricePerPerson: 0 };

const detailsOf = (restaurant: Restaurant): RestaurantDetails => ({
  name: restaurant.name, cuisine: restaurant.cuisine, area: restaurant.area, address: restaurant.address, description: restaurant.description,
  phone: restaurant.phone, email: restaurant.email, opensAt: restaurant.opensAt, closesAt: restaurant.closesAt, mapUrl: restaurant.mapUrl,
  facilities: restaurant.facilities, pricePerPerson: restaurant.pricePerPerson,
});

type Owner = { id: string; email: string; phone: string };
type LoadResult = { kind: 'redirected' } | { kind: 'error'; message: string } | { kind: 'ready'; owner: Owner; restaurant: Restaurant | null };

async function loadDashboard(): Promise<LoadResult> {
  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      router.replace('/sign-in?role=owner' as Href);
      return { kind: 'redirected' };
    }
    if (data.user.user_metadata?.role !== 'owner') {
      showMessage(t('owner.needOwnerTitle'), t('owner.needOwnerBody'));
      router.replace('/profile');
      return { kind: 'redirected' };
    }
    const registeredPhone = typeof data.user.user_metadata?.phone === 'string' ? data.user.user_metadata.phone : '';
    const owner = { id: data.user.id, email: data.user.email ?? '', phone: formatAccountPhone(data.user.phone) ?? registeredPhone };
    return { kind: 'ready', owner, restaurant: await fetchMyRestaurant(owner.id) };
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) };
  }
}

export default function OwnerDashboardScreen() {
  useTwoStepGuard();
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  const [loadError, setLoadError] = useState('');
  const [owner, setOwner] = useState<Owner | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  // Until the owner picks a tab, open the first one that still has setup work, else Orders.
  const [tab, setTab] = useState<OwnerTab | null>(null);
  const shownTab: OwnerTab = tab ?? (restaurant ? setupSteps(restaurant).find((step) => !step.done)?.tab : undefined) ?? 'orders';

  const apply = useCallback((result: LoadResult) => {
    if (result.kind === 'error') {
      setLoadError(result.message);
      setStatus('error');
    } else if (result.kind === 'ready') {
      setOwner(result.owner);
      setRestaurant(result.restaurant);
      setStatus('ready');
    }
  }, []);

  useEffect(() => {
    let active = true;
    void loadDashboard().then((result) => { if (active) apply(result); });
    return () => { active = false; };
  }, [apply]);

  const retry = () => { setStatus('loading'); void loadDashboard().then(apply); };
  const update = (changes: Partial<Restaurant>) => setRestaurant((current) => current ? { ...current, ...changes } : current);

  const create = async (details: RestaurantDetails) => {
    if (!owner) return;
    try {
      setRestaurant(await createRestaurant(owner.id, details));
      showMessage(t('owner.created'), t('owner.createdBody'));
    } catch (error) {
      const duplicate = typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
      showMessage(t('owner.createFailed'), duplicate ? t('owner.duplicate') : errorMessage(error));
    }
  };

  const saveDetails = async (details: RestaurantDetails) => {
    if (!restaurant) return;
    try {
      await updateRestaurant(restaurant.id, details);
      // Saving a rejected restaurant sends it back for review (done by the database).
      const resubmitted = restaurant.approvalStatus === 'rejected';
      update(resubmitted ? { ...details, approvalStatus: 'pending', rejectionReason: '' } : details);
      showMessage(t('owner.saved'), t(resubmitted ? 'owner.savedResubmitted' : 'owner.savedBody'));
    } catch (error) {
      showMessage(t('owner.saveFailed'), errorMessage(error));
    }
  };

  const setVisible = async (isActive: boolean) => {
    if (!restaurant) return;
    update({ isActive });
    try {
      await updateRestaurant(restaurant.id, { isActive });
    } catch (error) {
      update({ isActive: !isActive });
      showMessage(t('owner.visibilityFailed'), errorMessage(error));
    }
  };

  if (status !== 'ready') {
    return <SafeAreaView style={[styles.safeArea, styles.centered]}>
      {status === 'loading'
        ? <Text style={styles.subtitle}>{t('owner.loading')}</Text>
        : <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>{t('owner.loadFailed')}</Text>
          <Text style={styles.subtitle}>{loadError}</Text>
          <Text style={styles.subtitle}>{t('owner.loadHelp')}</Text>
          <PrimaryButton label={t('owner.tryAgain')} onPress={retry} />
        </View>}
    </SafeAreaView>;
  }

  return <SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Pressable onPress={() => goBackOrReplace('/profile')}><Text style={styles.back}>{t('common.back')}</Text></Pressable>
    <Text style={styles.eyebrow}>{t('owner.eyebrow')}</Text>

    {!restaurant
      ? <>
        <Text style={styles.title}>{t('owner.setupTitle')}</Text>
        <Text style={styles.subtitle}>{t('owner.setupSubtitle')}</Text>
        <Section title={t('owner.detailsSection')}>
          <RestaurantDetailsForm initial={{ ...emptyDetails, email: owner?.email ?? '', phone: owner?.phone ?? '' }} onSubmit={create} submitLabel={t('owner.create')} />
        </Section>
      </>
      : <>
        <Text style={styles.title}>{restaurant.name}</Text>
        <Text style={styles.subtitle}>{t('owner.subtitle')}</Text>
        {restaurant.approvalStatus !== 'approved' && <View style={[styles.reviewCard, restaurant.approvalStatus === 'rejected' && styles.reviewCardRejected]}>
          <Text style={styles.reviewTitle}>{t(restaurant.approvalStatus === 'pending' ? 'owner.pendingTitle' : 'owner.rejectedTitle')}</Text>
          <Text style={styles.reviewCopy}>{restaurant.approvalStatus === 'pending'
            ? t('owner.pendingBody')
            : t('owner.rejectedBody', { reason: restaurant.rejectionReason || t('owner.rejectedDefault') })}</Text>
        </View>}
        <View style={styles.visibilityCard}>
          <View style={styles.visibilityCopy}>
            <Text style={styles.visibilityTitle}>{t(restaurant.isActive ? 'owner.visible' : 'owner.hidden')}</Text>
            <Text style={styles.visibilityHelper}>{t(!restaurant.isActive ? 'owner.turnOnHint' : restaurant.approvalStatus === 'approved' ? 'owner.liveHint' : 'owner.afterApprovalHint')}</Text>
            <TextButton label={t('owner.viewPage')} onPress={() => router.push(`/restaurant/${restaurant.id}` as Href)} />
          </View>
          <Switch accessibilityLabel={t('owner.visible')} onValueChange={(value) => void setVisible(value)} thumbColor="#FFF" trackColor={{ false: '#B8B1AA', true: OWNER_COLORS.accent }} value={restaurant.isActive} />
        </View>

        <SetupChecklist onOpen={setTab} restaurant={restaurant} />
        <OwnerTabs onChange={setTab} value={shownTab} />
        {shownTab === 'orders' && <>
          <AlertsCard />
          <OwnerRequests restaurantId={restaurant.id} />
        </>}
        {shownTab === 'menu' && <>
          <MenuPhotosManager onUpdated={update} restaurant={restaurant} />
          <MenuManager onMenuChange={(menu) => update({ menu })} restaurant={restaurant} />
          <MenuPdfManager onUpdated={update} restaurant={restaurant} />
        </>}
        {shownTab === 'photos' && <PhotoManager onUpdated={update} restaurant={restaurant} />}
        {shownTab === 'details' && <>
          <Section title={t('owner.infoSection')}>
            <RestaurantDetailsForm initial={detailsOf(restaurant)} key={restaurant.id} onSubmit={saveDetails} submitLabel={t('owner.saveInfo')} />
          </Section>
          <LocationManager onUpdated={update} restaurant={restaurant} />
        </>}
      </>}
  </ScrollView></SafeAreaView>;
}

const TABS: { value: OwnerTab; icon: string; label: MessageKey }[] = [
  { value: 'orders', icon: '🧾', label: 'owner.tabOrders' },
  { value: 'menu', icon: '🍽️', label: 'owner.tabMenu' },
  { value: 'photos', icon: '📷', label: 'owner.tabPhotos' },
  { value: 'details', icon: '🏪', label: 'owner.tabDetails' },
];

/** Four big buttons that split the dashboard into Orders, Menu, Photos and Details. */
function OwnerTabs({ onChange, value }: { onChange: (tab: OwnerTab) => void; value: OwnerTab }) {
  return <View accessibilityRole="tablist" style={styles.tabs}>
    {TABS.map((tab) => {
      const selected = tab.value === value;
      return <Pressable accessibilityRole="tab" accessibilityState={{ selected }} key={tab.value} onPress={() => onChange(tab.value)} style={[styles.tab, selected && styles.tabSelected]}>
        <Text style={styles.tabIcon}>{tab.icon}</Text>
        <Text numberOfLines={1} style={[styles.tabLabel, selected && styles.tabLabelSelected]}>{t(tab.label)}</Text>
      </Pressable>;
    })}
  </View>;
}

const styles = themedStyles(({ bg, fg, line }) => ({
  tabs: { flexDirection: 'row', gap: 8, marginTop: 18 },
  tab: { flex: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 4, borderRadius: 16, borderWidth: 1, borderColor: line(OWNER_COLORS.line), backgroundColor: bg('#FFF') },
  tabSelected: { borderColor: line(OWNER_COLORS.accent), backgroundColor: bg(OWNER_COLORS.accent) },
  tabIcon: { fontSize: 20 },
  tabLabel: { color: fg(OWNER_COLORS.ink), fontSize: 12, fontWeight: '900' },
  tabLabelSelected: { color: fg('#FFF') },
  safeArea: { flex: 1, backgroundColor: bg(OWNER_COLORS.cream) },
  centered: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 18, paddingBottom: 70 },
  back: { color: fg(OWNER_COLORS.accent), fontSize: 14, fontWeight: '800', marginBottom: 22 },
  eyebrow: { color: fg(OWNER_COLORS.accent), fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: fg(OWNER_COLORS.ink), fontSize: 34, fontWeight: '900', marginTop: 5 },
  subtitle: { color: fg(OWNER_COLORS.muted), fontSize: 14, lineHeight: 21, marginTop: 6 },
  errorBox: { width: '100%', maxWidth: 420 },
  errorTitle: { color: fg(OWNER_COLORS.ink), fontSize: 22, fontWeight: '900' },
  reviewCard: { marginTop: 18, padding: 15, borderRadius: 18, borderWidth: 1, borderColor: line('#EBD9A8'), backgroundColor: bg('#FFF7DE') },
  reviewCardRejected: { borderColor: line('#E8B7AC'), backgroundColor: bg('#FBE9E5') },
  reviewTitle: { color: fg(OWNER_COLORS.ink), fontSize: 15, fontWeight: '900' },
  reviewCopy: { color: fg('#5A4A40'), fontSize: 12, lineHeight: 18, marginTop: 4 },
  visibilityCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18, padding: 15, borderRadius: 18, borderWidth: 1, borderColor: line(OWNER_COLORS.line), backgroundColor: bg('#FFF') },
  visibilityCopy: { flex: 1, gap: 3 },
  visibilityTitle: { color: fg(OWNER_COLORS.ink), fontSize: 15, fontWeight: '900' },
  visibilityHelper: { color: fg(OWNER_COLORS.muted), fontSize: 11, lineHeight: 16 },
}));
