import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { router, type Href, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { getRestaurantDetail } from '@/data/restaurant-details';
import { getOwnerRestaurant, isMenuItemAvailable, type OwnerRestaurant } from '@/data/owner-storage';
import { goBackOrReplace } from '@/utils/navigation';

const ORANGE = '#ED6417';
const CREAM = '#FFF8ED';

export default function RestaurantDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const restaurant = getRestaurantDetail(id);
  const [ownerRestaurant, setOwnerRestaurant] = useState<OwnerRestaurant | null>(null);

  useEffect(() => {
    getOwnerRestaurant().then(setOwnerRestaurant).catch(() => setOwnerRestaurant(null));
  }, []);

  if (!restaurant) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.missingTitle}>Restaurant not found</Text>
        <Pressable onPress={() => goBackOrReplace('/')} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Back to restaurants</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const openLink = async (url: string, errorMessage: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Unable to open', errorMessage);
    }
  };

  const usesOwnerMenu = ownerRestaurant?.name.trim().toLowerCase() === restaurant.name.trim().toLowerCase()
    && ownerRestaurant.menu.length > 0;
  const usesOwnerDetails = ownerRestaurant?.name.trim().toLowerCase() === restaurant.name.trim().toLowerCase();
  const address = usesOwnerDetails ? ownerRestaurant.address : restaurant.address;
  const hours = usesOwnerDetails
    ? `Daily · ${ownerRestaurant.opensAt}–${ownerRestaurant.closesAt}`
    : restaurant.hours;
  const directionsUrl = usesOwnerDetails && ownerRestaurant.mapUrl
    ? ownerRestaurant.mapUrl
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${restaurant.name}, ${address}, Dar es Salaam`)}`;

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 32 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <View style={styles.heroWrap}>
          <Image contentFit="cover" source={restaurant.environmentPhotos[0]} style={styles.heroImage} transition={250} />
          <View style={styles.heroShade} />
          <Pressable accessibilityLabel="Back" onPress={() => goBackOrReplace('/')} style={styles.backButton}>
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
          <View style={styles.heroCopy}>
            <Text style={styles.cuisine}>{restaurant.cuisine.toUpperCase()}</Text>
            <Text style={styles.title}>{restaurant.name}</Text>
            <Text style={styles.heroMeta}>★ {restaurant.rating} · {restaurant.area} · {restaurant.distance} km away</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.description}>{restaurant.description}</Text>
          <View style={styles.bookingActions}>
            <Pressable onPress={() => router.push(`/reservation/${restaurant.id}` as Href)} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Reserve a table</Text>
            </Pressable>
            <Pressable onPress={() => router.push(`/order/${restaurant.id}` as Href)} style={styles.orderButton}>
              <Text style={styles.orderButtonText}>Order food</Text>
            </Pressable>
          </View>
          <View style={styles.quickActions}>
            <Pressable onPress={() => openLink(`tel:${restaurant.phone.replace(/\s/g, '')}`, 'Calling is not available on this device.')} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Call restaurant</Text>
            </Pressable>
            <Pressable onPress={() => openLink(directionsUrl, 'Maps could not be opened.')} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Directions</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>The environment</Text>
          <Text style={styles.sectionCaption}>See the dining space before you visit.</Text>
          <ScrollView contentContainerStyle={styles.gallery} horizontal showsHorizontalScrollIndicator={false}>
            {restaurant.environmentPhotos.map((photo, index) => (
              <Image contentFit="cover" key={photo} source={photo} style={[styles.environmentPhoto, index === 0 && styles.environmentPhotoFirst]} transition={200} />
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Menu & food</Text>
          <Text style={styles.sectionCaption}>{usesOwnerMenu ? 'Current foods, ingredients, prices, and availability.' : 'Popular dishes and current sample prices.'}</Text>
          <View style={styles.menuList}>
            {(usesOwnerMenu ? ownerRestaurant.menu : restaurant.menu).map((item) => {
              const managed = 'ingredients' in item;
              const available = managed ? isMenuItemAvailable(item, ownerRestaurant!) : true;
              return (
              <View key={item.name} style={[styles.menuCard, !available && styles.menuCardUnavailable]}>
                {managed ? <View style={styles.foodPlaceholder}><Text style={styles.foodPlaceholderIcon}>🍽️</Text></View> : <Image contentFit="cover" source={item.photo} style={styles.foodPhoto} transition={200} />}
                <View style={styles.menuCopy}>
                  <View style={styles.menuTitleRow}>
                    <Text style={styles.menuName}>{item.name}</Text>
                    <Text style={styles.menuPrice}>{managed ? `TSh ${item.price.toLocaleString()}` : item.price}</Text>
                  </View>
                  <Text style={styles.menuDescription}>{managed ? item.ingredients : item.description}</Text>
                  {managed && <Text style={styles.servingTime}>Served {item.availableFrom}–{item.availableUntil}</Text>}
                  {!available && <Text style={styles.unavailableBadge}>UNAVAILABLE</Text>}
                </View>
              </View>
            );})}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact & visit</Text>
          <View style={styles.contactCard}>
            <Text style={styles.contactLabel}>PHONE</Text>
            <Pressable onPress={() => openLink(`tel:${restaurant.phone.replace(/\s/g, '')}`, 'Calling is not available on this device.')}>
              <Text style={styles.contactLink}>{restaurant.phone}</Text>
            </Pressable>
            <Text style={styles.contactLabel}>EMAIL</Text>
            <Pressable onPress={() => openLink(`mailto:${restaurant.email}`, 'No email application is available.')}>
              <Text style={styles.contactLink}>{restaurant.email}</Text>
            </Pressable>
            <Text style={styles.contactLabel}>ADDRESS</Text>
            <Text style={styles.contactValue}>{address}</Text>
            <Text style={styles.contactLabel}>OPENING HOURS</Text>
            <Text style={styles.contactValue}>{hours}</Text>
            {usesOwnerDetails && ownerRestaurant.facilities.length > 0 ? <>
              <Text style={styles.contactLabel}>FACILITIES</Text>
              <View style={styles.facilities}>{ownerRestaurant.facilities.map((facility) => <Text key={facility} style={styles.facility}>{facility}</Text>)}</View>
            </> : null}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: CREAM },
  content: { width: '100%', maxWidth: 900, alignSelf: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, backgroundColor: CREAM },
  missingTitle: { color: '#171612', fontSize: 24, fontWeight: '900' },
  heroWrap: { height: 390, overflow: 'hidden', backgroundColor: '#2B241E' },
  heroImage: { position: 'absolute', inset: 0 },
  heroShade: { position: 'absolute', inset: 0, backgroundColor: 'rgba(15,10,7,0.42)' },
  backButton: { position: 'absolute', top: 16, left: 16, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.94)' },
  backIcon: { color: '#171612', fontSize: 38, lineHeight: 39, marginTop: -3 },
  heroCopy: { position: 'absolute', left: 20, right: 20, bottom: 24 },
  cuisine: { alignSelf: 'flex-start', color: '#FFF', fontSize: 9, fontWeight: '900', letterSpacing: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, overflow: 'hidden', backgroundColor: ORANGE },
  title: { color: '#FFF', fontSize: 36, lineHeight: 40, fontWeight: '900', marginTop: 12 },
  heroMeta: { color: '#F7EEE6', fontSize: 13, fontWeight: '700', marginTop: 7 },
  section: { paddingHorizontal: 18, paddingTop: 26 },
  description: { color: '#4F4A43', fontSize: 15, lineHeight: 23 },
  sectionTitle: { color: '#171612', fontSize: 24, fontWeight: '900' },
  sectionCaption: { color: '#777268', fontSize: 12, marginTop: 4, marginBottom: 14 },
  quickActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  bookingActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  primaryButton: { flex: 1, minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, backgroundColor: ORANGE },
  primaryButtonText: { color: '#FFF', fontSize: 13, fontWeight: '900' },
  secondaryButton: { flex: 1, minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, borderWidth: 1, borderColor: '#E6DCCE', backgroundColor: '#FFF' },
  secondaryButtonText: { color: '#171612', fontSize: 13, fontWeight: '900' },
  orderButton: { flex: 1, minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, backgroundColor: '#171612' },
  orderButtonText: { color: '#FFF', fontSize: 13, fontWeight: '900' },
  gallery: { gap: 10, paddingRight: 18 },
  environmentPhoto: { width: 260, height: 180, borderRadius: 18, backgroundColor: '#DDD4C9' },
  environmentPhotoFirst: { width: 300 },
  menuList: { gap: 13 },
  menuCard: { overflow: 'hidden', borderRadius: 18, borderWidth: 1, borderColor: '#EEE6DA', backgroundColor: '#FFF' },
  menuCardUnavailable: { opacity: 0.68, backgroundColor: '#FFF8ED' },
  foodPhoto: { width: '100%', height: 190, backgroundColor: '#DDD4C9' },
  foodPlaceholder: { width: '100%', height: 130, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4E9DC' },
  foodPlaceholderIcon: { fontSize: 42 },
  menuCopy: { padding: 14 },
  menuTitleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  menuName: { flex: 1, color: '#171612', fontSize: 16, fontWeight: '900' },
  menuPrice: { color: ORANGE, fontSize: 13, fontWeight: '900' },
  menuDescription: { color: '#777268', fontSize: 12, lineHeight: 18, marginTop: 6 },
  servingTime: { color: '#777268', fontSize: 10, marginTop: 8 },
  unavailableBadge: { alignSelf: 'flex-start', color: '#8E2F1A', backgroundColor: '#F5D8D1', borderRadius: 9, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 4, fontSize: 8, fontWeight: '900', marginTop: 9 },
  contactCard: { gap: 7, padding: 18, borderRadius: 18, borderWidth: 1, borderColor: '#EEE6DA', backgroundColor: '#FFF' },
  contactLabel: { color: '#9A9187', fontSize: 9, fontWeight: '900', letterSpacing: 1, marginTop: 8 },
  contactLink: { color: ORANGE, fontSize: 15, fontWeight: '800' },
  contactValue: { color: '#302C27', fontSize: 14, lineHeight: 20 },
  facilities: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  facility: { color: '#5A4A40', fontSize: 11, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, overflow: 'hidden', backgroundColor: '#FFF3E9' },
});
