import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { categoryIcon, categoryLabel, groupByCategory } from '@/data/menu-categories';
import { fulfillmentLabel, getGuestProfile, newReference, saveGuestProfile, saveOrder } from '@/data/guest-storage';
import { formatTsh, isMenuItemAvailable, useRestaurant } from '@/data/restaurants';
import { t } from '@/i18n';
import { goBackOrReplace } from '@/utils/navigation';
import { getPushToken } from '@/utils/push-notifications';
import { showMessage } from '@/utils/feedback';
import { themedStyles } from '@/theme/theme';

const ORANGE = '#ED6417';
const CREAM = '#FFF8ED';

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

  if (loading) return <SafeAreaView style={styles.confirmation}><Text style={styles.subtitle}>{t('order.loading')}</Text></SafeAreaView>;
  if (!restaurant) {
    return <SafeAreaView style={styles.confirmation}>
      <Text style={styles.confirmationTitle}>{t('restaurant.notFound')}</Text>
      <Pressable onPress={() => goBackOrReplace('/')} style={styles.submit}><Text style={styles.submitText}>{t('restaurant.backToList')}</Text></Pressable>
    </SafeAreaView>;
  }

  const changeQuantity = (itemId: string, change: number) => {
    const item = menu.find((food) => food.id === itemId);
    if (!item?.available) return;
    setQuantities((current) => ({ ...current, [itemId]: Math.max(0, (current[itemId] ?? 0) + change) }));
  };
  const submit = async () => {
    const items = menu.filter((item) => item.available && (quantities[item.id] ?? 0) > 0).map((item) => ({ id: item.id, name: item.name, price: formatTsh(item.price), quantity: quantities[item.id] }));
    if (!items.length) return showMessage(t('order.emptyTitle'), t('order.emptyBody'));
    if (!name.trim() || !phone.trim()) return showMessage(t('request.missingTitle'), t('request.missingBody'));
    if (phone.replace(/\D/g, '').length < 7) return showMessage(t('request.phoneTitle'), t('request.phoneBody'));
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) return showMessage(t('request.emailTitle'), t('request.emailBody'));
    if (fulfillment === 'Delivery' && !address.trim()) return showMessage(t('order.addressTitle'), t('order.addressBody'));
    const reference = newReference('KO');
    const guest = { name: name.trim(), phone: phone.trim(), email: email.trim() };
    try {
      setSubmitting(true);
      // Asking here, right after the customer orders, is when "tell me when it's ready" makes sense.
      const pushToken = await getPushToken({ ask: true });
      const [, result] = await Promise.all([
        saveGuestProfile(guest),
        saveOrder({ id: reference, restaurantId: restaurant.id, restaurantName: restaurant.name, guest, fulfillment, address: address.trim(), items, total, paymentMethod: 'cash', paymentStatus: 'unpaid', pushToken, createdAt: new Date().toISOString() }),
      ]);
      if (result.outcome === 'rejected') return showMessage(t('order.rejected'), result.reason);
      setDelivered(result.outcome === 'sent');
      setNotifying(Boolean(pushToken));
      setConfirmation(reference);
    } catch {
      showMessage(t('order.saveFailed'), t('common.tryAgain'));
    } finally {
      setSubmitting(false);
    }
  };

  // Cash only: delivery orders are paid to the rider when the food arrives, pickup orders at the counter.
  const amount = formatTsh(total);
  const delivery = fulfillment === 'Delivery';
  const paymentInstruction = t(delivery ? 'order.payOnDelivery' : 'order.payAtPickup', { amount });

  if (confirmation) return <SafeAreaView style={styles.confirmation}><Text style={styles.check}>✓</Text><Text style={styles.confirmationTitle}>{t(delivered ? 'order.received' : 'order.saved')}</Text><Text style={styles.confirmationCopy}>{restaurant.name}{'\n'}{fulfillmentLabel(fulfillment)} · {amount}</Text>{!delivered && <Text style={styles.pendingNote}>{t('order.offlineNote')}</Text>}<Text style={styles.confirmationPayment}>{paymentInstruction}</Text>{notifying && <Text style={styles.notifyNote}>{t(delivery ? 'order.notifyDelivery' : 'order.notifyPickup')}</Text>}<Text style={styles.reference}>{t('request.reference', { reference: confirmation })}</Text><Pressable onPress={() => router.replace('/')} style={styles.submit}><Text style={styles.submitText}>{t('request.backHome')}</Text></Pressable></SafeAreaView>;

  return <SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]} keyboardShouldPersistTaps="handled"><Pressable onPress={() => goBackOrReplace(`/restaurant/${restaurant.id}`)}><Text style={styles.back}>{t('request.backToDetails')}</Text></Pressable><Text style={styles.eyebrow}>{t('order.eyebrow')}</Text><Text style={styles.title}>{restaurant.name}</Text><Text style={styles.subtitle}>{t('order.subtitle')}</Text>
    {menu.length === 0 && <Text style={styles.subtitle}>{t('order.noMenu')}</Text>}{groupByCategory(menu).map((group) => <View key={group.category}><Text accessibilityRole="header" style={styles.categoryHeading}>{categoryIcon(group.category)} {categoryLabel(group.category)}</Text><View style={styles.menuList}>{group.items.map((item) => <View key={item.id} style={[styles.menuCard, !item.available && styles.menuCardUnavailable]}>{item.photoUrl ? <Image contentFit="cover" source={item.photoUrl} style={styles.photo} /> : <View style={styles.photoPlaceholder}><Text style={styles.photoPlaceholderIcon}>🍽️</Text></View>}<View style={styles.menuCopy}><Text style={styles.menuName}>{item.name}</Text>{item.description ? <Text style={styles.menuDescription}>{item.description}</Text> : null}<Text style={styles.price}>{formatTsh(item.price)}</Text>{!item.available && <Text style={styles.unavailableBadge}>{t('restaurant.unavailable')}</Text>}<View style={styles.stepper}><Pressable accessibilityLabel={t('order.removeOne', { name: item.name })} disabled={!item.available} onPress={() => changeQuantity(item.id, -1)} style={styles.stepButton}><Text style={[styles.stepText, !item.available && styles.disabledText]}>−</Text></Pressable><Text style={styles.quantity}>{quantities[item.id] ?? 0}</Text><Pressable accessibilityLabel={t('order.addOne', { name: item.name })} disabled={!item.available} onPress={() => changeQuantity(item.id, 1)} style={styles.stepButton}><Text style={[styles.stepText, !item.available && styles.disabledText]}>+</Text></Pressable></View></View></View>)}</View></View>)}
    <Text style={styles.sectionTitle}>{t('order.howTitle')}</Text><View style={styles.choices}>{(['Pickup', 'Delivery'] as const).map((value) => <Pressable key={value} onPress={() => setFulfillment(value)} style={[styles.choice, fulfillment === value && styles.choiceActive]}><Text style={[styles.choiceText, fulfillment === value && styles.choiceTextActive]}>{fulfillmentLabel(value)}</Text></Pressable>)}</View>
    {delivery && <><Text style={styles.label}>{t('order.address')}</Text><TextInput multiline onChangeText={setAddress} placeholder={t('order.addressPlaceholder')} style={[styles.input, styles.addressInput]} value={address} /></>}
    <Text style={styles.sectionTitle}>{t('order.guestDetails')}</Text><Text style={styles.label}>{t('profile.name')}</Text><TextInput autoComplete="name" onChangeText={setName} placeholder={t('profile.namePlaceholder')} style={styles.input} value={name} /><Text style={styles.label}>{t('profile.phone')}</Text><TextInput autoComplete="tel" keyboardType="phone-pad" onChangeText={setPhone} placeholder="+255..." style={styles.input} value={phone} /><Text style={styles.label}>{t('profile.emailOptional')}</Text><TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" onChangeText={setEmail} placeholder="you@example.com" style={styles.input} value={email} />
    {delivery && <><Text style={styles.sectionTitle}>{t('order.paymentTitle')}</Text><View style={styles.paymentCard}><Text style={styles.paymentTitle}>{t('order.paymentCardTitle')}</Text><Text style={styles.paymentDescription}>{t('order.paymentCardBody')}</Text></View></>}
    <View style={styles.totalRow}><Text style={styles.totalLabel}>{t('order.total')}</Text><Text style={styles.total}>{amount}</Text></View><Pressable disabled={submitting} onPress={submit} style={[styles.submit, submitting && styles.disabled]}><Text style={styles.submitText}>{t(submitting ? 'order.sending' : delivery ? 'order.confirmDelivery' : 'order.confirmPickup')}</Text></Pressable><Text style={styles.paymentNote}>{t(delivery ? 'order.noteDelivery' : 'order.notePickup')}</Text>
  </ScrollView></SafeAreaView>;
}

