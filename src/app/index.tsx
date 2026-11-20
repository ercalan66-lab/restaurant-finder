import { router, type Href } from 'expo-router';
import Storage from '@/utils/kv-store';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomNav, type NavItem } from '@/components/bottom-nav';
import { LocationPrompt } from '@/components/location-prompt';
import { PhotoBackground } from '@/components/photo-background';
import { RestaurantCard } from '@/components/restaurant-card';
import { RestaurantRow } from '@/components/restaurant-row';
import { SearchResultCard } from '@/components/search-result-card';
import { SAVED_RESTAURANTS_KEY } from '@/data/guest-storage';
import { homeSections } from '@/data/home-sections';
import { useRestaurants, type RestaurantSummary } from '@/data/restaurants';
import { searchRestaurants, type SearchHit } from '@/data/search';
import { useUserLocation } from '@/data/user-location';
import { distanceTo, type Coords } from '@/utils/distance';

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
  return <View style={styles.brand}><Text style={styles.brandMark}>♨</Text><Text style={styles.brandName}>KWETU</Text><Text style={styles.brandTagline}>FIND. TASTE. ENJOY.</Text></View>;
}

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const columns = width >= 720 ? 3 : width >= 390 ? 2 : 1;
  const [query, setQuery] = useState('');
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const [savedOnly, setSavedOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const { offline, restaurants } = useRestaurants();
  const listRef = useRef<FlatList<SearchHit>>(null);
  const location = useUserLocation();
  const userCoords = location.coords;

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
    return (!savedOnly || saved.has(restaurant.id))
      && (!filters.maxPrice || restaurant.pricePerPerson <= filters.maxPrice)
      && (!filters.minRating || restaurant.rating >= filters.minRating)
      && (!filters.maxDistance || (km != null && km <= filters.maxDistance));
  }), [filters, restaurants, saved, savedOnly, userCoords]);
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
  const showAll = () => { setSavedOnly(false); setQuery(''); setFilters(defaultFilters); };
  const filterCount = Object.values(filters).filter(Boolean).length;
  // The curated rows show only while browsing; searching, filtering or Saved shows plain results.
  const browsing = !savedOnly && !query.trim() && filterCount === 0;
  const sections = useMemo(() => homeSections(restaurants ?? [], {
    distanceOf: (restaurant) => sortingDistance(userCoords, restaurant),
    fromUser: userCoords != null,
  }), [restaurants, userCoords]);
  const listTitle = searching ? `Results for “${query.trim()}”` : savedOnly ? 'Saved places' : browsing ? 'All restaurants' : 'Results';
  const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
  const countText = !restaurants
    ? 'Loading restaurants…'
    : searching
      ? `${plural(hits.length, 'restaurant', 'restaurants')}${dishCount ? ` · ${plural(dishCount, 'matching food', 'matching foods')}` : ''}`
      : `${plural(hits.length, 'place', 'places')} found`;
  const scrollToTop = () => listRef.current?.scrollToOffset({ offset: 0, animated: true });
  // Filters stay next to the search box, so the tab bar keeps only the three places people go.
  const navItems: NavItem[] = [
    { label: 'Home', icon: { ios: 'house', iosSelected: 'house.fill', android: 'home' }, active: !savedOnly, onPress: () => { showAll(); scrollToTop(); } },
    { label: 'Saved', icon: { ios: 'heart', iosSelected: 'heart.fill', android: 'favorite' }, active: savedOnly, onPress: () => { setSavedOnly(true); scrollToTop(); } },
    { label: 'Profile', icon: { ios: 'person.crop.circle', iosSelected: 'person.crop.circle.fill', android: 'account_circle' }, active: false, onPress: () => router.push('/profile' as Href) },
  ];

  const header = <>
    <View style={styles.topbar}>
      <Brand />
      <View style={styles.headerActions}>
        <Pressable accessibilityLabel="Show saved restaurants" onPress={() => setSavedOnly((value) => !value)} style={styles.headerButton}><Text style={[styles.headerIcon, savedOnly && styles.orangeText]}>{savedOnly ? '♥' : '♡'}</Text><View style={styles.countBadge}><Text style={styles.countText}>{saved.size}</Text></View></Pressable>
      </View>
    </View>
    <View style={styles.searchRow}>
      <View style={styles.searchBox}><Text style={styles.searchIcon}>⌕</Text><TextInput accessibilityLabel="Search for a restaurant or a food" clearButtonMode="while-editing" onChangeText={setQuery} placeholder="Restaurant or food, e.g. pilau" placeholderTextColor="#8A847B" returnKeyType="search" style={styles.searchInput} value={query} /></View>
      <Pressable accessibilityLabel="Filter restaurants" onPress={() => setFiltersOpen(true)} style={styles.filterButton}><Text style={styles.filterIcon}>☷</Text>{filterCount > 0 && <View style={styles.filterCount}><Text style={styles.filterCountText}>{filterCount}</Text></View>}</Pressable>
    </View>
    <LocationPrompt onRequest={() => void location.request()} status={location.status} />
    {!searching && <PhotoBackground imageStyle={styles.heroImage} source={require('../../assets/images/restaurant-hero.jpg')} style={styles.hero}>
      <View style={styles.heroOverlay} /><View style={styles.heroContent}>
        <Text style={styles.pill}>NEAR YOU NOW</Text><Text style={styles.heroTitle}>Find your next <Text style={styles.heroAccent}>favorite.</Text></Text>
        <Text style={styles.heroDescription}>Discover local restaurants, reserve your table, or order a meal.</Text>
        <Pressable onPress={showAll} style={styles.cta}><Text style={styles.ctaText}>FIND A RESTAURANT</Text><View style={styles.ctaArrow}><Text style={styles.orangeText}>→</Text></View></Pressable>
      </View><View style={styles.dots}><View style={styles.activeDot} /><View style={styles.dot} /><View style={styles.dot} /><View style={styles.dot} /></View>
    </PhotoBackground>}
    {browsing && sections.map((section) => <RestaurantRow isSaved={(id) => saved.has(id)} key={section.key} onToggleSaved={toggleSaved} section={section} userDistanceOf={(restaurant) => distanceTo(userCoords, restaurant)} />)}
    <View style={styles.heading}><View><Text style={styles.sectionTitle}>{listTitle}</Text><Text style={styles.resultCount}>{countText}</Text>{offline && <Text style={styles.offlineNote}>Offline · showing saved sample restaurants</Text>}</View>{!browsing && <Pressable onPress={showAll}><Text style={styles.viewAll}>Show all <Text style={styles.orangeText}>→</Text></Text></Pressable>}</View>
  </>;

  return <SafeAreaView edges={['top']} style={styles.safeArea}>
    <FlatList
      ref={listRef}
      columnWrapperStyle={!searching && columns > 1 ? styles.cardRow : undefined}
      contentContainerStyle={[styles.listContent, { paddingBottom: 100 + insets.bottom }]}
      // Search results are one wide card per restaurant (with its foods); browsing keeps the grid.
      data={hits} key={searching ? 'search' : `grid-${columns}`} keyExtractor={(item) => String(item.restaurant.id)} ListHeaderComponent={header} numColumns={searching ? 1 : columns} showsVerticalScrollIndicator={false}
      ListEmptyComponent={!restaurants
        ? <View style={styles.empty}><Text style={styles.emptyCopy}>Finding restaurants near you…</Text></View>
        : searching
          ? <View style={styles.empty}><Text style={styles.emptyTitle}>Nothing found for “{query.trim()}”</Text><Text style={styles.emptyCopy}>Try another restaurant or food name, such as pilau, pizza or coffee.</Text><Pressable onPress={showAll} style={styles.emptyButton}><Text style={styles.emptyButtonText}>Clear search</Text></Pressable></View>
          : <View style={styles.empty}><Text style={styles.emptyTitle}>No restaurants match</Text><Text style={styles.emptyCopy}>Try clearing the current filters.</Text><Pressable onPress={showAll} style={styles.emptyButton}><Text style={styles.emptyButtonText}>Clear filters</Text></Pressable></View>}
      ListFooterComponent={searching ? undefined : <PhotoBackground imageStyle={styles.offerImage} source={require('../../assets/images/restaurant-offer.jpg')} style={styles.offer}><View style={styles.offerOverlay} /><View style={styles.offerCopy}><Text style={styles.offerEyebrow}>PICK OF THE WEEK</Text><Text style={styles.offerTitle}>Dinner plans,{`\n`}sorted.</Text><Text style={styles.offerCaption}>Top-rated tables less than 2 km away.</Text></View></PhotoBackground>}
      renderItem={({ item }) => searching
        ? <SearchResultCard distanceKm={distanceTo(userCoords, item.restaurant)} hit={item} onToggleSaved={() => toggleSaved(item.restaurant.id)} saved={saved.has(item.restaurant.id)} />
        : <RestaurantCard distanceKm={distanceTo(userCoords, item.restaurant)} onToggleSaved={() => toggleSaved(item.restaurant.id)} restaurant={item.restaurant} saved={saved.has(item.restaurant.id)} style={styles.gridCard} />}
    />
    <BottomNav items={navItems} />
    <Modal animationType="slide" onRequestClose={() => setFiltersOpen(false)} transparent visible={filtersOpen}><Pressable onPress={() => setFiltersOpen(false)} style={styles.modalBackdrop}><Pressable onPress={(event) => event.stopPropagation()} style={[styles.filterSheet, { paddingBottom: Math.max(insets.bottom, 20) }]}><View style={styles.filterHeading}><View><Text style={styles.sheetTitle}>Filter restaurants</Text><Text style={styles.sheetMeta}>Choose what matters for this meal.</Text></View><Pressable accessibilityLabel="Close filters" onPress={() => setFiltersOpen(false)}><Text style={styles.closeFilter}>×</Text></Pressable></View><FilterGroup label="MAXIMUM PRICE" options={[[0, 'Any'], [50000, 'TSh 50k'], [100000, 'TSh 100k'], [150000, 'TSh 150k']]} selected={filters.maxPrice} onSelect={(maxPrice) => setFilters((current) => ({ ...current, maxPrice }))} /><FilterGroup label="MINIMUM RATING" options={[[0, 'Any'], [4.5, '4.5+'], [4.7, '4.7+'], [4.8, '4.8+']]} selected={filters.minRating} onSelect={(minRating) => setFilters((current) => ({ ...current, minRating }))} /><FilterGroup label="MAXIMUM DISTANCE" options={[[0, 'Any'], [1, '1 km'], [2, '2 km'], [5, '5 km']]} selected={filters.maxDistance} onSelect={(maxDistance) => setFilters((current) => ({ ...current, maxDistance }))} /><View style={styles.filterActions}><Pressable onPress={() => setFilters(defaultFilters)} style={styles.clearButton}><Text style={styles.clearButtonText}>Clear</Text></Pressable><Pressable onPress={() => setFiltersOpen(false)} style={styles.applyButton}><Text style={styles.applyButtonText}>Show {hits.length} places</Text></Pressable></View></Pressable></Pressable></Modal>
  </SafeAreaView>;
}

