import { router, type Href } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { FoodRow } from '@/components/food-row';
import { LocationPrompt } from '@/components/location-prompt';
import { PhotoBackground } from '@/components/photo-background';
import { RestaurantCard } from '@/components/restaurant-card';
import { RestaurantRow } from '@/components/restaurant-row';
import { SearchResultCard } from '@/components/search-result-card';
import { foodSections } from '@/data/food-sections';
import { SAVED_RESTAURANTS_KEY } from '@/data/guest-storage';
import { homeSections, type HomeSection } from '@/data/home-sections';
import { usePopularDishes } from '@/data/popular-dishes';
import { isMenuItemAvailable, useRestaurants, type RestaurantSummary } from '@/data/restaurants';
import { useSavedDishes } from '@/data/saved-dishes';
import { searchRestaurants } from '@/data/search';
import { useUserLocation } from '@/data/user-location';
import { t, tn } from '@/i18n';
import { distanceTo, type Coords } from '@/utils/distance';
import Storage from '@/utils/kv-store';
import { paint, themedStyles } from '@/theme/theme';

type Restaurant = RestaurantSummary;
type Filters = { maxPrice: number; minRating: number; maxDistance: number };

const ORANGE = '#ED6417';
const CREAM = '#FFF8ED';
const SAVED_STORAGE_KEY = SAVED_RESTAURANTS_KEY;
const defaultFilters: Filters = { maxPrice: 0, minRating: 0, maxDistance: 0 };
/** Distance used for sorting and the distance filter: from the person when known, otherwise the stored estimate. */
const sortingDistance = (user: Coords | null, restaurant: Restaurant) =>
  user ? distanceTo(user, restaurant) : restaurant.distanceKm > 0 ? restaurant.distanceKm : null;

