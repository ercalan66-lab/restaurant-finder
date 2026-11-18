import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { describePayment, getGuestProfile, newReference, saveGuestProfile, saveOrder, type PaymentMethod } from '@/data/guest-storage';
import { formatTsh, isMenuItemAvailable, useRestaurant } from '@/data/restaurants';
import { goBackOrReplace } from '@/utils/navigation';
import { getPushToken } from '@/utils/push-notifications';

const ORANGE = '#ED6417';
const CREAM = '#FFF8ED';
// Cash is the only payment method for now; online methods will be added to this list.
const paymentMethods: PaymentMethod[] = ['cash'];

export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { loading, restaurant } = useRestaurant(id);
  const insets = useSafeAreaInsets();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [fulfillment, setFulfillment] = useState<'Pickup' | 'Delivery'>('Pickup');
  const [address, setAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [delivered, setDelivered] = useState(true);
  const [notifying, setNotifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Prefill only empty fields, so a slow load never overwrites what the customer already typed.
    getGuestProfile().then((profile) => { setName((current) => current || profile.name); setPhone((current) => current || profile.phone); setEmail((current) => current || profile.email); }).catch(() => undefined);
  }, []);

  const menu = useMemo(() => restaurant
    ? restaurant.menu.map((item) => ({ ...item, available: isMenuItemAvailable(item, restaurant) }))
    : [], [restaurant]);
  // Quantities are keyed by menu item id; unavailable items never count toward the total.
  const total = useMemo(() => menu.reduce((sum, item) => sum + (item.available ? item.price * (quantities[item.id] ?? 0) : 0), 0), [menu, quantities]);

  if (loading) return <SafeAreaView style={styles.confirmation}><Text style={styles.subtitle}>Loading menu…</Text></SafeAreaView>;
  if (!restaurant) {
    return <SafeAreaView style={styles.confirmation}>
      <Text style={styles.confirmationTitle}>Restaurant not found</Text>
      <Pressable onPress={() => goBackOrReplace('/')} style={styles.submit}><Text style={styles.submitText}>Back to restaurants</Text></Pressable>
    </SafeAreaView>;
  }

  const changeQuantity = (itemId: string, change: number) => {
    const item = menu.find((food) => food.id === itemId);
    if (!item?.available) return;
    setQuantities((current) => ({ ...current, [itemId]: Math.max(0, (current[itemId] ?? 0) + change) }));
  };
  const submit = async () => {
    const items = menu.filter((item) => item.available && (quantities[item.id] ?? 0) > 0).map((item) => ({ name: item.name, price: formatTsh(item.price), quantity: quantities[item.id] }));
    if (!items.length) return Alert.alert('Empty order', 'Add at least one menu item.');
    if (!name.trim() || !phone.trim()) return Alert.alert('Missing information', 'Enter your name and phone number.');
    if (phone.replace(/\D/g, '').length < 7) return Alert.alert('Invalid phone number', 'Enter a valid phone number with at least 7 digits.');
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) return Alert.alert('Invalid email', 'Enter a valid email address or leave it blank.');
    if (fulfillment === 'Delivery' && !address.trim()) return Alert.alert('Delivery address needed', 'Enter the address for your delivery.');
    const reference = newReference('FO');
    const guest = { name: name.trim(), phone: phone.trim(), email: email.trim() };
    try {
      setSubmitting(true);
      // Asking here, right after the customer orders, is when "tell me when it's ready" makes sense.
      const pushToken = await getPushToken({ ask: true });
      const [, sent] = await Promise.all([
        saveGuestProfile(guest),
        saveOrder({ id: reference, restaurantId: restaurant.id, restaurantName: restaurant.name, guest, fulfillment, address: address.trim(), items, total, paymentMethod, paymentStatus: 'unpaid', pushToken, createdAt: new Date().toISOString() }),
      ]);
      setDelivered(sent);
      setNotifying(Boolean(pushToken));
      setConfirmation(reference);
    } catch {
      Alert.alert('Could not save order', 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const paymentLabel = describePayment(paymentMethod, fulfillment);
  const paymentInstruction = fulfillment === 'Delivery' ? 'when your order arrives' : 'when you collect your order';

  if (confirmation) return <SafeAreaView style={styles.confirmation}><Text style={styles.check}>✓</Text><Text style={styles.confirmationTitle}>{delivered ? 'Order received' : 'Order saved'}</Text><Text style={styles.confirmationCopy}>{restaurant.name}{'\n'}{fulfillment} · TSh {total.toLocaleString()}</Text>{!delivered && <Text style={styles.pendingNote}>You are offline, so the restaurant has not received this order yet. It is saved on this phone and will be sent automatically as soon as you are back online.</Text>}<Text style={styles.confirmationPayment}>Please have TSh {total.toLocaleString()} in cash ready {paymentInstruction}.</Text>{notifying && <Text style={styles.notifyNote}>We will send you a notification when the restaurant accepts your order and when it is ready.</Text>}<Text style={styles.reference}>REFERENCE {confirmation}</Text><Pressable onPress={() => router.replace('/')} style={styles.submit}><Text style={styles.submitText}>Back to home</Text></Pressable></SafeAreaView>;

  return <SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]} keyboardShouldPersistTaps="handled"><Pressable onPress={() => goBackOrReplace(`/restaurant/${restaurant.id}`)}><Text style={styles.back}>‹ Restaurant details</Text></Pressable><Text style={styles.eyebrow}>ORDER FOOD</Text><Text style={styles.title}>{restaurant.name}</Text><Text style={styles.subtitle}>Choose your dishes and quantities.</Text>
    {menu.length === 0 && <Text style={styles.subtitle}>This restaurant has not published its menu yet.</Text>}<View style={styles.menuList}>{menu.map((item) => <View key={item.id} style={[styles.menuCard, !item.available && styles.menuCardUnavailable]}>{item.photoUrl ? <Image contentFit="cover" source={item.photoUrl} style={styles.photo} /> : <View style={styles.photoPlaceholder}><Text style={styles.photoPlaceholderIcon}>🍽️</Text></View>}<View style={styles.menuCopy}><Text style={styles.menuName}>{item.name}</Text><Text style={styles.menuDescription}>{item.description}</Text><Text style={styles.price}>{formatTsh(item.price)}</Text>{!item.available && <Text style={styles.unavailableBadge}>UNAVAILABLE</Text>}<View style={styles.stepper}><Pressable accessibilityLabel={`Remove one ${item.name}`} disabled={!item.available} onPress={() => changeQuantity(item.id, -1)} style={styles.stepButton}><Text style={[styles.stepText, !item.available && styles.disabledText]}>−</Text></Pressable><Text style={styles.quantity}>{quantities[item.id] ?? 0}</Text><Pressable accessibilityLabel={`Add one ${item.name}`} disabled={!item.available} onPress={() => changeQuantity(item.id, 1)} style={styles.stepButton}><Text style={[styles.stepText, !item.available && styles.disabledText]}>+</Text></Pressable></View></View></View>)}</View>
    <Text style={styles.sectionTitle}>How should we prepare it?</Text><View style={styles.choices}>{(['Pickup', 'Delivery'] as const).map((value) => <Pressable key={value} onPress={() => setFulfillment(value)} style={[styles.choice, fulfillment === value && styles.choiceActive]}><Text style={[styles.choiceText, fulfillment === value && styles.choiceTextActive]}>{value}</Text></Pressable>)}</View>
    {fulfillment === 'Delivery' && <><Text style={styles.label}>DELIVERY ADDRESS</Text><TextInput multiline onChangeText={setAddress} placeholder="Street, building, and area" style={[styles.input, styles.addressInput]} value={address} /></>}
    <Text style={styles.sectionTitle}>Guest details</Text><Text style={styles.label}>YOUR NAME</Text><TextInput autoComplete="name" onChangeText={setName} placeholder="Full name" style={styles.input} value={name} /><Text style={styles.label}>PHONE</Text><TextInput autoComplete="tel" keyboardType="phone-pad" onChangeText={setPhone} placeholder="+255..." style={styles.input} value={phone} /><Text style={styles.label}>EMAIL (OPTIONAL)</Text><TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" onChangeText={setEmail} placeholder="you@example.com" style={styles.input} value={email} />
    <Text style={styles.sectionTitle}>Payment</Text><View accessibilityRole="radiogroup" style={styles.paymentList}>{paymentMethods.map((method) => { const selected = paymentMethod === method; return <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} key={method} onPress={() => setPaymentMethod(method)} style={[styles.paymentOption, selected && styles.paymentOptionActive]}><View style={[styles.radio, selected && styles.radioActive]}>{selected && <View style={styles.radioDot} />}</View><View style={styles.paymentCopy}><Text style={styles.paymentTitle}>{describePayment(method, fulfillment)}</Text><Text style={styles.paymentDescription}>Pay the restaurant in cash {paymentInstruction}.</Text></View></Pressable>; })}</View>
    <View style={styles.totalRow}><Text style={styles.totalLabel}>ORDER TOTAL</Text><Text style={styles.total}>TSh {total.toLocaleString()}</Text></View><Pressable disabled={submitting} onPress={submit} style={[styles.submit, submitting && styles.disabled]}><Text style={styles.submitText}>{submitting ? 'Sending order…' : `Confirm ${fulfillment.toLowerCase()} order`}</Text></Pressable><Text style={styles.paymentNote}>{paymentLabel} · nothing is charged in the app.</Text>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: CREAM }, content: { width: '100%', maxWidth: 700, alignSelf: 'center', padding: 20 }, back: { color: ORANGE, fontSize: 14, fontWeight: '800', marginBottom: 25 }, eyebrow: { color: ORANGE, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, title: { color: '#171612', fontSize: 32, fontWeight: '900', marginTop: 6 }, subtitle: { color: '#777268', fontSize: 14, marginTop: 6, marginBottom: 20 },
  menuList: { gap: 12 }, menuCard: { flexDirection: 'row', minHeight: 135, overflow: 'hidden', borderWidth: 1, borderColor: '#EEE6DA', borderRadius: 18, backgroundColor: '#FFF' }, menuCardUnavailable: { opacity: 0.68, backgroundColor: '#FFF8ED' }, photo: { width: 125, backgroundColor: '#DDD4C9' }, photoPlaceholder: { width: 125, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4E9DC' }, photoPlaceholderIcon: { fontSize: 38 }, menuCopy: { flex: 1, padding: 13 }, menuName: { color: '#171612', fontSize: 15, fontWeight: '900' }, menuDescription: { color: '#777268', fontSize: 10, lineHeight: 14, marginTop: 4 }, price: { color: ORANGE, fontSize: 12, fontWeight: '900', marginTop: 7 }, unavailableBadge: { alignSelf: 'flex-start', color: '#8E2F1A', backgroundColor: '#F5D8D1', borderRadius: 8, overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 3, fontSize: 7, fontWeight: '900', marginTop: 6 }, stepper: { position: 'absolute', right: 10, bottom: 9, flexDirection: 'row', alignItems: 'center', borderRadius: 16, backgroundColor: '#FFF1E6' }, stepButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }, stepText: { color: ORANGE, fontSize: 20, fontWeight: '900' }, disabledText: { color: '#AFA8A0' }, quantity: { minWidth: 24, textAlign: 'center', color: '#171612', fontWeight: '900' },
  sectionTitle: { color: '#171612', fontSize: 20, fontWeight: '900', marginTop: 28, marginBottom: 12 }, choices: { flexDirection: 'row', gap: 9 }, choice: { flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: 22, borderWidth: 1, borderColor: '#E9DFD2', backgroundColor: '#FFF' }, choiceActive: { borderColor: ORANGE, backgroundColor: ORANGE }, choiceText: { color: '#4F4A43', fontWeight: '900' }, choiceTextActive: { color: '#FFF' },
  label: { color: '#777268', fontSize: 10, fontWeight: '900', letterSpacing: 0.7, marginTop: 15, marginBottom: 7 }, input: { height: 50, borderWidth: 1, borderColor: '#E9DFD2', borderRadius: 14, paddingHorizontal: 15, color: '#171612', backgroundColor: '#FFF' }, addressInput: { height: 82, paddingTop: 14, textAlignVertical: 'top' }, totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 24, marginTop: 24, borderTopWidth: 1, borderTopColor: '#E9DFD2' }, totalLabel: { color: '#777268', fontSize: 10, fontWeight: '900' }, total: { color: '#171612', fontSize: 22, fontWeight: '900' }, submit: { minHeight: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, borderRadius: 26, backgroundColor: ORANGE, marginTop: 18 }, submitText: { color: '#FFF', fontSize: 13, fontWeight: '900' }, paymentNote: { color: '#8A847B', textAlign: 'center', fontSize: 10, marginTop: 10 },
  paymentList: { gap: 9 }, paymentOption: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 15, borderWidth: 1, borderColor: '#E9DFD2', borderRadius: 16, backgroundColor: '#FFF' }, paymentOptionActive: { borderColor: ORANGE, backgroundColor: '#FFF6EF' }, radio: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#CFC5B9', borderRadius: 10 }, radioActive: { borderColor: ORANGE }, radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: ORANGE }, paymentCopy: { flex: 1 }, paymentTitle: { color: '#171612', fontSize: 14, fontWeight: '900' }, paymentDescription: { color: '#777268', fontSize: 11, lineHeight: 16, marginTop: 3 },
  notifyNote: { color: '#5F5951', textAlign: 'center', fontSize: 12, lineHeight: 18, marginTop: 12, maxWidth: 360 },
  pendingNote: { color: '#8E2F1A', textAlign: 'center', fontSize: 13, lineHeight: 19, marginTop: 14, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: '#F5D8D1', maxWidth: 420 },
  confirmationPayment: { color: '#5F5951', textAlign: 'center', fontSize: 13, lineHeight: 19, marginTop: 14, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: '#FFF1E6' },
  confirmation: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: CREAM }, check: { width: 70, height: 70, borderRadius: 35, overflow: 'hidden', textAlign: 'center', textAlignVertical: 'center', color: '#FFF', backgroundColor: '#278653', fontSize: 38, fontWeight: '900' }, confirmationTitle: { color: '#171612', fontSize: 28, fontWeight: '900', marginTop: 24 }, confirmationCopy: { color: '#5F5951', textAlign: 'center', fontSize: 15, lineHeight: 23, marginTop: 10 }, reference: { color: ORANGE, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginTop: 18 },
  disabled: { opacity: 0.6 },
});
