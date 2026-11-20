import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AlertsCard } from '@/components/owner/alerts-card';
import { OWNER_COLORS, PrimaryButton, Section, TextButton } from '@/components/owner/form-controls';
import { LocationManager } from '@/components/owner/location-manager';
import { MenuManager } from '@/components/owner/menu-manager';
import { MenuPdfManager } from '@/components/owner/menu-pdf-manager';
import { PhotoManager } from '@/components/owner/photo-manager';
import { RestaurantDetailsForm } from '@/components/owner/restaurant-details-form';
import { OwnerRequests } from '@/components/owner-requests';
import { createRestaurant, fetchMyRestaurant, updateRestaurant, type RestaurantDetails } from '@/data/owner-restaurant';
import type { Restaurant } from '@/data/restaurants';
import { errorMessage } from '@/utils/feedback';
import { goBackOrReplace } from '@/utils/navigation';
import { formatAccountPhone } from '@/utils/phone';
import { supabase } from '../../lib/supabase';

const emptyDetails: RestaurantDetails = { name: '', cuisine: 'African', area: '', address: '', description: '', phone: '', email: '', opensAt: '08:00', closesAt: '22:00', mapUrl: '', facilities: [], pricePerPerson: 0, seatsPerSlot: 40 };

const detailsOf = (restaurant: Restaurant): RestaurantDetails => ({
  name: restaurant.name, cuisine: restaurant.cuisine, area: restaurant.area, address: restaurant.address, description: restaurant.description,
  phone: restaurant.phone, email: restaurant.email, opensAt: restaurant.opensAt, closesAt: restaurant.closesAt, mapUrl: restaurant.mapUrl,
  facilities: restaurant.facilities, pricePerPerson: restaurant.pricePerPerson, seatsPerSlot: restaurant.seatsPerSlot,
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
      Alert.alert('Owner account required', 'Create or sign in with a restaurant-owner account.');
      router.replace('/profile');
      return { kind: 'redirected' };
    }
    const owner = { id: data.user.id, email: data.user.email ?? '', phone: formatAccountPhone(data.user.phone) ?? '' };
    return { kind: 'ready', owner, restaurant: await fetchMyRestaurant(owner.id) };
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) };
  }
}