function Brand() {
  return <View style={styles.brand}><Text style={styles.brandMark}>♨</Text><Text style={styles.brandName}>KWETU</Text><Text style={styles.brandTagline}>{t('brand.tagline')}</Text></View>;
}

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const columns = width >= 720 ? 3 : width >= 390 ? 2 : 1;
  const [query, setQuery] = useState('');
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const { offline, restaurants } = useRestaurants();
  const location = useUserLocation();
  const userCoords = location.coords;
  const savedDishes = useSavedDishes();
  const popular = usePopularDishes();

  useEffect(() => {
    let active = true;
    Storage.getItem(SAVED_STORAGE_KEY)
      .then((value) => {
        if (active && value) setSaved(new Set(JSON.parse(value) as number[]));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => (restaurants ?? []).filter((restaurant) => {
    const km = sortingDistance(userCoords, restaurant);
    return (!filters.maxPrice || restaurant.pricePerPerson <= filters.maxPrice)
      && (!filters.minRating || restaurant.rating >= filters.minRating)
      && (!filters.maxDistance || (km != null && km <= filters.maxDistance));
  }), [filters, restaurants, userCoords]);
  // Searching matches restaurant names and the foods on their menus; with no search, hits are every restaurant.
  const searching = query.trim().length > 0;
  const hits = useMemo(() => searchRestaurants(filtered, query), [filtered, query]);
  const dishCount = hits.reduce((sum, hit) => sum + hit.dishes.length, 0);

  const toggleSaved = (id: number) => setSaved((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    void Storage.setItem(SAVED_STORAGE_KEY, JSON.stringify([...next]));
    return next;
  });
  const showAll = () => { setQuery(''); setFilters(defaultFilters); };
  const filterCount = Object.values(filters).filter(Boolean).length;
  // The curated rows show only while browsing; searching or filtering shows plain results.
  const browsing = !query.trim() && filterCount === 0;
  const foods = useMemo(() => foodSections(restaurants ?? [], {
    popular,
    savedDishIds: savedDishes.saved,
    isAvailable: isMenuItemAvailable,
  }), [restaurants, popular, savedDishes.saved]);
  const foodDistance = (restaurant: Restaurant) => distanceTo(userCoords, restaurant);
  // With no tab bar, saved restaurants get their own row at the top of the restaurant rows.
  const sections = useMemo(() => {
    const savedPlaces = (restaurants ?? []).filter((restaurant) => saved.has(restaurant.id));
    const savedRow: HomeSection[] = savedPlaces.length ? [{ key: 'saved', title: t('rows.saved.title'), caption: t('rows.saved.caption'), restaurants: savedPlaces }] : [];
    return [...savedRow, ...homeSections(restaurants ?? [], {
      distanceOf: (restaurant) => sortingDistance(userCoords, restaurant),
      fromUser: userCoords != null,
    })];
  }, [restaurants, saved, userCoords]);
  const listTitle = searching ? t('home.resultsFor', { query: query.trim() }) : browsing ? t('home.allRestaurants') : t('home.results');
  const countText = !restaurants
    ? t('home.loading')
    : searching
      ? `${tn('count.restaurants', hits.length)}${dishCount ? ` · ${tn('count.matchingFoods', dishCount)}` : ''}`
      : tn('count.placesFound', hits.length);
  const header = <>
    <View style={styles.topbar}>
      <Brand />
      <View style={styles.headerActions}>
        <Pressable accessibilityLabel={t('nav.settings')} accessibilityRole="button" hitSlop={6} onPress={() => router.push('/settings' as Href)} style={styles.headerButton}>
          <SymbolView name={{ ios: 'gearshape', android: 'settings', web: 'settings' }} size={26} tintColor={paint().fg('#171612')} />
        </Pressable>
      </View>
    </View>
    <View style={styles.searchRow}>
      <View style={styles.searchBox}><Text style={styles.searchIcon}>⌕</Text><TextInput accessibilityLabel={t('home.searchLabel')} clearButtonMode="while-editing" onChangeText={setQuery} placeholder={t('home.searchPlaceholder')} placeholderTextColor="#8A847B" returnKeyType="search" style={styles.searchInput} value={query} /></View>
      <Pressable accessibilityLabel={t('home.filterLabel')} onPress={() => setFiltersOpen(true)} style={styles.filterButton}><Text style={styles.filterIcon}>☷</Text>{filterCount > 0 && <View style={styles.filterCount}><Text style={styles.filterCountText}>{filterCount}</Text></View>}</Pressable>
    </View>
    <LocationPrompt onRequest={() => void location.request()} status={location.status} />
    {!searching && <PhotoBackground imageStyle={styles.heroImage} source={require('../../assets/images/restaurant-hero.jpg')} style={styles.hero}>
      <View style={styles.heroOverlay} /><View style={styles.heroContent}>
        <Text style={styles.pill}>{t('home.heroPill')}</Text><Text style={styles.heroTitle}>{t('home.heroTitle')}<Text style={styles.heroAccent}>{t('home.heroTitleAccent')}</Text></Text>
        <Text style={styles.heroDescription}>{t('home.heroDescription')}</Text>
        <Pressable onPress={showAll} style={styles.cta}><Text style={styles.ctaText}>{t('home.heroCta')}</Text><View style={styles.ctaArrow}><Text style={styles.orangeText}>→</Text></View></Pressable>
      </View><View style={styles.dots}><View style={styles.activeDot} /><View style={styles.dot} /><View style={styles.dot} /><View style={styles.dot} /></View>
    </PhotoBackground>}
    {browsing && foods.map((section) => <FoodRow distanceOf={foodDistance} isSaved={(id) => savedDishes.saved.has(id)} key={section.key} onToggleSaved={savedDishes.toggle} section={section} />)}
    {browsing && sections.map((section) => <RestaurantRow isSaved={(id) => saved.has(id)} key={section.key} onToggleSaved={toggleSaved} section={section} userDistanceOf={(restaurant) => distanceTo(userCoords, restaurant)} />)}
    <View style={styles.heading}><View><Text style={styles.sectionTitle}>{listTitle}</Text><Text style={styles.resultCount}>{countText}</Text>{offline && <Text style={styles.offlineNote}>{t('home.offline')}</Text>}</View>{!browsing && <Pressable onPress={showAll}><Text style={styles.viewAll}>{t('home.showAll')} <Text style={styles.orangeText}>→</Text></Text></Pressable>}</View>
  </>;

  return <SafeAreaView edges={['top']} style={styles.safeArea}>
    <FlatList
      columnWrapperStyle={!searching && columns > 1 ? styles.cardRow : undefined}
      contentContainerStyle={[styles.listContent, { paddingBottom: 24 + insets.bottom }]}
      // Search results are one wide card per restaurant (with its foods); browsing keeps the grid.
      data={hits} key={searching ? 'search' : `grid-${columns}`} keyExtractor={(item) => String(item.restaurant.id)} ListHeaderComponent={header} numColumns={searching ? 1 : columns} showsVerticalScrollIndicator={false}
      ListEmptyComponent={!restaurants
        ? <View style={styles.empty}><Text style={styles.emptyCopy}>{t('home.finding')}</Text></View>
        : searching
          ? <View style={styles.empty}><Text style={styles.emptyTitle}>{t('home.nothingFound', { query: query.trim() })}</Text><Text style={styles.emptyCopy}>{t('home.nothingFoundHint')}</Text><Pressable onPress={showAll} style={styles.emptyButton}><Text style={styles.emptyButtonText}>{t('home.clearSearch')}</Text></Pressable></View>
          : <View style={styles.empty}><Text style={styles.emptyTitle}>{t('home.noMatch')}</Text><Text style={styles.emptyCopy}>{t('home.noMatchHint')}</Text><Pressable onPress={showAll} style={styles.emptyButton}><Text style={styles.emptyButtonText}>{t('home.clearFilters')}</Text></Pressable></View>}
      ListFooterComponent={searching ? undefined : <PhotoBackground imageStyle={styles.offerImage} source={require('../../assets/images/restaurant-offer.jpg')} style={styles.offer}><View style={styles.offerOverlay} /><View style={styles.offerCopy}><Text style={styles.offerEyebrow}>{t('home.offerEyebrow')}</Text><Text style={styles.offerTitle}>{t('home.offerTitle')}</Text><Text style={styles.offerCaption}>{t('home.offerCaption')}</Text></View></PhotoBackground>}
      renderItem={({ item }) => searching
        ? <SearchResultCard distanceKm={distanceTo(userCoords, item.restaurant)} hit={item} onToggleSaved={() => toggleSaved(item.restaurant.id)} saved={saved.has(item.restaurant.id)} />
        : <RestaurantCard distanceKm={distanceTo(userCoords, item.restaurant)} onToggleSaved={() => toggleSaved(item.restaurant.id)} restaurant={item.restaurant} saved={saved.has(item.restaurant.id)} style={styles.gridCard} />}
    />
    <Modal animationType="slide" onRequestClose={() => setFiltersOpen(false)} transparent visible={filtersOpen}><Pressable onPress={() => setFiltersOpen(false)} style={styles.modalBackdrop}><Pressable onPress={(event) => event.stopPropagation()} style={[styles.filterSheet, { paddingBottom: Math.max(insets.bottom, 20) }]}><View style={styles.filterHeading}><View><Text style={styles.sheetTitle}>{t('filters.title')}</Text><Text style={styles.sheetMeta}>{t('filters.subtitle')}</Text></View><Pressable accessibilityLabel={t('filters.close')} onPress={() => setFiltersOpen(false)}><Text style={styles.closeFilter}>×</Text></Pressable></View><FilterGroup label={t('filters.maxPrice')} options={[[0, t('filters.any')], [50000, 'TSh 50k'], [100000, 'TSh 100k'], [150000, 'TSh 150k']]} selected={filters.maxPrice} onSelect={(maxPrice) => setFilters((current) => ({ ...current, maxPrice }))} /><FilterGroup label={t('filters.minRating')} options={[[0, t('filters.any')], [4.5, '4.5+'], [4.7, '4.7+'], [4.8, '4.8+']]} selected={filters.minRating} onSelect={(minRating) => setFilters((current) => ({ ...current, minRating }))} /><FilterGroup label={t('filters.maxDistance')} options={[[0, t('filters.any')], [1, '1 km'], [2, '2 km'], [5, '5 km']]} selected={filters.maxDistance} onSelect={(maxDistance) => setFilters((current) => ({ ...current, maxDistance }))} /><View style={styles.filterActions}><Pressable onPress={() => setFilters(defaultFilters)} style={styles.clearButton}><Text style={styles.clearButtonText}>{t('filters.clear')}</Text></Pressable><Pressable onPress={() => setFiltersOpen(false)} style={styles.applyButton}><Text style={styles.applyButtonText}>{tn('filters.show', hits.length)}</Text></Pressable></View></Pressable></Pressable></Modal>
  </SafeAreaView>;
}

function FilterGroup({ label, onSelect, options, selected }: { label: string; onSelect: (value: number) => void; options: [number, string][]; selected: number }) {
  return <View><Text style={styles.filterLabel}>{label}</Text><View style={styles.filterOptions}>{options.map(([value, text]) => <Pressable key={value} onPress={() => onSelect(value)} style={[styles.filterOption, selected === value && styles.filterOptionActive]}><Text style={[styles.filterOptionText, selected === value && styles.filterOptionTextActive]}>{text}</Text></Pressable>)}</View></View>;
}

const styles = themedStyles(({ bg, fg, line }) => ({
  safeArea: { flex: 1, backgroundColor: bg(CREAM) }, listContent: { width: '100%', maxWidth: 1180, alignSelf: 'center', paddingHorizontal: 16 },
  topbar: { height: 84, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }, headerButton: { width: 42, height: 44, alignItems: 'center', justifyContent: 'center' },
  brand: { position: 'absolute', left: 60, right: 60, alignItems: 'center' }, brandMark: { color: fg(ORANGE), fontSize: 23, lineHeight: 22 }, brandName: { color: fg('#171612'), fontSize: 21, lineHeight: 21, fontWeight: '900', letterSpacing: 0.8 }, brandTagline: { color: fg('#777268'), fontSize: 7, fontWeight: '800', letterSpacing: 1.8, marginTop: 4 },
  headerActions: { flexDirection: 'row' }, orangeText: { color: fg(ORANGE) },
  searchRow: { flexDirection: 'row', gap: 10, marginBottom: 18 }, searchBox: { flex: 1, minHeight: 54, borderRadius: 18, backgroundColor: bg('#FFF'), borderWidth: 1, borderColor: line('#F5EDE3'), flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, shadowColor: '#4D361F', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 3 }, searchIcon: { fontSize: 25, marginRight: 10 }, searchInput: { flex: 1, height: 52, color: fg('#171612'), fontSize: 14 }, filterButton: { width: 54, height: 54, borderRadius: 18, backgroundColor: bg('#FFF'), alignItems: 'center', justifyContent: 'center', elevation: 3 }, filterIcon: { fontSize: 24, transform: [{ rotate: '90deg' }] },
  filterCount: { position: 'absolute', top: 3, right: 3, minWidth: 17, height: 17, paddingHorizontal: 3, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: bg(ORANGE) }, filterCountText: { color: fg('#FFF'), fontSize: 8, fontWeight: '900' },
  hero: { height: 316, overflow: 'hidden', borderRadius: 28, justifyContent: 'center', paddingHorizontal: 24, backgroundColor: bg('#17130F') }, heroImage: { borderRadius: 28 }, heroOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(16,13,10,0.54)' }, heroContent: { width: '74%', maxWidth: 470 }, pill: { alignSelf: 'flex-start', color: fg('#FFF'), backgroundColor: bg(ORANGE), borderRadius: 20, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 6, fontSize: 9, fontWeight: '900' }, heroTitle: { color: fg('#FFF'), fontSize: 38, lineHeight: 40, fontWeight: '900', letterSpacing: -1.2, marginTop: 15 }, heroAccent: { color: fg('#FF812D') }, heroDescription: { color: fg('#E3DED8'), fontSize: 13, lineHeight: 19, marginTop: 12 }, cta: { alignSelf: 'flex-start', height: 43, borderRadius: 24, backgroundColor: bg(ORANGE), paddingLeft: 16, paddingRight: 5, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 }, ctaText: { color: fg('#FFF'), fontSize: 10, fontWeight: '900' }, ctaArrow: { width: 32, height: 32, borderRadius: 16, backgroundColor: bg('#FFF'), alignItems: 'center', justifyContent: 'center' }, dots: { position: 'absolute', bottom: 16, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 7 }, dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.55)' }, activeDot: { width: 21, height: 7, borderRadius: 4, backgroundColor: bg(ORANGE) },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 26, marginBottom: 15 }, sectionTitle: { color: fg('#171612'), fontSize: 23, fontWeight: '900', letterSpacing: -0.5 }, resultCount: { color: fg('#777268'), fontSize: 12, marginTop: 4 }, viewAll: { color: fg('#312E29'), fontSize: 12, fontWeight: '800', paddingBottom: 2 },
  cardRow: { gap: 12 }, gridCard: { flex: 1 }, offlineNote: { color: fg('#8E2F1A'), fontSize: 10, fontWeight: '700', marginTop: 4 },
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24, backgroundColor: bg('#FFF'), borderRadius: 20, marginBottom: 14 }, emptyTitle: { color: fg('#171612'), fontSize: 18, fontWeight: '900' }, emptyCopy: { color: fg('#777268'), textAlign: 'center', fontSize: 13, marginTop: 6 }, emptyButton: { backgroundColor: bg(ORANGE), borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10, marginTop: 16 }, emptyButtonText: { color: fg('#FFF'), fontSize: 12, fontWeight: '900' },
  offer: { height: 155, borderRadius: 22, overflow: 'hidden', justifyContent: 'center', marginTop: 7 }, offerImage: { borderRadius: 22 }, offerOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(20,13,8,0.48)' }, offerCopy: { paddingHorizontal: 21 }, offerEyebrow: { color: fg('#FF9A52'), fontSize: 9, fontWeight: '900' }, offerTitle: { color: fg('#FFF'), fontSize: 24, lineHeight: 25, fontWeight: '900', marginTop: 5 }, offerCaption: { color: fg('#E7DED5'), fontSize: 10, marginTop: 7 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(18,14,10,0.56)' }, sheetTitle: { flex: 1, color: fg('#171612'), fontSize: 24, fontWeight: '900' }, sheetMeta: { color: fg('#777268'), fontSize: 12, marginTop: 7 },
  filterSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, backgroundColor: bg(CREAM) }, filterHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }, closeFilter: { color: fg('#171612'), fontSize: 30, lineHeight: 30, paddingHorizontal: 8 }, filterLabel: { color: fg('#777268'), fontSize: 9, fontWeight: '900', letterSpacing: 0.8, marginTop: 18, marginBottom: 8 }, filterOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, filterOption: { paddingHorizontal: 13, paddingVertical: 10, borderWidth: 1, borderColor: line('#E6DCCE'), borderRadius: 20, backgroundColor: bg('#FFF') }, filterOptionActive: { borderColor: line(ORANGE), backgroundColor: bg(ORANGE) }, filterOptionText: { color: fg('#4F4A43'), fontSize: 11, fontWeight: '800' }, filterOptionTextActive: { color: fg('#FFF') }, filterActions: { flexDirection: 'row', gap: 10, marginTop: 24 }, clearButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 24, borderWidth: 1, borderColor: line('#E6DCCE'), borderRadius: 24, backgroundColor: bg('#FFF') }, clearButtonText: { color: fg('#171612'), fontWeight: '900' }, applyButton: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: bg(ORANGE) }, applyButtonText: { color: fg('#FFF'), fontWeight: '900' },
}));
