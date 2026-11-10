import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { getGuestProfile, saveGuestProfile, saveOrder } from '@/data/guest-storage';
import { getRestaurantDetail } from '@/data/restaurant-details';
import { getOwnerRestaurant, isMenuItemAvailable, type OwnerRestaurant } from '@/data/owner-storage';
import { goBackOrReplace } from '@/utils/navigation';

const ORANGE = '#ED6417';
const CREAM = '#FFF8ED';
const priceNumber = (price: string) => Number(price.replace(/[^0-9]/g, ''));

export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const restaurant = getRestaurantDetail(id);
  const insets = useSafeAreaInsets();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [fulfillment, setFulfillment] = useState<'Pickup' | 'Delivery'>('Pickup');
  const [address, setAddress] = useState('');
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [ownerRestaurant, setOwnerRestaurant] = useState<OwnerRestaurant | null>(null);

  useEffect(() => {
    getGuestProfile().then((profile) => { setName(profile.name); setPhone(profile.phone); setEmail(profile.email); }).catch(() => undefined);
    getOwnerRestaurant().then(setOwnerRestaurant).catch(() => setOwnerRestaurant(null));
  }, []);

  const usesOwnerMenu = Boolean(restaurant && ownerRestaurant
    && ownerRestaurant.name.trim().toLowerCase() === restaurant.name.trim().toLowerCase()
    && ownerRestaurant.menu.length > 0);
  const menu = useMemo(() => usesOwnerMenu && ownerRestaurant
    ? ownerRestaurant.menu.map((item) => ({ ...item, description: item.ingredients, priceLabel: `TSh ${item.price.toLocaleString()}`, numericPrice: item.price, available: isMenuItemAvailable(item, ownerRestaurant) }))
    : (restaurant?.menu ?? []).map((item) => ({ ...item, priceLabel: item.price, numericPrice: priceNumber(item.price), available: true })), [ownerRestaurant, restaurant, usesOwnerMenu]);
  const total = useMemo(() => menu.reduce((sum, item) => sum + item.numericPrice * (quantities[item.name] ?? 0), 0), [menu, quantities]);
  if (!restaurant) return null;

  const changeQuantity = (itemName: string, change: number) => {
    const item = menu.find((food) => food.name === itemName);
    if (!item?.available) return;
    setQuantities((current) => ({ ...current, [itemName]: Math.max(0, (current[itemName] ?? 0) + change) }));
  };
  const submit = async () => {
    const items = menu.filter((item) => item.available && (quantities[item.name] ?? 0) > 0).map((item) => ({ name: item.name, price: item.priceLabel, quantity: quantities[item.name] }));
    if (!items.length) return Alert.alert('Empty order', 'Add at least one menu item.');
    if (!name.trim() || !phone.trim()) return Alert.alert('Missing information', 'Enter your name and phone number.');
    if (fulfillment === 'Delivery' && !address.trim()) return Alert.alert('Delivery address needed', 'Enter the address for your delivery.');
    const reference = `FO-${Date.now().toString().slice(-6)}`;
    const guest = { name: name.trim(), phone: phone.trim(), email: email.trim() };
    try {
      await Promise.all([
        saveGuestProfile(guest),
        saveOrder({ id: reference, restaurantId: restaurant.id, restaurantName: restaurant.name, guest, fulfillment, address: address.trim(), items, total, createdAt: new Date().toISOString() }),
      ]);
      setConfirmation(reference);
    } catch {
      Alert.alert('Could not save order', 'Please try again.');
    }
  };

  if (confirmation) return <SafeAreaView style={styles.confirmation}><Text style={styles.check}>✓</Text><Text style={styles.confirmationTitle}>Order received</Text><Text style={styles.confirmationCopy}>{restaurant.name}{'\n'}{fulfillment} · TSh {total.toLocaleString()}</Text><Text style={styles.reference}>REFERENCE {confirmation}</Text><Pressable onPress={() => router.replace('/')} style={styles.submit}><Text style={styles.submitText}>Back to home</Text></Pressable></SafeAreaView>;

  return <SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]} keyboardShouldPersistTaps="handled"><Pressable onPress={() => goBackOrReplace(`/restaurant/${restaurant.id}`)}><Text style={styles.back}>‹ Restaurant details</Text></Pressable><Text style={styles.eyebrow}>ORDER FOOD</Text><Text style={styles.title}>{restaurant.name}</Text><Text style={styles.subtitle}>Choose your dishes and quantities.</Text>
    <View style={styles.menuList}>{menu.map((item) => <View key={item.name} style={[styles.menuCard, !item.available && styles.menuCardUnavailable]}>{'photo' in item ? <Image contentFit="cover" source={item.photo} style={styles.photo} /> : <View style={styles.photoPlaceholder}><Text style={styles.photoPlaceholderIcon}>🍽️</Text></View>}<View style={styles.menuCopy}><Text style={styles.menuName}>{item.name}</Text><Text style={styles.menuDescription}>{item.description}</Text><Text style={styles.price}>{item.priceLabel}</Text>{!item.available && <Text style={styles.unavailableBadge}>UNAVAILABLE</Text>}<View style={styles.stepper}><Pressable disabled={!item.available} onPress={() => changeQuantity(item.name, -1)} style={styles.stepButton}><Text style={[styles.stepText, !item.available && styles.disabledText]}>−</Text></Pressable><Text style={styles.quantity}>{quantities[item.name] ?? 0}</Text><Pressable disabled={!item.available} onPress={() => changeQuantity(item.name, 1)} style={styles.stepButton}><Text style={[styles.stepText, !item.available && styles.disabledText]}>+</Text></Pressable></View></View></View>)}</View>
    <Text style={styles.sectionTitle}>How should we prepare it?</Text><View style={styles.choices}>{(['Pickup', 'Delivery'] as const).map((value) => <Pressable key={value} onPress={() => setFulfillment(value)} style={[styles.choice, fulfillment === value && styles.choiceActive]}><Text style={[styles.choiceText, fulfillment === value && styles.choiceTextActive]}>{value}</Text></Pressable>)}</View>
    {fulfillment === 'Delivery' && <><Text style={styles.label}>DELIVERY ADDRESS</Text><TextInput multiline onChangeText={setAddress} placeholder="Street, building, and area" style={[styles.input, styles.addressInput]} value={address} /></>}
    <Text style={styles.sectionTitle}>Guest details</Text><Text style={styles.label}>YOUR NAME</Text><TextInput autoComplete="name" onChangeText={setName} placeholder="Full name" style={styles.input} value={name} /><Text style={styles.label}>PHONE</Text><TextInput autoComplete="tel" keyboardType="phone-pad" onChangeText={setPhone} placeholder="+255..." style={styles.input} value={phone} /><Text style={styles.label}>EMAIL (OPTIONAL)</Text><TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" onChangeText={setEmail} placeholder="you@example.com" style={styles.input} value={email} />
    <View style={styles.totalRow}><Text style={styles.totalLabel}>ORDER TOTAL</Text><Text style={styles.total}>TSh {total.toLocaleString()}</Text></View><Pressable onPress={submit} style={styles.submit}><Text style={styles.submitText}>Confirm {fulfillment.toLowerCase()} order</Text></Pressable><Text style={styles.paymentNote}>Payment will be arranged directly with the restaurant.</Text>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: CREAM }, content: { width: '100%', maxWidth: 700, alignSelf: 'center', padding: 20 }, back: { color: ORANGE, fontSize: 14, fontWeight: '800', marginBottom: 25 }, eyebrow: { color: ORANGE, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, title: { color: '#171612', fontSize: 32, fontWeight: '900', marginTop: 6 }, subtitle: { color: '#777268', fontSize: 14, marginTop: 6, marginBottom: 20 },
  menuList: { gap: 12 }, menuCard: { flexDirection: 'row', minHeight: 135, overflow: 'hidden', borderWidth: 1, borderColor: '#EEE6DA', borderRadius: 18, backgroundColor: '#FFF' }, menuCardUnavailable: { opacity: 0.68, backgroundColor: '#FFF8ED' }, photo: { width: 125, backgroundColor: '#DDD4C9' }, photoPlaceholder: { width: 125, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4E9DC' }, photoPlaceholderIcon: { fontSize: 38 }, menuCopy: { flex: 1, padding: 13 }, menuName: { color: '#171612', fontSize: 15, fontWeight: '900' }, menuDescription: { color: '#777268', fontSize: 10, lineHeight: 14, marginTop: 4 }, price: { color: ORANGE, fontSize: 12, fontWeight: '900', marginTop: 7 }, unavailableBadge: { alignSelf: 'flex-start', color: '#8E2F1A', backgroundColor: '#F5D8D1', borderRadius: 8, overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 3, fontSize: 7, fontWeight: '900', marginTop: 6 }, stepper: { position: 'absolute', right: 10, bottom: 9, flexDirection: 'row', alignItems: 'center', borderRadius: 16, backgroundColor: '#FFF1E6' }, stepButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }, stepText: { color: ORANGE, fontSize: 20, fontWeight: '900' }, disabledText: { color: '#AFA8A0' }, quantity: { minWidth: 24, textAlign: 'center', color: '#171612', fontWeight: '900' },
  sectionTitle: { color: '#171612', fontSize: 20, fontWeight: '900', marginTop: 28, marginBottom: 12 }, choices: { flexDirection: 'row', gap: 9 }, choice: { flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: 22, borderWidth: 1, borderColor: '#E9DFD2', backgroundColor: '#FFF' }, choiceActive: { borderColor: ORANGE, backgroundColor: ORANGE }, choiceText: { color: '#4F4A43', fontWeight: '900' }, choiceTextActive: { color: '#FFF' },
  label: { color: '#777268', fontSize: 10, fontWeight: '900', letterSpacing: 0.7, marginTop: 15, marginBottom: 7 }, input: { height: 50, borderWidth: 1, borderColor: '#E9DFD2', borderRadius: 14, paddingHorizontal: 15, color: '#171612', backgroundColor: '#FFF' }, addressInput: { height: 82, paddingTop: 14, textAlignVertical: 'top' }, totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 24, marginTop: 24, borderTopWidth: 1, borderTopColor: '#E9DFD2' }, totalLabel: { color: '#777268', fontSize: 10, fontWeight: '900' }, total: { color: '#171612', fontSize: 22, fontWeight: '900' }, submit: { minHeight: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, borderRadius: 26, backgroundColor: ORANGE, marginTop: 18 }, submitText: { color: '#FFF', fontSize: 13, fontWeight: '900' }, paymentNote: { color: '#8A847B', textAlign: 'center', fontSize: 10, marginTop: 10 },
  confirmation: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: CREAM }, check: { width: 70, height: 70, borderRadius: 35, overflow: 'hidden', textAlign: 'center', textAlignVertical: 'center', color: '#FFF', backgroundColor: '#278653', fontSize: 38, fontWeight: '900' }, confirmationTitle: { color: '#171612', fontSize: 28, fontWeight: '900', marginTop: 24 }, confirmationCopy: { color: '#5F5951', textAlign: 'center', fontSize: 15, lineHeight: 23, marginTop: 10 }, reference: { color: ORANGE, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginTop: 18 },
});
