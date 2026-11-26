import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { router, type Href, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { PhotoViewer } from '@/components/photo-viewer';
import { RestaurantReviews } from '@/components/restaurant-reviews';
import { listEntering, PressableScale } from '@/components/ui/motion';
import { categoryIcon, categoryLabel, groupByCategory, type MenuCategory } from '@/data/menu-categories';
import { menuPdfDownloadUrl } from '@/data/restaurant-menu-pdf';
import { formatHours, formatTsh, isMenuItemAvailable, useRestaurant } from '@/data/restaurants';
import { useUserLocation } from '@/data/user-location';
import { t, tn } from '@/i18n';
import { distanceTo, formatDistance } from '@/utils/distance';
import { isGoogleMapsLink, isKwetuMenuPdf } from '@/utils/safe-links';
import { goBackOrReplace } from '@/utils/navigation';
import { showMessage } from '@/utils/feedback';
import { themedStyles } from '@/theme/theme';

const ORANGE = '#ED6417';
const CREAM = '#FFF8ED';

export default function RestaurantDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { loading, restaurant } = useRestaurant(id);
  // Never asks for permission here; it only uses location the person already allowed on the home screen.
  const { coords } = useUserLocation();
  const [menuFilter, setMenuFilter] = useState<MenuCategory | 'all'>('all');
  // The photos open full screen: menu pages, or photos of the place.
  const [viewer, setViewer] = useState<{ photos: string[]; index: number } | null>(null);

  if (loading) {
    return <SafeAreaView style={styles.centered}><Text style={styles.sectionCaption}>{t('restaurant.loading')}</Text></SafeAreaView>;
  }

  if (!restaurant) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.missingTitle}>{t('restaurant.notFound')}</Text>
        <Pressable onPress={() => goBackOrReplace('/')} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>{t('restaurant.backToList')}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const openLink = async (url: string, errorMessage: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      showMessage(t('restaurant.cantOpen'), errorMessage);
    }
  };

  const position = restaurant.latitude != null && restaurant.longitude != null ? `${restaurant.latitude},${restaurant.longitude}` : null;
  // The owner's own link is used only when it really is a Google Maps link.
  const directionsUrl = isGoogleMapsLink(restaurant.mapUrl)
    ? restaurant.mapUrl.trim()
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(position ?? `${restaurant.name}, ${restaurant.address}, Dar es Salaam`)}`;
  const menuPdfUrl = isKwetuMenuPdf(restaurant.menuPdfUrl, restaurant.id) ? restaurant.menuPdfUrl : null;
  const distance = distanceTo(coords, restaurant);
  // Grouped by category (Pizza, Baga, …); inside each group, foods that can be ordered right now come first.
  const menu = restaurant.menu
    .map((item) => ({ item, category: item.category, available: isMenuItemAvailable(item, restaurant) }))
    .sort((a, b) => Number(b.available) - Number(a.available));
  const availableNow = menu.filter((entry) => entry.available).length;
  const groups = groupByCategory(menu);
  // A category chosen earlier may be gone after the menu reloads; then everything shows again.
  const selected = groups.some((group) => group.category === menuFilter) ? menuFilter : 'all';
  const shownGroups = selected === 'all' ? groups : groups.filter((group) => group.category === selected);
  const filterChips: { value: MenuCategory | 'all'; label: string }[] = [
    { value: 'all', label: t('category.all') },
    ...groups.map((group) => ({ value: group.category, label: `${categoryIcon(group.category)} ${categoryLabel(group.category)}` })),
  ];
  const heroPhoto = restaurant.coverUrl ?? restaurant.galleryUrls[0] ?? null;
  const ratingText = restaurant.reviewCount > 0 ? `★ ${restaurant.rating} (${tn('count.reviews', restaurant.reviewCount)})` : `★ ${restaurant.rating}`;
  const meta = [restaurant.rating > 0 ? ratingText : t('restaurant.newOnKwetu'), restaurant.area, distance != null ? formatDistance(distance) : null].filter(Boolean).join(' · ');
  const callRestaurant = () => openLink(`tel:${restaurant.phone.replace(/\s/g, '')}`, t('restaurant.noCalling'));
  const menuCaption = restaurant.menu.length
    ? t('restaurant.menuCaption', { available: availableNow, total: restaurant.menu.length })
    : t(restaurant.menuPhotoUrls.length ? 'restaurant.menuPhotosOnly' : menuPdfUrl ? 'restaurant.menuPdfOnly' : 'restaurant.menuSoon');

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 32 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <View style={styles.heroWrap}>
          {heroPhoto && <Image contentFit="cover" source={heroPhoto} style={styles.heroImage} transition={250} />}
          <View style={styles.heroShade} />
          <Pressable accessibilityLabel={t('restaurant.back')} onPress={() => goBackOrReplace('/')} style={styles.backButton}>
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
          <View style={styles.heroCopy}>
            <Text style={styles.cuisine}>{restaurant.cuisine.toUpperCase()}</Text>
            <Text style={styles.title}>{restaurant.name}</Text>
            <Text style={styles.heroMeta}>{meta}</Text>
          </View>
        </View>

        <View style={styles.section}>
          {restaurant.description ? <Text style={styles.description}>{restaurant.description}</Text> : null}
          <View style={styles.orderActions}>
            <PressableScale onPress={() => router.push(`/order/${restaurant.id}` as Href)} style={styles.orderButton}>
              <Text style={styles.orderButtonText}>{t('restaurant.order')}</Text>
            </PressableScale>
          </View>
          <View style={styles.quickActions}>
            {restaurant.phone ? <PressableScale onPress={callRestaurant} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>{t('restaurant.call')}</Text>
            </PressableScale> : null}
            <PressableScale onPress={() => openLink(directionsUrl, t('restaurant.noMaps'))} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>{t('restaurant.directions')}</Text>
            </PressableScale>
          </View>
        </View>

        {restaurant.galleryUrls.length > 0 && <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('restaurant.environment')}</Text>
          <Text style={styles.sectionCaption}>{t('restaurant.environmentCaption')}</Text>
          <ScrollView contentContainerStyle={styles.gallery} horizontal showsHorizontalScrollIndicator={false}>
            {restaurant.galleryUrls.map((photo, index) => (
              <Pressable accessibilityLabel={t('restaurant.placePhoto', { index: index + 1 })} accessibilityRole="imagebutton" key={photo} onPress={() => setViewer({ photos: restaurant.galleryUrls, index })}>
                <Image contentFit="cover" source={photo} style={[styles.environmentPhoto, index === 0 && styles.environmentPhotoFirst]} transition={200} />
              </Pressable>
            ))}
          </ScrollView>
        </View>}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('restaurant.menuTitle')}</Text>
          <Text style={styles.sectionCaption}>{menuCaption}</Text>
          {restaurant.menuPhotoUrls.length > 0 && <View style={styles.menuPages}>
            <Text style={styles.menuPagesTitle}>{t('restaurant.menuPhotos')}</Text>
            <Text style={styles.menuPagesCaption}>{t('restaurant.menuPhotosCaption')}</Text>
            <ScrollView contentContainerStyle={styles.gallery} horizontal showsHorizontalScrollIndicator={false}>
              {restaurant.menuPhotoUrls.map((photo, index) => (
                <Pressable accessibilityLabel={t('restaurant.menuPage', { index: index + 1 })} accessibilityRole="imagebutton" key={photo} onPress={() => setViewer({ photos: restaurant.menuPhotoUrls, index })}>
                  <Image contentFit="cover" source={photo} style={styles.menuPage} transition={200} />
                </Pressable>
              ))}
            </ScrollView>
          </View>}
          {menuPdfUrl ? <View style={styles.pdfCard}>
            <Text style={styles.pdfIcon}>📄</Text>
            <View style={styles.pdfCopy}>
              <Text style={styles.pdfTitle}>{t('restaurant.pdfTitle')}</Text>
              <Text style={styles.pdfCaption}>{t('restaurant.pdfCaption')}</Text>
              <View style={styles.pdfActions}>
                <Pressable accessibilityRole="button" onPress={() => void WebBrowser.openBrowserAsync(menuPdfUrl)} style={styles.pdfButton}>
                  <Text style={styles.pdfButtonText}>{t('restaurant.pdfView')}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => void openLink(menuPdfDownloadUrl(menuPdfUrl, restaurant.name), t('restaurant.noDownload'))} style={[styles.pdfButton, styles.pdfButtonSecondary]}>
                  <Text style={[styles.pdfButtonText, styles.pdfButtonSecondaryText]}>{t('restaurant.pdfDownload')}</Text>
                </Pressable>
              </View>
            </View>
          </View> : null}
          {groups.length > 1 && <ScrollView contentContainerStyle={styles.categoryChips} horizontal showsHorizontalScrollIndicator={false}>
            {filterChips.map((chip) => {
              const active = chip.value === selected;
              return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} key={chip.value} onPress={() => setMenuFilter(chip.value)} style={[styles.categoryChip, active && styles.categoryChipActive]}>
                <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>{chip.label}</Text>
              </Pressable>;
            })}
          </ScrollView>}
          {shownGroups.map((group) => <View key={group.category}>
            <Text accessibilityRole="header" style={styles.categoryHeading}>{categoryIcon(group.category)} {categoryLabel(group.category)}</Text>
            <View style={styles.menuList}>
            {group.items.map(({ item, available }, index) => {
              return (
                <Animated.View entering={listEntering(index)} key={item.id} style={[styles.menuCard, !available && styles.menuCardUnavailable]}>
                  {item.photoUrl ? <Image contentFit="cover" source={item.photoUrl} style={styles.foodPhoto} transition={200} /> : <View style={styles.foodPlaceholder}><Text style={styles.foodPlaceholderIcon}>🍽️</Text></View>}
                  <View style={styles.menuCopy}>
                    <View style={styles.menuTitleRow}>
                      <Text style={styles.menuName}>{item.name}</Text>
                      <Text style={styles.menuPrice}>{formatTsh(item.price)}</Text>
                    </View>
                    {item.description ? <Text style={styles.menuDescription}>{item.description}</Text> : null}
                    <Text style={styles.servingTime}>{t('restaurant.served', { from: item.availableFrom, until: item.availableUntil })}</Text>
                    {!available && <Text style={styles.unavailableBadge}>{t('restaurant.unavailable')}</Text>}
                  </View>
                </Animated.View>
              );
            })}
            </View>
          </View>)}
        </View>

        <RestaurantReviews rating={restaurant.rating} restaurantId={restaurant.id} reviewCount={restaurant.reviewCount} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('restaurant.contactTitle')}</Text>
          <View style={styles.contactCard}>
            {restaurant.phone ? <>
              <Text style={styles.contactLabel}>{t('restaurant.phone')}</Text>
              <Pressable onPress={callRestaurant}><Text style={styles.contactLink}>{restaurant.phone}</Text></Pressable>
            </> : null}
            {restaurant.email ? <>
              <Text style={styles.contactLabel}>{t('restaurant.email')}</Text>
              <Pressable onPress={() => openLink(`mailto:${restaurant.email}`, t('restaurant.noEmailApp'))}><Text style={styles.contactLink}>{restaurant.email}</Text></Pressable>
            </> : null}
            <Text style={styles.contactLabel}>{t('restaurant.address')}</Text>
            <Text style={styles.contactValue}>{restaurant.address}</Text>
            <Text style={styles.contactLabel}>{t('restaurant.hours')}</Text>
            <Text style={styles.contactValue}>{formatHours(restaurant)}</Text>
            {restaurant.facilities.length > 0 ? <>
              <Text style={styles.contactLabel}>{t('restaurant.facilities')}</Text>
              <View style={styles.facilities}>{restaurant.facilities.map((facility) => <Text key={facility} style={styles.facility}>{facility}</Text>)}</View>
            </> : null}
          </View>
        </View>
      </ScrollView>
      <PhotoViewer onClose={() => setViewer(null)} photos={viewer?.photos ?? []} startIndex={viewer?.index ?? null} />
    </SafeAreaView>
  );
}

const styles = themedStyles(({ bg, fg, line }) => ({
  safeArea: { flex: 1, backgroundColor: bg(CREAM) },
  content: { width: '100%', maxWidth: 900, alignSelf: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, backgroundColor: bg(CREAM) },
  missingTitle: { color: fg('#171612'), fontSize: 24, fontWeight: '900' },
  heroWrap: { height: 390, overflow: 'hidden', backgroundColor: bg('#2B241E') },
  heroImage: { position: 'absolute', inset: 0 },
  heroShade: { position: 'absolute', inset: 0, backgroundColor: 'rgba(15,10,7,0.42)' },
  backButton: { position: 'absolute', top: 16, left: 16, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: bg('#FFFFFF') },
  backIcon: { color: fg('#171612'), fontSize: 38, lineHeight: 39, marginTop: -3 },
  heroCopy: { position: 'absolute', left: 20, right: 20, bottom: 24 },
  cuisine: { alignSelf: 'flex-start', color: fg('#FFF'), fontSize: 9, fontWeight: '900', letterSpacing: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, overflow: 'hidden', backgroundColor: bg(ORANGE) },
  title: { color: fg('#FFF'), fontSize: 36, lineHeight: 40, fontWeight: '900', marginTop: 12 },
  heroMeta: { color: fg('#F7EEE6'), fontSize: 13, fontWeight: '700', marginTop: 7 },
  section: { paddingHorizontal: 18, paddingTop: 26 },
  description: { color: fg('#4F4A43'), fontSize: 15, lineHeight: 23 },
  sectionTitle: { color: fg('#171612'), fontSize: 24, fontWeight: '900' },
  sectionCaption: { color: fg('#777268'), fontSize: 12, marginTop: 4, marginBottom: 14 },
  quickActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  orderActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  primaryButton: { flex: 1, minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, backgroundColor: bg(ORANGE) },
  primaryButtonText: { color: fg('#FFF'), fontSize: 13, fontWeight: '900' },
  secondaryButton: { flex: 1, minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, borderWidth: 1, borderColor: line('#E6DCCE'), backgroundColor: bg('#FFF') },
  secondaryButtonText: { color: fg('#171612'), fontSize: 13, fontWeight: '900' },
  orderButton: { flex: 1, minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, backgroundColor: bg('#171612') },
  orderButtonText: { color: fg('#FFF'), fontSize: 13, fontWeight: '900' },
  gallery: { gap: 10, paddingRight: 18 },
  environmentPhoto: { width: 260, height: 180, borderRadius: 18, backgroundColor: bg('#DDD4C9') },
  environmentPhotoFirst: { width: 300 },
  menuPages: { marginBottom: 14 },
  menuPagesTitle: { color: fg('#171612'), fontSize: 16, fontWeight: '900' },
  menuPagesCaption: { color: fg('#777268'), fontSize: 12, marginTop: 3, marginBottom: 10 },
  menuPage: { width: 150, height: 200, borderRadius: 14, borderWidth: 1, borderColor: line('#EEE6DA'), backgroundColor: bg('#DDD4C9') },
  pdfCard: { flexDirection: 'row', gap: 12, padding: 14, marginBottom: 14, borderRadius: 18, borderWidth: 1, borderColor: line('#EEE6DA'), backgroundColor: bg('#FFF') },
  pdfIcon: { fontSize: 32 },
  pdfCopy: { flex: 1 },
  pdfTitle: { color: fg('#171612'), fontSize: 16, fontWeight: '900' },
  pdfCaption: { color: fg('#777268'), fontSize: 12, lineHeight: 17, marginTop: 3 },
  pdfActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  pdfButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 18, borderRadius: 20, backgroundColor: bg(ORANGE) },
  pdfButtonText: { color: fg('#FFF'), fontSize: 12, fontWeight: '900' },
  pdfButtonSecondary: { borderWidth: 1, borderColor: line('#E6DCCE'), backgroundColor: bg('#FFF') },
  pdfButtonSecondaryText: { color: fg('#171612') },
  menuList: { gap: 13 },
  categoryChips: { gap: 8, paddingBottom: 4, paddingRight: 18 },
  categoryChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: line('#E6DCCE'), backgroundColor: bg('#FFF') },
  categoryChipActive: { borderColor: line(ORANGE), backgroundColor: bg(ORANGE) },
  categoryChipText: { color: fg('#4F4A43'), fontSize: 12, fontWeight: '800' },
  categoryChipTextActive: { color: fg('#FFF') },
  categoryHeading: { color: fg('#171612'), fontSize: 17, fontWeight: '900', marginTop: 18, marginBottom: 10 },
  menuCard: { overflow: 'hidden', borderRadius: 18, borderWidth: 1, borderColor: line('#EEE6DA'), backgroundColor: bg('#FFF') },
  menuCardUnavailable: { opacity: 0.68, backgroundColor: bg('#FFF8ED') },
  foodPhoto: { width: '100%', height: 190, backgroundColor: bg('#DDD4C9') },
  foodPlaceholder: { width: '100%', height: 130, alignItems: 'center', justifyContent: 'center', backgroundColor: bg('#F4E9DC') },
  foodPlaceholderIcon: { fontSize: 42 },
  menuCopy: { padding: 14 },
  menuTitleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  menuName: { flex: 1, color: fg('#171612'), fontSize: 16, fontWeight: '900' },
  menuPrice: { color: fg(ORANGE), fontSize: 13, fontWeight: '900' },
  menuDescription: { color: fg('#777268'), fontSize: 12, lineHeight: 18, marginTop: 6 },
  servingTime: { color: fg('#777268'), fontSize: 10, marginTop: 8 },
  unavailableBadge: { alignSelf: 'flex-start', color: fg('#8E2F1A'), backgroundColor: bg('#F5D8D1'), borderRadius: 9, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 4, fontSize: 8, fontWeight: '900', marginTop: 9 },
  contactCard: { gap: 7, padding: 18, borderRadius: 18, borderWidth: 1, borderColor: line('#EEE6DA'), backgroundColor: bg('#FFF') },
  contactLabel: { color: fg('#9A9187'), fontSize: 9, fontWeight: '900', letterSpacing: 1, marginTop: 8 },
  contactLink: { color: fg(ORANGE), fontSize: 15, fontWeight: '800' },
  contactValue: { color: fg('#302C27'), fontSize: 14, lineHeight: 20 },
  facilities: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  facility: { color: fg('#5A4A40'), fontSize: 11, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, overflow: 'hidden', backgroundColor: bg('#FFF3E9') },
}));
