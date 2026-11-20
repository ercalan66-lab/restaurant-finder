import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getMyOrders,
  MOBILE_MONEY,
  paymentMethodLabel,
  payOrder,
  refreshRequestStatuses,
  type MobileMoneyMethod,
  type OrderRecord,
} from '@/data/guest-storage';
import { errorMessage } from '@/utils/feedback';
import { goBackOrReplace } from '@/utils/navigation';
import { toE164 } from '@/utils/phone';

const ORANGE = '#ED6417';
const CREAM = '#FFF8ED';
/** Stands in for the customer approving the prompt on their phone until a real gateway is connected. */
const SIMULATED_APPROVAL_MS = 1500;

async function loadOrder(reference: string | undefined) {
  await refreshRequestStatuses().catch(() => false);
  return (await getMyOrders()).find((order) => order.id === reference) ?? null;
}

export default function PayScreen() {
  const { reference } = useLocalSearchParams<{ reference: string }>();
  const [order, setOrder] = useState<OrderRecord | null | undefined>(undefined);
  const [method, setMethod] = useState<MobileMoneyMethod>('mpesa');
  const [payerPhone, setPayerPhone] = useState('');
  const [stage, setStage] = useState<'choose' | 'approving'>('choose');

  useFocusEffect(useCallback(() => {
    let active = true;
    void loadOrder(reference).then((found) => {
      if (!active) return;
      setOrder(found);
      if (found) setPayerPhone((current) => current || found.guest.phone);
    });
    return () => { active = false; };
  }, [reference]));

  const refresh = () => void loadOrder(reference).then(setOrder);

  if (order === undefined) return <Centered><Text style={styles.copy}>Loading your order…</Text></Centered>;
  if (order === null) {
    return <Centered>
      <Text style={styles.title}>Order not found</Text>
      <Text style={styles.copy}>Payments can be made from the phone that placed the order.</Text>
      <PrimaryButton label="Back to your orders" onPress={() => router.replace('/profile')} />
    </Centered>;
  }

  const amount = `TSh ${order.total.toLocaleString()}`;
  const methodLabel = paymentMethodLabel(method);

  if (order.paymentStatus === 'paid') {
    const simulated = order.paymentReference?.startsWith('SIM-');
    return <Centered>
      <Text style={styles.check}>✓</Text>
      <Text style={styles.title}>Payment received</Text>
      <Text style={styles.copy}>{order.restaurantName}{'\n'}{amount} · {paymentMethodLabel(order.paymentMethod)}</Text>
      {order.paymentReference ? <Text style={styles.reference}>PAYMENT {order.paymentReference}</Text> : null}
      {simulated && <Text style={styles.testNote}>Test payment: no money was moved.</Text>}
      <PrimaryButton label="Back to your orders" onPress={() => router.replace('/profile')} />
    </Centered>;
  }

  if (order.fulfillment !== 'Delivery') {
    return <Centered>
      <Text style={styles.title}>Pay at the restaurant</Text>
      <Text style={styles.copy}>Pickup orders are paid at the counter when you collect your food.</Text>
      <PrimaryButton label="Back to your orders" onPress={() => router.replace('/profile')} />
    </Centered>;
  }

  if (order.status !== 'delivered') {
    return <Centered>
      <Text style={styles.title}>Not delivered yet</Text>
      <Text style={styles.copy}>You can pay once the restaurant marks your order delivered. We will notify you when it arrives.</Text>
      <Text style={styles.reference}>STATUS {(order.status ?? 'pending').toUpperCase()}</Text>
      <PrimaryButton label="Check again" onPress={refresh} />
    </Centered>;
  }

  const pay = async () => {
    if (!toE164(payerPhone)) return Alert.alert('Check the number', `Enter the ${methodLabel} number to pay from, for example 0712 345 678.`);
    setStage('approving');
    try {
      await new Promise((resolve) => setTimeout(resolve, SIMULATED_APPROVAL_MS));
      await payOrder(order, method);
      setOrder(await loadOrder(reference));
    } catch (error) {
      Alert.alert('Payment not completed', errorMessage(error));
      refresh();
    } finally {
      setStage('choose');
    }
  };

  return <SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Pressable onPress={() => goBackOrReplace('/profile')}><Text style={styles.back}>‹ Your orders</Text></Pressable>
    <Text style={styles.eyebrow}>PAY ON DELIVERY</Text>
    <Text style={styles.title}>{amount}</Text>
    <Text style={styles.copyLeft}>{order.restaurantName} · order {order.id}</Text>

    <View style={styles.testBanner}><Text style={styles.testBannerTitle}>Test mode</Text><Text style={styles.testBannerCopy}>No money moves yet. Real mobile money payments start once Kwetu connects a payment provider.</Text></View>

    <Text style={styles.label}>PAY WITH</Text>
    <View accessibilityRole="radiogroup" style={styles.methods}>
      {MOBILE_MONEY.map((option) => {
        const selected = option.method === method;
        return <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} disabled={stage !== 'choose'} key={option.method} onPress={() => setMethod(option.method)} style={[styles.method, selected && styles.methodActive]}>
          <View style={[styles.radio, selected && styles.radioActive]}>{selected && <View style={styles.radioDot} />}</View>
          <Text style={styles.methodLabel}>{option.label}</Text>
        </Pressable>;
      })}
    </View>

    <Text style={styles.label}>{methodLabel.toUpperCase()} NUMBER</Text>
    <TextInput autoComplete="tel" editable={stage === 'choose'} keyboardType="phone-pad" onChangeText={setPayerPhone} placeholder="0712 345 678" style={styles.input} value={payerPhone} />

    <PrimaryButton disabled={stage !== 'choose'} label={stage === 'approving' ? `Approve on your phone…` : `Pay ${amount} with ${methodLabel}`} onPress={() => void pay()} />
    <Text style={styles.cashNote}>Paying cash instead? Hand {amount} to the rider. The restaurant will mark it paid.</Text>
  </ScrollView></SafeAreaView>;
}