const styles = themedStyles(({ bg, fg, line }) => ({
  safeArea: { flex: 1, backgroundColor: bg(CREAM) }, content: { width: '100%', maxWidth: 700, alignSelf: 'center', padding: 20 }, back: { color: fg(ORANGE), fontSize: 14, fontWeight: '800', marginBottom: 25 }, eyebrow: { color: fg(ORANGE), fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, title: { color: fg('#171612'), fontSize: 32, fontWeight: '900', marginTop: 6 }, subtitle: { color: fg('#777268'), fontSize: 14, marginTop: 6, marginBottom: 20 },
  menuList: { gap: 12 }, categoryHeading: { color: fg('#171612'), fontSize: 16, fontWeight: '900', marginTop: 16, marginBottom: 9 }, menuCard: { flexDirection: 'row', minHeight: 135, overflow: 'hidden', borderWidth: 1, borderColor: line('#EEE6DA'), borderRadius: 18, backgroundColor: bg('#FFF') }, menuCardUnavailable: { opacity: 0.68, backgroundColor: bg('#FFF8ED') }, photo: { width: 125, backgroundColor: bg('#DDD4C9') }, photoPlaceholder: { width: 125, alignItems: 'center', justifyContent: 'center', backgroundColor: bg('#F4E9DC') }, photoPlaceholderIcon: { fontSize: 38 }, menuCopy: { flex: 1, padding: 13 }, menuName: { color: fg('#171612'), fontSize: 15, fontWeight: '900' }, menuDescription: { color: fg('#777268'), fontSize: 10, lineHeight: 14, marginTop: 4 }, price: { color: fg(ORANGE), fontSize: 12, fontWeight: '900', marginTop: 7 }, unavailableBadge: { alignSelf: 'flex-start', color: fg('#8E2F1A'), backgroundColor: bg('#F5D8D1'), borderRadius: 8, overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 3, fontSize: 7, fontWeight: '900', marginTop: 6 }, stepper: { position: 'absolute', right: 10, bottom: 9, flexDirection: 'row', alignItems: 'center', borderRadius: 16, backgroundColor: bg('#FFF1E6') }, stepButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }, stepText: { color: fg(ORANGE), fontSize: 20, fontWeight: '900' }, disabledText: { color: fg('#AFA8A0') }, quantity: { minWidth: 24, textAlign: 'center', color: fg('#171612'), fontWeight: '900' },
  sectionTitle: { color: fg('#171612'), fontSize: 20, fontWeight: '900', marginTop: 28, marginBottom: 12 }, choices: { flexDirection: 'row', gap: 9 }, choice: { flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: 22, borderWidth: 1, borderColor: line('#E9DFD2'), backgroundColor: bg('#FFF') }, choiceActive: { borderColor: line(ORANGE), backgroundColor: bg(ORANGE) }, choiceText: { color: fg('#4F4A43'), fontWeight: '900' }, choiceTextActive: { color: fg('#FFF') },
  label: { color: fg('#777268'), fontSize: 10, fontWeight: '900', letterSpacing: 0.7, marginTop: 15, marginBottom: 7 }, input: { height: 50, borderWidth: 1, borderColor: line('#E9DFD2'), borderRadius: 14, paddingHorizontal: 15, color: fg('#171612'), backgroundColor: bg('#FFF') }, addressInput: { height: 82, paddingTop: 14, textAlignVertical: 'top' }, totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 24, marginTop: 24, borderTopWidth: 1, borderTopColor: line('#E9DFD2') }, totalLabel: { color: fg('#777268'), fontSize: 10, fontWeight: '900' }, total: { color: fg('#171612'), fontSize: 22, fontWeight: '900' }, submit: { minHeight: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, borderRadius: 26, backgroundColor: bg(ORANGE), marginTop: 18 }, submitText: { color: fg('#FFF'), fontSize: 13, fontWeight: '900' }, paymentNote: { color: fg('#8A847B'), textAlign: 'center', fontSize: 10, marginTop: 10 }, paymentCard: { padding: 15, borderWidth: 1, borderColor: line(ORANGE), borderRadius: 16, backgroundColor: bg('#FFF6EF') }, paymentTitle: { color: fg('#171612'), fontSize: 14, fontWeight: '900' }, paymentDescription: { color: fg('#777268'), fontSize: 11, lineHeight: 16, marginTop: 3 },
  notifyNote: { color: fg('#5F5951'), textAlign: 'center', fontSize: 12, lineHeight: 18, marginTop: 12, maxWidth: 360 },
  pendingNote: { color: fg('#8E2F1A'), textAlign: 'center', fontSize: 13, lineHeight: 19, marginTop: 14, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: bg('#F5D8D1'), maxWidth: 420 },
  confirmationPayment: { color: fg('#5F5951'), textAlign: 'center', fontSize: 13, lineHeight: 19, marginTop: 14, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: bg('#FFF1E6') },
  confirmation: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: bg(CREAM) }, check: { width: 70, height: 70, borderRadius: 35, overflow: 'hidden', textAlign: 'center', textAlignVertical: 'center', color: fg('#FFF'), backgroundColor: bg('#278653'), fontSize: 38, fontWeight: '900' }, confirmationTitle: { color: fg('#171612'), fontSize: 28, fontWeight: '900', marginTop: 24 }, confirmationCopy: { color: fg('#5F5951'), textAlign: 'center', fontSize: 15, lineHeight: 23, marginTop: 10 }, reference: { color: fg(ORANGE), fontSize: 11, fontWeight: '900', letterSpacing: 1, marginTop: 18 },
  disabled: { opacity: 0.6 },
}));
