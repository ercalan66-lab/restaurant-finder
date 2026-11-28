import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Action, ACCENT, adminStyles, Badge, Chips, type Loadable } from '@/components/admin/admin-ui';
import { Section } from '@/components/owner/form-controls';
import { LocationManager } from '@/components/owner/location-manager';
import { MenuManager } from '@/components/owner/menu-manager';
import { MenuPdfManager } from '@/components/owner/menu-pdf-manager';
import { MenuPhotosManager } from '@/components/owner/menu-photos-manager';
import { PhotoManager } from '@/components/owner/photo-manager';
import { RestaurantDetailsForm } from '@/components/owner/restaurant-details-form';
import { SetupChecklist } from '@/components/owner/setup-checklist';
import { adminAccess, assignOwner, fetchRestaurantOwner } from '@/data/admin';
import { DashboardDbContext } from '@/data/dashboard-db';
import { createRestaurant, detailsOf, EMPTY_DETAILS, fetchRestaurantById, updateRestaurant, type RestaurantDetails } from '@/data/owner-restaurant';
import type { Restaurant } from '@/data/restaurants';
import { confirmAction, errorMessage, showMessage } from '@/utils/feedback';
import { goBackOrReplace } from '@/utils/navigation';
import { themedStyles } from '@/theme/theme';
import { adminSupabase } from '../../lib/supabase';

type Tab = 'details' | 'menu' | 'photos';
const TABS: { value: Tab; label: string }[] = [
  { value: 'details', label: 'Details' },
  { value: 'menu', label: 'Menu' },
  { value: 'photos', label: 'Photos' },
];
const STATUS_TEXT = {
  pending: 'Waiting for approval: customers cannot see it yet.',
  approved: 'Live: customers can see it and order.',
  rejected: 'Changes requested: customers cannot see it.',
} as const;

/**
 * An admin sets up a restaurant (details, menu, photos) for an owner who will not do it themselves,
 * then hands it to the owner's account. It saves through the admin console's own sign-in.
 */
