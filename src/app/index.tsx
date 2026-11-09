import * as Linking from 'expo-linking';
import { router, type Href } from 'expo-router';
import Storage from 'expo-sqlite/kv-store';
import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, ImageBackground, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type Cuisine = 'All' | 'African' | 'Italian' | 'Asian' | 'Indian' | 'Cafe';
type Restaurant = { id: number; name: string; cuisine: Exclude<Cuisine, 'All'>; area: string; price: string; rating: number; distance: number; tag: string; photo: string; description: string };

const ORANGE = '#ED6417';
const CREAM = '#FFF8ED';
const cuisines: { name: Cuisine; icon: string }[] = [
  { name: 'All', icon: '🍽️' }, { name: 'African', icon: '🥘' }, { name: 'Italian', icon: '🍕' },
  { name: 'Asian', icon: '🍣' }, { name: 'Indian', icon: '🍛' }, { name: 'Cafe', icon: '☕' },
];
const SAVED_STORAGE_KEY = 'fork-saved-restaurants';
const restaurants: Restaurant[] = [
  { id: 1, name: 'The Baobab Table', cuisine: 'African', area: 'Masaki', price: 'TSh 45,000', rating: 4.9, distance: 0.8, tag: 'Bestseller', photo: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=85', description: 'A vibrant celebration of East African cooking with fragrant rice, charcoal-grilled seafood, and generous sharing plates.' },
  { id: 2, name: 'Olive & Ember', cuisine: 'Italian', area: 'Oyster Bay', price: 'TSh 85,000', rating: 4.8, distance: 1.4, tag: 'Hot spot', photo: 'https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=900&q=85', description: 'Seasonal antipasti, blistered sourdough pizza, and handmade pasta in a relaxed garden setting.' },
  { id: 3, name: 'Koi House', cuisine: 'Asian', area: 'City Centre', price: 'TSh 240,000', rating: 4.7, distance: 2.1, tag: 'New', photo: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=900&q=85', description: 'Precision-cut sushi, warm donburi bowls, and inventive small plates in an intimate dining room.' },
  { id: 4, name: 'Morning Ritual', cuisine: 'Cafe', area: 'Mikocheni', price: 'TSh 35,000', rating: 4.6, distance: 0.5, tag: 'Open early', photo: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=900&q=85', description: 'Excellent coffee, flaky pastries, and all-day brunch classics with plenty of plant-forward choices.' },
  { id: 5, name: 'Spice Route', cuisine: 'Indian', area: 'Upanga', price: 'TSh 65,000', rating: 4.8, distance: 3.2, tag: 'Popular', photo: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=900&q=85', description: 'Bold regional Indian flavors meet fresh local ingredients, from slow curries to smoky tandoor plates.' },
  { id: 6, name: 'Luna Trattoria', cuisine: 'Italian', area: 'Msasani', price: 'TSh 130,000', rating: 4.5, distance: 1.8, tag: 'Great value', photo: 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=900&q=85', description: 'A warm neighborhood trattoria known for silky handmade pasta, simple sauces, and classic tiramisu.' },
  { id: 7, name: 'Kariakoo Flame', cuisine: 'African', area: 'Kariakoo', price: 'TSh 28,000', rating: 4.6, distance: 3.4, tag: 'Local favorite', photo: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=85', description: 'Busy local dining with grilled meats, biryani, and classic Tanzanian plates.' },
  { id: 8, name: 'Harbour House', cuisine: 'African', area: 'Kivukoni', price: 'TSh 145,000', rating: 4.7, distance: 2.8, tag: 'Ocean view', photo: 'https://images.unsplash.com/photo-1544148103-0773bf10d330?auto=format&fit=crop&w=900&q=85', description: 'Fresh seafood and coastal cooking overlooking the harbour.' },
];

function Brand() {
  return <View style={styles.brand}><Text style={styles.brandMark}>♨</Text><Text style={styles.brandName}>FORK</Text><Text style={styles.brandTagline}>FIND. TASTE. ENJOY.</Text></View>;
}

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const columns = width >= 720 ? 3 : width >= 390 ? 2 : 1;
  const [query, setQuery] = useState('');
  const [activeCuisine, setActiveCuisine] = useState<Cuisine>('All');
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const [savedOnly, setSavedOnly] = useState(false);
  const [selected, setSelected] = useState<Restaurant | null>(null);

  useEffect(() => {
    let active = true;
    Storage.getItem(SAVED_STORAGE_KEY)
      .then((value) => {
        if (active && value) setSaved(new Set(JSON.parse(value) as number[]));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const visibleRestaurants = useMemo(() => restaurants.filter((restaurant) => {
    const text = `${restaurant.name} ${restaurant.cuisine} ${restaurant.area}`.toLowerCase();
    return (activeCuisine === 'All' || restaurant.cuisine === activeCuisine) && (!savedOnly || saved.has(restaurant.id)) && text.includes(query.trim().toLowerCase());
  }), [activeCuisine, query, saved, savedOnly]);

  const toggleSaved = (id: number) => setSaved((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    void Storage.setItem(SAVED_STORAGE_KEY, JSON.stringify([...next]));
    return next;
  });
  const showAll = () => { setActiveCuisine('All'); setSavedOnly(false); setQuery(''); };
  const openDirections = async (restaurant: Restaurant) => {
    const destination = encodeURIComponent(`${restaurant.name}, ${restaurant.area}, Dar es Salaam`);
    try {
      await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${destination}`);
    } catch {
      Alert.alert('Directions unavailable', 'We could not open maps on this device.');
    }
  };
  const showMessage = (title: string, message: string) => Alert.alert(title, message);

  const header = <>
    <View style={styles.topbar}>
      <Pressable accessibilityLabel="Open menu" hitSlop={10} onPress={() => showMessage('Your account', 'Profile, language, and appearance settings will be available here.')} style={styles.headerButton}><View style={styles.menuLine} /><View style={styles.menuLine} /><View style={styles.menuLine} /></Pressable>
      <Brand />
      <View style={styles.headerActions}>
        <Pressable accessibilityLabel="Notifications" onPress={() => showMessage('Notifications', 'You have 2 restaurant updates waiting for you.')} style={styles.headerButton}><Text style={styles.headerIcon}>🔔</Text><View style={styles.countBadge}><Text style={styles.countText}>2</Text></View></Pressable>
        <Pressable accessibilityLabel="Show saved restaurants" onPress={() => setSavedOnly((value) => !value)} style={styles.headerButton}><Text style={[styles.headerIcon, savedOnly && styles.orangeText]}>{savedOnly ? '♥' : '♡'}</Text><View style={styles.countBadge}><Text style={styles.countText}>{saved.size}</Text></View></Pressable>
      </View>
    </View>
    <View style={styles.searchRow}>
      <View style={styles.searchBox}><Text style={styles.searchIcon}>⌕</Text><TextInput accessibilityLabel="Search restaurants or cuisines" onChangeText={setQuery} placeholder="Search restaurants or cuisines..." placeholderTextColor="#8A847B" returnKeyType="search" style={styles.searchInput} value={query} /></View>
      <Pressable accessibilityLabel="Filter restaurants" onPress={() => showMessage('Filters', 'Use search and cuisines now. Budget, rating, and distance filters are coming next.')} style={styles.filterButton}><Text style={styles.filterIcon}>☷</Text></Pressable>
    </View>
    <ImageBackground imageStyle={styles.heroImage} source={require('../../assets/images/restaurant-hero.jpg')} style={styles.hero}>
      <View style={styles.heroOverlay} /><View style={styles.heroContent}>
        <Text style={styles.pill}>NEAR YOU NOW</Text><Text style={styles.heroTitle}>Find your next <Text style={styles.heroAccent}>favorite.</Text></Text>
        <Text style={styles.heroDescription}>Discover local restaurants, reserve your table, or order a meal.</Text>
        <Pressable onPress={showAll} style={styles.cta}><Text style={styles.ctaText}>FIND A RESTAURANT</Text><View style={styles.ctaArrow}><Text style={styles.orangeText}>→</Text></View></Pressable>
      </View><View style={styles.dots}><View style={styles.activeDot} /><View style={styles.dot} /><View style={styles.dot} /><View style={styles.dot} /></View>
    </ImageBackground>
    <ScrollView contentContainerStyle={styles.categories} horizontal showsHorizontalScrollIndicator={false}>
      {cuisines.map((cuisine) => { const active = cuisine.name === activeCuisine && !savedOnly; return <Pressable key={cuisine.name} onPress={() => { setActiveCuisine(cuisine.name); setSavedOnly(false); }} style={styles.category}><View style={[styles.categoryCircle, active && styles.categoryCircleActive]}><Text style={styles.categoryIcon}>{cuisine.icon}</Text></View><Text style={[styles.categoryLabel, active && styles.categoryLabelActive]}>{cuisine.name}</Text></Pressable>; })}
    </ScrollView>
    <View style={styles.heading}><View><Text style={styles.sectionTitle}>{savedOnly ? 'Saved places' : 'Popular near you'}</Text><Text style={styles.resultCount}>{visibleRestaurants.length} {visibleRestaurants.length === 1 ? 'place' : 'places'} found</Text></View><Pressable onPress={showAll}><Text style={styles.viewAll}>View All <Text style={styles.orangeText}>→</Text></Text></Pressable></View>
  </>;

  return <SafeAreaView edges={['top']} style={styles.safeArea}>
    <FlatList
      columnWrapperStyle={columns > 1 ? styles.cardRow : undefined}
      contentContainerStyle={[styles.listContent, { paddingBottom: 100 + insets.bottom }]}
      data={visibleRestaurants} key={columns} keyExtractor={(item) => String(item.id)} ListHeaderComponent={header} numColumns={columns} showsVerticalScrollIndicator={false}
      ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>No restaurants match</Text><Text style={styles.emptyCopy}>Try another search or clear the current filters.</Text><Pressable onPress={showAll} style={styles.emptyButton}><Text style={styles.emptyButtonText}>Clear filters</Text></Pressable></View>}
      ListFooterComponent={<ImageBackground imageStyle={styles.offerImage} source={require('../../assets/images/restaurant-offer.jpg')} style={styles.offer}><View style={styles.offerOverlay} /><View style={styles.offerCopy}><Text style={styles.offerEyebrow}>PICK OF THE WEEK</Text><Text style={styles.offerTitle}>Dinner plans,{`\n`}sorted.</Text><Text style={styles.offerCaption}>Top-rated tables less than 2 km away.</Text></View></ImageBackground>}
      renderItem={({ item }) => <Pressable accessibilityRole="button" onPress={() => router.push(`/restaurant/${item.id}` as Href)} style={styles.card}>
        <ImageBackground source={{ uri: item.photo }} style={styles.cardPhoto}><View style={styles.photoShade} /><Text style={styles.tag}>{item.tag.toUpperCase()}</Text><Pressable accessibilityLabel={`${saved.has(item.id) ? 'Remove' : 'Add'} saved restaurant`} hitSlop={8} onPress={() => toggleSaved(item.id)} style={styles.saveButton}><Text style={[styles.saveIcon, saved.has(item.id) && styles.orangeText]}>{saved.has(item.id) ? '♥' : '♡'}</Text></Pressable><Text style={styles.distance}>⌖ {item.distance} km · {item.area}</Text></ImageBackground>
        <View style={styles.cardBody}><View style={styles.titleLine}><Text numberOfLines={1} style={styles.cardTitle}>{item.name}</Text><Text style={styles.rating}>★ {item.rating}</Text></View><Text style={styles.meta}>{item.cuisine} · {item.area}</Text><View style={styles.cardFooter}><Text style={styles.price}>{item.price}</Text><Text style={styles.open}>OPEN NOW</Text></View><Text style={styles.perPerson}>per person</Text></View>
      </Pressable>}
    />
    <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 8) }]}>{[['⌂', 'Home'], ['◇', 'Discover'], ['⌖', 'Visit'], ['♡', 'Saved'], ['♙', 'Profile']].map(([icon, label], index) => <Pressable key={label} onPress={label === 'Saved' ? () => setSavedOnly(true) : label === 'Home' || label === 'Discover' ? showAll : label === 'Visit' ? () => selected ? openDirections(selected) : showMessage('Choose a restaurant', 'Open a restaurant first, then tap Directions.') : () => router.push('/profile' as Href)} style={[styles.navItem, index === 2 && styles.mainNavItem]}><Text style={[styles.navIcon, index === 0 && styles.orangeText, index === 2 && styles.mainNavIcon]}>{icon}</Text>{index !== 2 && <Text style={[styles.navLabel, index === 0 && styles.orangeText]}>{label}</Text>}</Pressable>)}</View>
    <Modal animationType="slide" onRequestClose={() => setSelected(null)} transparent visible={selected !== null}><Pressable onPress={() => setSelected(null)} style={styles.modalBackdrop}><Pressable onPress={(event) => event.stopPropagation()} style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>{selected && <><ImageBackground source={{ uri: selected.photo }} style={styles.sheetImage}><View style={styles.photoShade} /><Pressable accessibilityLabel="Close restaurant details" onPress={() => setSelected(null)} style={styles.closeButton}><Text style={styles.closeText}>×</Text></Pressable></ImageBackground><View style={styles.sheetCopy}><View style={styles.titleLine}><Text style={styles.sheetTitle}>{selected.name}</Text><Text style={styles.rating}>★ {selected.rating}</Text></View><Text style={styles.sheetMeta}>{selected.cuisine} · {selected.area} · {selected.distance} km away</Text><Text style={styles.sheetDescription}>{selected.description}</Text><View style={styles.sheetActions}><Pressable onPress={() => showMessage('Reservation started', `We are preparing a table request for ${selected.name}.`)} style={styles.primaryAction}><Text style={styles.primaryActionText}>Reserve a table</Text></Pressable><Pressable onPress={() => openDirections(selected)} style={styles.secondaryAction}><Text style={styles.secondaryActionText}>Directions</Text></Pressable><Pressable onPress={() => toggleSaved(selected.id)} style={styles.secondaryAction}><Text style={styles.secondaryActionText}>{saved.has(selected.id) ? '♥ Saved' : '♡ Save'}</Text></Pressable></View></View></>}</Pressable></Pressable></Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: CREAM }, listContent: { width: '100%', maxWidth: 1180, alignSelf: 'center', paddingHorizontal: 16 },
  topbar: { height: 84, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, headerButton: { width: 42, height: 44, alignItems: 'center', justifyContent: 'center' }, menuLine: { width: 22, height: 2, marginVertical: 2.5, backgroundColor: '#171612', borderRadius: 2 },
  brand: { position: 'absolute', left: 60, right: 60, alignItems: 'center' }, brandMark: { color: ORANGE, fontSize: 23, lineHeight: 22 }, brandName: { color: '#171612', fontSize: 21, lineHeight: 21, fontWeight: '900', letterSpacing: 0.8 }, brandTagline: { color: '#777268', fontSize: 7, fontWeight: '800', letterSpacing: 1.8, marginTop: 4 },
  headerActions: { flexDirection: 'row' }, headerIcon: { color: '#171612', fontSize: 25 }, countBadge: { position: 'absolute', top: 2, right: 0, minWidth: 17, height: 17, paddingHorizontal: 3, borderRadius: 9, backgroundColor: ORANGE, borderWidth: 2, borderColor: CREAM, alignItems: 'center', justifyContent: 'center' }, countText: { color: '#FFF', fontSize: 8, fontWeight: '900' }, orangeText: { color: ORANGE },
  searchRow: { flexDirection: 'row', gap: 10, marginBottom: 18 }, searchBox: { flex: 1, minHeight: 54, borderRadius: 18, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#F5EDE3', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, shadowColor: '#4D361F', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 3 }, searchIcon: { fontSize: 25, marginRight: 10 }, searchInput: { flex: 1, height: 52, color: '#171612', fontSize: 14 }, filterButton: { width: 54, height: 54, borderRadius: 18, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', elevation: 3 }, filterIcon: { fontSize: 24, transform: [{ rotate: '90deg' }] },
  hero: { height: 316, overflow: 'hidden', borderRadius: 28, justifyContent: 'center', paddingHorizontal: 24, backgroundColor: '#17130F' }, heroImage: { borderRadius: 28 }, heroOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(16,13,10,0.54)' }, heroContent: { width: '74%', maxWidth: 470 }, pill: { alignSelf: 'flex-start', color: '#FFF', backgroundColor: ORANGE, borderRadius: 20, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 6, fontSize: 9, fontWeight: '900' }, heroTitle: { color: '#FFF', fontSize: 38, lineHeight: 40, fontWeight: '900', letterSpacing: -1.2, marginTop: 15 }, heroAccent: { color: '#FF812D' }, heroDescription: { color: '#E3DED8', fontSize: 13, lineHeight: 19, marginTop: 12 }, cta: { alignSelf: 'flex-start', height: 43, borderRadius: 24, backgroundColor: ORANGE, paddingLeft: 16, paddingRight: 5, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 }, ctaText: { color: '#FFF', fontSize: 10, fontWeight: '900' }, ctaArrow: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' }, dots: { position: 'absolute', bottom: 16, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 7 }, dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.55)' }, activeDot: { width: 21, height: 7, borderRadius: 4, backgroundColor: ORANGE },
  categories: { paddingVertical: 26, gap: 13 }, category: { width: 68, alignItems: 'center' }, categoryCircle: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#FFF', borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center', elevation: 2 }, categoryCircleActive: { borderColor: ORANGE, backgroundColor: '#FFF0DF' }, categoryIcon: { fontSize: 28 }, categoryLabel: { color: '#302C27', fontSize: 11, fontWeight: '700', marginTop: 8 }, categoryLabelActive: { color: ORANGE },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 15 }, sectionTitle: { color: '#171612', fontSize: 23, fontWeight: '900', letterSpacing: -0.5 }, resultCount: { color: '#777268', fontSize: 12, marginTop: 4 }, viewAll: { color: '#312E29', fontSize: 12, fontWeight: '800', paddingBottom: 2 },
  cardRow: { gap: 12 }, card: { flex: 1, minWidth: 0, marginBottom: 12, borderRadius: 20, overflow: 'hidden', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EEE6DA', elevation: 2 }, cardPhoto: { height: 155, backgroundColor: '#D6D0C8' }, photoShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.12)' }, tag: { position: 'absolute', top: 10, left: 10, color: '#FFF', backgroundColor: ORANGE, borderRadius: 12, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 5, fontSize: 7, fontWeight: '900' }, saveButton: { position: 'absolute', top: 9, right: 9, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.94)', alignItems: 'center', justifyContent: 'center' }, saveIcon: { fontSize: 20 }, distance: { position: 'absolute', bottom: 9, left: 10, color: '#FFF', fontSize: 9, fontWeight: '800' },
  cardBody: { padding: 12 }, titleLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, cardTitle: { flex: 1, color: '#171612', fontSize: 14, fontWeight: '900' }, rating: { color: '#EAA000', fontSize: 11, fontWeight: '900' }, meta: { color: '#777268', fontSize: 10, marginTop: 5 }, cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }, price: { color: '#171612', fontSize: 12, fontWeight: '900' }, open: { color: '#3F8B54', backgroundColor: '#EAF7ED', borderRadius: 9, overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 4, fontSize: 7, fontWeight: '900' }, perPerson: { color: '#918A81', fontSize: 8, marginTop: 2 },
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24, backgroundColor: '#FFF', borderRadius: 20, marginBottom: 14 }, emptyTitle: { color: '#171612', fontSize: 18, fontWeight: '900' }, emptyCopy: { color: '#777268', textAlign: 'center', fontSize: 13, marginTop: 6 }, emptyButton: { backgroundColor: ORANGE, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10, marginTop: 16 }, emptyButtonText: { color: '#FFF', fontSize: 12, fontWeight: '900' },
  offer: { height: 155, borderRadius: 22, overflow: 'hidden', justifyContent: 'center', marginTop: 7 }, offerImage: { borderRadius: 22 }, offerOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(20,13,8,0.48)' }, offerCopy: { paddingHorizontal: 21 }, offerEyebrow: { color: '#FF9A52', fontSize: 9, fontWeight: '900' }, offerTitle: { color: '#FFF', fontSize: 24, lineHeight: 25, fontWeight: '900', marginTop: 5 }, offerCaption: { color: '#E7DED5', fontSize: 10, marginTop: 7 },
  bottomNav: { position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 76, paddingTop: 8, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: '#FFF', borderTopLeftRadius: 26, borderTopRightRadius: 26, elevation: 14 }, navItem: { flex: 1, alignItems: 'center', justifyContent: 'center' }, navIcon: { color: '#403B35', fontSize: 21, lineHeight: 23 }, navLabel: { color: '#777268', fontSize: 9, marginTop: 3 }, mainNavItem: { flex: 0, width: 58, height: 58, borderRadius: 29, backgroundColor: ORANGE, marginHorizontal: 5, marginTop: -26, borderWidth: 4, borderColor: CREAM }, mainNavIcon: { color: '#FFF', fontSize: 25 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(18,14,10,0.56)' }, sheet: { maxHeight: '88%', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', backgroundColor: CREAM }, sheetImage: { height: 250, backgroundColor: '#D6D0C8' }, closeButton: { position: 'absolute', top: 16, right: 16, width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' }, closeText: { fontSize: 27, lineHeight: 29 }, sheetCopy: { padding: 20 }, sheetTitle: { flex: 1, color: '#171612', fontSize: 24, fontWeight: '900' }, sheetMeta: { color: '#777268', fontSize: 12, marginTop: 7 }, sheetDescription: { color: '#4F4A43', fontSize: 14, lineHeight: 21, marginTop: 16 }, sheetActions: { flexDirection: 'row', gap: 10, marginTop: 22 }, primaryAction: { flex: 1, height: 48, borderRadius: 24, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }, primaryActionText: { color: '#FFF', fontSize: 13, fontWeight: '900' }, secondaryAction: { height: 48, borderRadius: 24, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EEE6DA', paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' }, secondaryActionText: { color: '#171612', fontSize: 13, fontWeight: '800' },
});