export default function OwnerDashboardScreen() {
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  const [loadError, setLoadError] = useState('');
  const [owner, setOwner] = useState<Owner | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);

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
      Alert.alert('Restaurant created', 'Kwetu will review it before customers can see it. Meanwhile, add a cover photo and your menu.');
    } catch (error) {
      const duplicate = typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
      Alert.alert('Could not create restaurant', duplicate ? 'This account already has a restaurant. Reopen the dashboard to manage it.' : errorMessage(error));
    }
  };

  const saveDetails = async (details: RestaurantDetails) => {
    if (!restaurant) return;
    try {
      await updateRestaurant(restaurant.id, details);
      // Saving a rejected restaurant sends it back for review (done by the database).
      const resubmitted = restaurant.approvalStatus === 'rejected';
      update(resubmitted ? { ...details, approvalStatus: 'pending', rejectionReason: '' } : details);
      Alert.alert('Saved', resubmitted ? 'Restaurant information updated and sent to Kwetu for review again.' : 'Restaurant information updated.');
    } catch (error) {
      Alert.alert('Could not save', errorMessage(error));
    }
  };

  const setVisible = async (isActive: boolean) => {
    if (!restaurant) return;
    update({ isActive });
    try {
      await updateRestaurant(restaurant.id, { isActive });
    } catch (error) {
      update({ isActive: !isActive });
      Alert.alert('Could not change visibility', errorMessage(error));
    }
  };

  if (status !== 'ready') {
    return <SafeAreaView style={[styles.safeArea, styles.centered]}>
      {status === 'loading'
        ? <Text style={styles.subtitle}>Loading your restaurant…</Text>
        : <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Could not load your restaurant</Text>
          <Text style={styles.subtitle}>{loadError}</Text>
          <Text style={styles.subtitle}>Check your connection. If the app was just updated, make sure the latest Supabase migrations have been run.</Text>
          <PrimaryButton label="Try again" onPress={retry} />
        </View>}
    </SafeAreaView>;
  }

  return <SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Pressable onPress={() => goBackOrReplace('/profile')}><Text style={styles.back}>‹ Back</Text></Pressable>
    <Text style={styles.eyebrow}>RESTAURANT OWNER</Text>

    {!restaurant
      ? <>
        <Text style={styles.title}>Set up your restaurant</Text>
        <Text style={styles.subtitle}>Tell customers about your place. You can add photos and your menu right after.</Text>
        <Section title="Restaurant details">
          <RestaurantDetailsForm initial={{ ...emptyDetails, email: owner?.email ?? '', phone: owner?.phone ?? '' }} onSubmit={create} submitLabel="Create restaurant" />
        </Section>
      </>
      : <>
        <Text style={styles.title}>{restaurant.name}</Text>
        <Text style={styles.subtitle}>Manage what customers see, and handle their orders and bookings.</Text>
        {restaurant.approvalStatus !== 'approved' && <View style={[styles.reviewCard, restaurant.approvalStatus === 'rejected' && styles.reviewCardRejected]}>
          <Text style={styles.reviewTitle}>{restaurant.approvalStatus === 'pending' ? 'Waiting for approval' : 'Changes needed'}</Text>
          <Text style={styles.reviewCopy}>{restaurant.approvalStatus === 'pending'
            ? 'Kwetu reviews every new restaurant before customers can see it. You will get a notification when it is approved. Meanwhile, add photos and your menu.'
            : `${restaurant.rejectionReason || 'Kwetu asked for changes to your listing.'} Update your details and save them to send the restaurant for review again.`}</Text>
        </View>}
        <View style={styles.visibilityCard}>
          <View style={styles.visibilityCopy}>
            <Text style={styles.visibilityTitle}>{restaurant.isActive ? 'Visible to customers' : 'Hidden from customers'}</Text>
            <Text style={styles.visibilityHelper}>{!restaurant.isActive ? 'Turn this on when your page is ready.' : restaurant.approvalStatus === 'approved' ? 'Your restaurant appears in search and accepts orders.' : 'It will appear in search once Kwetu approves it.'}</Text>
            <TextButton label="View customer page ›" onPress={() => router.push(`/restaurant/${restaurant.id}` as Href)} />
          </View>
          <Switch accessibilityLabel="Visible to customers" onValueChange={(value) => void setVisible(value)} thumbColor="#FFF" trackColor={{ false: '#B8B1AA', true: OWNER_COLORS.accent }} value={restaurant.isActive} />
        </View>

        <AlertsCard />
        <OwnerRequests restaurantId={restaurant.id} />
        <PhotoManager onUpdated={update} restaurant={restaurant} />
        <Section title="Restaurant information">
          <RestaurantDetailsForm initial={detailsOf(restaurant)} key={restaurant.id} onSubmit={saveDetails} submitLabel="Save restaurant information" />
        </Section>
        <LocationManager onUpdated={update} restaurant={restaurant} />
        <MenuPdfManager onUpdated={update} restaurant={restaurant} />
        <MenuManager onMenuChange={(menu) => update({ menu })} restaurant={restaurant} />
      </>}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: OWNER_COLORS.cream },
  centered: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 18, paddingBottom: 70 },
  back: { color: OWNER_COLORS.accent, fontSize: 14, fontWeight: '800', marginBottom: 22 },
  eyebrow: { color: OWNER_COLORS.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: OWNER_COLORS.ink, fontSize: 34, fontWeight: '900', marginTop: 5 },
  subtitle: { color: OWNER_COLORS.muted, fontSize: 14, lineHeight: 21, marginTop: 6 },
  errorBox: { width: '100%', maxWidth: 420 },
  errorTitle: { color: OWNER_COLORS.ink, fontSize: 22, fontWeight: '900' },
  reviewCard: { marginTop: 18, padding: 15, borderRadius: 18, borderWidth: 1, borderColor: '#EBD9A8', backgroundColor: '#FFF7DE' },
  reviewCardRejected: { borderColor: '#E8B7AC', backgroundColor: '#FBE9E5' },
  reviewTitle: { color: OWNER_COLORS.ink, fontSize: 15, fontWeight: '900' },
  reviewCopy: { color: '#5A4A40', fontSize: 12, lineHeight: 18, marginTop: 4 },
  visibilityCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18, padding: 15, borderRadius: 18, borderWidth: 1, borderColor: OWNER_COLORS.line, backgroundColor: '#FFF' },
  visibilityCopy: { flex: 1, gap: 3 },
  visibilityTitle: { color: OWNER_COLORS.ink, fontSize: 15, fontWeight: '900' },
  visibilityHelper: { color: OWNER_COLORS.muted, fontSize: 11, lineHeight: 16 },
});