function Centered({ children }: { children: React.ReactNode }) {
  return <SafeAreaView style={[styles.safeArea, styles.centered]}><View style={styles.centeredInner}>{children}</View></SafeAreaView>;
}

function PrimaryButton({ disabled, label, onPress }: { disabled?: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button, disabled && styles.disabled]}><Text style={styles.buttonText}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: CREAM },
  centered: { alignItems: 'center', justifyContent: 'center' },
  centeredInner: { width: '100%', maxWidth: 420, alignItems: 'center', padding: 28 },
  content: { width: '100%', maxWidth: 560, alignSelf: 'center', padding: 20, paddingBottom: 60 },
  back: { color: ORANGE, fontSize: 14, fontWeight: '800', marginBottom: 25 },
  eyebrow: { color: ORANGE, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#171612', fontSize: 30, fontWeight: '900', marginTop: 6, textAlign: 'center' },
  copy: { color: '#5F5951', fontSize: 14, lineHeight: 21, marginTop: 10, textAlign: 'center' },
  copyLeft: { color: '#5F5951', fontSize: 14, lineHeight: 21, marginTop: 6 },
  check: { width: 70, height: 70, borderRadius: 35, overflow: 'hidden', textAlign: 'center', textAlignVertical: 'center', lineHeight: 70, color: '#FFF', backgroundColor: '#278653', fontSize: 38, fontWeight: '900' },
  reference: { color: ORANGE, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginTop: 16 },
  testNote: { color: '#8A5A00', fontSize: 12, marginTop: 8 },
  testBanner: { marginTop: 18, padding: 13, borderRadius: 14, borderWidth: 1, borderColor: '#EBD9A8', backgroundColor: '#FFF7DE' },
  testBannerTitle: { color: '#6B4A00', fontSize: 12, fontWeight: '900' },
  testBannerCopy: { color: '#6B5A30', fontSize: 12, lineHeight: 17, marginTop: 3 },
  label: { color: '#777268', fontSize: 10, fontWeight: '900', letterSpacing: 0.7, marginTop: 20, marginBottom: 8 },
  methods: { gap: 8 },
  method: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1, borderColor: '#E9DFD2', borderRadius: 14, backgroundColor: '#FFF' },
  methodActive: { borderColor: ORANGE, backgroundColor: '#FFF6EF' },
  methodLabel: { color: '#171612', fontSize: 14, fontWeight: '900' },
  radio: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#CFC5B9', borderRadius: 10 },
  radioActive: { borderColor: ORANGE },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: ORANGE },
  input: { height: 50, borderWidth: 1, borderColor: '#E9DFD2', borderRadius: 14, paddingHorizontal: 15, color: '#171612', backgroundColor: '#FFF' },
  button: { alignSelf: 'stretch', minHeight: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, borderRadius: 26, backgroundColor: ORANGE, marginTop: 24 },
  buttonText: { color: '#FFF', fontSize: 13, fontWeight: '900' },
  disabled: { opacity: 0.6 },
  cashNote: { color: '#777268', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 14 },
});