export default function AdminRestaurantScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const isNew = params.id === 'new';
  const restaurantId = Number(params.id);
  const [access, setAccess] = useState<'checking' | 'denied' | 'granted'>('checking');
  const [state, setState] = useState<Loadable<Restaurant>>({ kind: 'loading' });
  const [owner, setOwner] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('details');

  useEffect(() => {
    let active = true;
    adminAccess()
      .then((result) => { if (active) setAccess(result === 'granted' ? 'granted' : 'denied'); })
      .catch(() => { if (active) setAccess('denied'); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (access !== 'granted' || isNew) return;
    let active = true;
    Promise.all([fetchRestaurantById(restaurantId, adminSupabase), fetchRestaurantOwner(restaurantId)])
      .then(([restaurant, account]) => {
        if (!active) return;
        setOwner(account);
        setState(restaurant ? { kind: 'ready', value: restaurant } : { kind: 'error', message: `Restaurant #${params.id} was not found.` });
      })
      .catch((error: unknown) => { if (active) setState({ kind: 'error', message: errorMessage(error) }); });
    return () => { active = false; };
  }, [access, isNew, params.id, restaurantId]);

  const update = (changes: Partial<Restaurant>) => setState((current) => current.kind === 'ready' ? { kind: 'ready', value: { ...current.value, ...changes } } : current);

  const create = async (details: RestaurantDetails) => {
    try {
      const created = await createRestaurant(null, details, adminSupabase);
      showMessage('Restaurant created', 'Now add its menu and photos, then hand it to the owner’s account.');
      router.replace(`/admin-restaurant?id=${created.id}` as Href);
    } catch (error) {
      showMessage('Could not create the restaurant', errorMessage(error));
    }
  };

  const saveDetails = async (details: RestaurantDetails) => {
    if (state.kind !== 'ready') return;
    try {
      await updateRestaurant(state.value.id, details, adminSupabase);
      update(details);
      showMessage('Saved', 'The restaurant details were updated.');
    } catch (error) {
      showMessage('Could not save', errorMessage(error));
    }
  };

  if (access !== 'granted') {
    return <SafeAreaView style={[styles.safeArea, styles.centered]}>
      {access === 'checking'
        ? <ActivityIndicator color={ACCENT} />
        : <View style={styles.message}>
          <Text style={styles.title}>Admins only</Text>
          <Text style={styles.subtitle}>Sign in to the admin console first, then open this page again.</Text>
          <Action label="Open the admin console" onPress={() => router.replace('/admin' as Href)} />
        </View>}
    </SafeAreaView>;
  }

  return <SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Pressable accessibilityRole="button" onPress={() => goBackOrReplace('/admin')}><Text style={styles.back}>‹ Admin console</Text></Pressable>
    <Text style={styles.eyebrow}>KWETU ADMIN</Text>

    {isNew
      ? <>
        <Text style={styles.title}>Add a restaurant</Text>
        <Text style={styles.subtitle}>For an owner who wants Kwetu to set it up. Fill in the details, then add the menu and photos. Hand it to the owner’s account when it is ready.</Text>
        <Section title="Restaurant details">
          <RestaurantDetailsForm initial={EMPTY_DETAILS} onSubmit={create} submitLabel="Create restaurant" />
        </Section>
      </>
      : state.kind === 'loading'
        ? <ActivityIndicator color={ACCENT} style={styles.spinner} />
        : state.kind === 'error'
          ? <View style={styles.message}>
            <Text style={styles.title}>Could not open this restaurant</Text>
            <Text style={styles.subtitle}>{state.message}</Text>
          </View>
          : <>
            <Text style={styles.title}>{state.value.name}</Text>
            <Text style={styles.subtitle}>{STATUS_TEXT[state.value.approvalStatus]}</Text>
            <Pressable onPress={() => router.push(`/restaurant/${state.value.id}` as Href)}><Text style={adminStyles.link}>View the restaurant page ›</Text></Pressable>

            <OwnerCard onAssigned={setOwner} owner={owner} restaurant={state.value} />

            {/* The owner's own editing screens, saving through the admin's sign-in. */}
            <DashboardDbContext value={adminSupabase}>
              <SetupChecklist onOpen={(next) => setTab(next === 'orders' ? 'menu' : next)} restaurant={state.value} />
              <Chips onChange={setTab} options={TABS} value={tab} />
              {tab === 'details' && <>
                <Section title="Restaurant details">
                  <RestaurantDetailsForm initial={detailsOf(state.value)} key={state.value.id} onSubmit={saveDetails} submitLabel="Save details" />
                </Section>
                <LocationManager onUpdated={update} restaurant={state.value} />
              </>}
              {tab === 'menu' && <>
                <MenuPhotosManager onUpdated={update} restaurant={state.value} />
                <MenuManager onMenuChange={(menu) => update({ menu })} restaurant={state.value} />
                <MenuPdfManager onUpdated={update} restaurant={state.value} />
              </>}
              {tab === 'photos' && <PhotoManager onUpdated={update} restaurant={state.value} />}
            </DashboardDbContext>
          </>}
  </ScrollView></SafeAreaView>;
}

/** Who manages the restaurant, and the form that hands it to an account (by email or phone number). */
function OwnerCard({ onAssigned, owner, restaurant }: { onAssigned: (account: string) => void; owner: string | null; restaurant: Restaurant }) {
  const [account, setAccount] = useState('');
  const [changing, setChanging] = useState(false);
  const [busy, setBusy] = useState(false);
  const hasOwner = owner !== null || restaurant.ownerId !== null;

  const handOver = () => {
    if (!account.trim()) return showMessage('Enter the owner’s account', 'Type the email address or phone number the owner uses to sign in to Kwetu.');
    confirmAction(
      'Hand over this restaurant?',
      `${account.trim()} will manage ${restaurant.name}: they receive its orders and can edit it from their restaurant dashboard.${hasOwner ? ' The current owner loses access.' : ''}`,
      'Hand over',
      () => void (async () => {
        setBusy(true);
        try {
          const label = await assignOwner(restaurant.id, account);
          onAssigned(label);
          setAccount('');
          setChanging(false);
          showMessage('Handed over', `${label} can now open the restaurant dashboard (Settings → Profile → Open restaurant dashboard). ${restaurant.approvalStatus === 'approved' ? '' : 'Approve the restaurant in Restaurants when it is ready.'}`);
        } catch (error) {
          showMessage('Could not hand it over', errorMessage(error));
        } finally {
          setBusy(false);
        }
      })(),
    );
  };

  return <View style={[adminStyles.card, !hasOwner && styles.cardAttention]}>
    <View style={adminStyles.cardTop}>
      <View style={adminStyles.cardCopy}>
        <Text style={adminStyles.eyebrow}>OWNER</Text>
        <Text style={adminStyles.name}>{hasOwner ? owner ?? 'An owner account' : 'No owner yet'}</Text>
      </View>
      {!hasOwner && <Badge attention label="CANNOT RECEIVE ORDERS" />}
    </View>
    <Text style={adminStyles.meta}>{hasOwner
      ? 'This account receives the orders and can edit the restaurant from its own dashboard.'
      : 'Nobody receives this restaurant’s orders until you hand it to the owner’s account. It cannot be approved before that.'}</Text>
    {hasOwner && !changing
      ? <View style={adminStyles.actions}><Action label="Hand to a different account" onPress={() => setChanging(true)} secondary /></View>
      : <>
        <Text style={adminStyles.label}>OWNER’S EMAIL OR PHONE NUMBER</Text>
        <TextInput autoCapitalize="none" autoCorrect={false} editable={!busy} keyboardType="email-address" onChangeText={setAccount} onSubmitEditing={handOver} placeholder="owner@example.com or 0712 345 678" style={adminStyles.input} value={account} />
        <Text style={adminStyles.meta}>The owner must create a Kwetu account in the app first. It becomes a restaurant-owner account.</Text>
        <View style={adminStyles.actions}>
          <Action disabled={busy} label={busy ? 'Handing over…' : 'Hand over'} onPress={handOver} />
          {hasOwner && <Action disabled={busy} label="Cancel" onPress={() => { setChanging(false); setAccount(''); }} secondary />}
        </View>
      </>}
  </View>;
}

const styles = themedStyles(({ bg, fg, line }) => ({
  safeArea: { flex: 1, backgroundColor: bg('#FFF8EE') },
  centered: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 18, paddingBottom: 70 },
  back: { color: fg(ACCENT), fontSize: 14, fontWeight: '800', marginBottom: 22 },
  eyebrow: { color: fg(ACCENT), fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: fg('#271812'), fontSize: 30, fontWeight: '900', marginTop: 5 },
  subtitle: { color: fg('#71675F'), fontSize: 14, lineHeight: 21, marginTop: 6 },
  message: { width: '100%', maxWidth: 420, gap: 10 },
  spinner: { marginVertical: 40 },
  cardAttention: { borderColor: line('#F0B9A8'), backgroundColor: bg('#FFF6F3') },
}));