function FilterGroup({ label, onSelect, options, selected }: { label: string; onSelect: (value: number) => void; options: [number, string][]; selected: number }) {
  return <View><Text style={styles.filterLabel}>{label}</Text><View style={styles.filterOptions}>{options.map(([value, text]) => <Pressable key={value} onPress={() => onSelect(value)} style={[styles.filterOption, selected === value && styles.filterOptionActive]}><Text style={[styles.filterOptionText, selected === value && styles.filterOptionTextActive]}>{text}</Text></Pressable>)}</View></View>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: CREAM }, listContent: { width: '100%', maxWidth: 1180, alignSelf: 'center', paddingHorizontal: 16 },
  topbar: { height: 84, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }, headerButton: { width: 42, height: 44, alignItems: 'center', justifyContent: 'center' },
  brand: { position: 'absolute', left: 60, right: 60, alignItems: 'center' }, brandMark: { color: ORANGE, fontSize: 23, lineHeight: 22 }, brandName: { color: '#171612', fontSize: 21, lineHeight: 21, fontWeight: '900', letterSpacing: 0.8 }, brandTagline: { color: '#777268', fontSize: 7, fontWeight: '800', letterSpacing: 1.8, marginTop: 4 },
  headerActions: { flexDirection: 'row' }, headerIcon: { color: '#171612', fontSize: 25 }, countBadge: { position: 'absolute', top: 2, right: 0, minWidth: 17, height: 17, paddingHorizontal: 3, borderRadius: 9, backgroundColor: ORANGE, borderWidth: 2, borderColor: CREAM, alignItems: 'center', justifyContent: 'center' }, countText: { color: '#FFF', fontSize: 8, fontWeight: '900' }, orangeText: { color: ORANGE },
  searchRow: { flexDirection: 'row', gap: 10, marginBottom: 18 }, searchBox: { flex: 1, minHeight: 54, borderRadius: 18, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#F5EDE3', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, shadowColor: '#4D361F', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 3 }, searchIcon: { fontSize: 25, marginRight: 10 }, searchInput: { flex: 1, height: 52, color: '#171612', fontSize: 14 }, filterButton: { width: 54, height: 54, borderRadius: 18, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', elevation: 3 }, filterIcon: { fontSize: 24, transform: [{ rotate: '90deg' }] },
  filterCount: { position: 'absolute', top: 3, right: 3, minWidth: 17, height: 17, paddingHorizontal: 3, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: ORANGE }, filterCountText: { color: '#FFF', fontSize: 8, fontWeight: '900' },
  hero: { height: 316, overflow: 'hidden', borderRadius: 28, justifyContent: 'center', paddingHorizontal: 24, backgroundColor: '#17130F' }, heroImage: { borderRadius: 28 }, heroOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(16,13,10,0.54)' }, heroContent: { width: '74%', maxWidth: 470 }, pill: { alignSelf: 'flex-start', color: '#FFF', backgroundColor: ORANGE, borderRadius: 20, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 6, fontSize: 9, fontWeight: '900' }, heroTitle: { color: '#FFF', fontSize: 38, lineHeight: 40, fontWeight: '900', letterSpacing: -1.2, marginTop: 15 }, heroAccent: { color: '#FF812D' }, heroDescription: { color: '#E3DED8', fontSize: 13, lineHeight: 19, marginTop: 12 }, cta: { alignSelf: 'flex-start', height: 43, borderRadius: 24, backgroundColor: ORANGE, paddingLeft: 16, paddingRight: 5, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 }, ctaText: { color: '#FFF', fontSize: 10, fontWeight: '900' }, ctaArrow: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' }, dots: { position: 'absolute', bottom: 16, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 7 }, dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.55)' }, activeDot: { width: 21, height: 7, borderRadius: 4, backgroundColor: ORANGE },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 26, marginBottom: 15 }, sectionTitle: { color: '#171612', fontSize: 23, fontWeight: '900', letterSpacing: -0.5 }, resultCount: { color: '#777268', fontSize: 12, marginTop: 4 }, viewAll: { color: '#312E29', fontSize: 12, fontWeight: '800', paddingBottom: 2 },
  cardRow: { gap: 12 }, gridCard: { flex: 1 }, offlineNote: { color: '#8E2F1A', fontSize: 10, fontWeight: '700', marginTop: 4 },
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24, backgroundColor: '#FFF', borderRadius: 20, marginBottom: 14 }, emptyTitle: { color: '#171612', fontSize: 18, fontWeight: '900' }, emptyCopy: { color: '#777268', textAlign: 'center', fontSize: 13, marginTop: 6 }, emptyButton: { backgroundColor: ORANGE, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10, marginTop: 16 }, emptyButtonText: { color: '#FFF', fontSize: 12, fontWeight: '900' },
  offer: { height: 155, borderRadius: 22, overflow: 'hidden', justifyContent: 'center', marginTop: 7 }, offerImage: { borderRadius: 22 }, offerOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(20,13,8,0.48)' }, offerCopy: { paddingHorizontal: 21 }, offerEyebrow: { color: '#FF9A52', fontSize: 9, fontWeight: '900' }, offerTitle: { color: '#FFF', fontSize: 24, lineHeight: 25, fontWeight: '900', marginTop: 5 }, offerCaption: { color: '#E7DED5', fontSize: 10, marginTop: 7 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(18,14,10,0.56)' }, sheetTitle: { flex: 1, color: '#171612', fontSize: 24, fontWeight: '900' }, sheetMeta: { color: '#777268', fontSize: 12, marginTop: 7 },
  filterSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, backgroundColor: CREAM }, filterHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }, closeFilter: { color: '#171612', fontSize: 30, lineHeight: 30, paddingHorizontal: 8 }, filterLabel: { color: '#777268', fontSize: 9, fontWeight: '900', letterSpacing: 0.8, marginTop: 18, marginBottom: 8 }, filterOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, filterOption: { paddingHorizontal: 13, paddingVertical: 10, borderWidth: 1, borderColor: '#E6DCCE', borderRadius: 20, backgroundColor: '#FFF' }, filterOptionActive: { borderColor: ORANGE, backgroundColor: ORANGE }, filterOptionText: { color: '#4F4A43', fontSize: 11, fontWeight: '800' }, filterOptionTextActive: { color: '#FFF' }, filterActions: { flexDirection: 'row', gap: 10, marginTop: 24 }, clearButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 24, borderWidth: 1, borderColor: '#E6DCCE', borderRadius: 24, backgroundColor: '#FFF' }, clearButtonText: { color: '#171612', fontWeight: '900' }, applyButton: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: ORANGE }, applyButtonText: { color: '#FFF', fontWeight: '900' },
});
