import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { orderStatus } from '@/components/activity-section';
import {
  getMyOrders,
  MOBILE_MONEY,
  paymentMethodLabel,
  payOrder,
  refreshRequestStatuses,
  type MobileMoneyMethod,
  type OrderRecord,
} from '@/data/guest-storage';
import { formatTsh } from '@/data/restaurants';
import { t } from '@/i18n';
import { errorMessage, showMessage } from '@/utils/feedback';
import { goBackOrReplace } from '@/utils/navigation';
import { toE164 } from '@/utils/phone';
import { themedStyles } from '@/theme/theme';

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

  if (order === undefined) return <Centered><Text style={styles.copy}>{t('pay.loading')}</Text></Centered>;
  if (order === null) {
    return <Centered>
      <Text style={styles.title}>{t('pay.notFound')}</Text>
      <Text style={styles.copy}>{t('pay.notFoundBody')}</Text>
      <PrimaryButton label={t('pay.backToOrders')} onPress={() => router.replace('/profile')} />
    </Centered>;
  }

  const amount = formatTsh(order.total);
  const methodLabel = paymentMethodLabel(method);

  if (order.paymentStatus === 'paid') {
    const simulated = order.paymentReference?.startsWith('SIM-');
    return <Centered>
      <Text style={styles.check}>✓</Text>
      <Text style={styles.title}>{t('pay.received')}</Text>
      <Text style={styles.copy}>{order.restaurantName}{'\n'}{amount} · {paymentMethodLabel(order.paymentMethod)}</Text>
      {order.paymentReference ? <Text style={styles.reference}>{t('pay.reference', { reference: order.paymentReference })}</Text> : null}
      {simulated && <Text style={styles.testNote}>{t('pay.testDone')}</Text>}
      <PrimaryButton label={t('pay.backToOrders')} onPress={() => router.replace('/profile')} />
    </Centered>;
  }

  if (order.fulfillment !== 'Delivery') {
    return <Centered>
      <Text style={styles.title}>{t('payment.atRestaurant')}</Text>
      <Text style={styles.copy}>{t('pay.atRestaurantBody')}</Text>
      <PrimaryButton label={t('pay.backToOrders')} onPress={() => router.replace('/profile')} />
    </Centered>;
  }

  if (order.status !== 'delivered') {
    return <Centered>
      <Text style={styles.title}>{t('pay.notDelivered')}</Text>
      <Text style={styles.copy}>{t('pay.notDeliveredBody')}</Text>
      <Text style={styles.reference}>{t('pay.status', { status: t(orderStatus(order).label) })}</Text>
      <PrimaryButton label={t('pay.checkAgain')} onPress={refresh} />
    </Centered>;
  }

  const pay = async () => {
    if (!toE164(payerPhone)) return showMessage(t('pay.checkNumber'), t('pay.checkNumberBody', { method: methodLabel }));
    setStage('approving');
    try {
      await new Promise((resolve) => setTimeout(resolve, SIMULATED_APPROVAL_MS));
      await payOrder(order, method);
      setOrder(await loadOrder(reference));
    } catch (error) {
      showMessage(t('pay.failed'), errorMessage(error));
      refresh();
    } finally {
      setStage('choose');
    }
  };

  return <SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Pressable onPress={() => goBackOrReplace('/profile')}><Text style={styles.back}>{t('pay.back')}</Text></Pressable>
    <Text style={styles.eyebrow}>{t('pay.eyebrow')}</Text>
    <Text style={styles.title}>{amount}</Text>
    <Text style={styles.copyLeft}>{t('pay.orderLine', { restaurant: order.restaurantName, reference: order.id })}</Text>

    <View style={styles.testBanner}><Text style={styles.testBannerTitle}>{t('pay.testTitle')}</Text><Text style={styles.testBannerCopy}>{t('pay.testBody')}</Text></View>

    <Text style={styles.label}>{t('pay.with')}</Text>
    <View accessibilityRole="radiogroup" style={styles.methods}>
      {MOBILE_MONEY.map((option) => {
        const selected = option.method === method;
        return <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} disabled={stage !== 'choose'} key={option.method} onPress={() => setMethod(option.method)} style={[styles.method, selected && styles.methodActive]}>
          <View style={[styles.radio, selected && styles.radioActive]}>{selected && <View style={styles.radioDot} />}</View>
          <Text style={styles.methodLabel}>{option.label}</Text>
        </Pressable>;
      })}
    </View>

    <Text style={styles.label}>{t('pay.number', { method: methodLabel.toUpperCase() })}</Text>
    <TextInput autoComplete="tel" editable={stage === 'choose'} keyboardType="phone-pad" onChangeText={setPayerPhone} placeholder="0712 345 678" style={styles.input} value={payerPhone} />

    <PrimaryButton disabled={stage !== 'choose'} label={stage === 'approving' ? t('pay.approving') : t('pay.button', { amount, method: methodLabel })} onPress={() => void pay()} />
    <Text style={styles.cashNote}>{t('pay.cashNote', { amount })}</Text>
  </ScrollView></SafeAreaView>;
}

function Centered({ children }: { children: React.ReactNode }) {
  return <SafeAreaView style={[styles.safeArea, styles.centered]}><View style={styles.centeredInner}>{children}</View></SafeAreaView>;
}

function PrimaryButton({ disabled, label, onPress }: { disabled?: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button, disabled && styles.disabled]}><Text style={styles.buttonText}>{label}</Text></Pressable>;
}

const styles = themedStyles(({ bg, fg, line }) => ({
  safeArea: { flex: 1, backgroundColor: bg(CREAM) },
  centered: { alignItems: 'center', justifyContent: 'center' },
  centeredInner: { width: '100%', maxWidth: 420, alignItems: 'center', padding: 28 },
  content: { width: '100%', maxWidth: 560, alignSelf: 'center', padding: 20, paddingBottom: 60 },
  back: { color: fg(ORANGE), fontSize: 14, fontWeight: '800', marginBottom: 25 },
  eyebrow: { color: fg(ORANGE), fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: fg('#171612'), fontSize: 30, fontWeight: '900', marginTop: 6, textAlign: 'center' },
  copy: { color: fg('#5F5951'), fontSize: 14, lineHeight: 21, marginTop: 10, textAlign: 'center' },
  copyLeft: { color: fg('#5F5951'), fontSize: 14, lineHeight: 21, marginTop: 6 },
  check: { width: 70, height: 70, borderRadius: 35, overflow: 'hidden', textAlign: 'center', textAlignVertical: 'center', lineHeight: 70, color: fg('#FFF'), backgroundColor: bg('#278653'), fontSize: 38, fontWeight: '900' },
  reference: { color: fg(ORANGE), fontSize: 11, fontWeight: '900', letterSpacing: 1, marginTop: 16 },
  testNote: { color: fg('#8A5A00'), fontSize: 12, marginTop: 8 },
  testBanner: { marginTop: 18, padding: 13, borderRadius: 14, borderWidth: 1, borderColor: line('#EBD9A8'), backgroundColor: bg('#FFF7DE') },
  testBannerTitle: { color: fg('#6B4A00'), fontSize: 12, fontWeight: '900' },
  testBannerCopy: { color: fg('#6B5A30'), fontSize: 12, lineHeight: 17, marginTop: 3 },
  label: { color: fg('#777268'), fontSize: 10, fontWeight: '900', letterSpacing: 0.7, marginTop: 20, marginBottom: 8 },
  methods: { gap: 8 },
  method: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1, borderColor: line('#E9DFD2'), borderRadius: 14, backgroundColor: bg('#FFF') },
  methodActive: { borderColor: line(ORANGE), backgroundColor: bg('#FFF6EF') },
  methodLabel: { color: fg('#171612'), fontSize: 14, fontWeight: '900' },
  radio: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: line('#CFC5B9'), borderRadius: 10 },
  radioActive: { borderColor: line(ORANGE) },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: bg(ORANGE) },
  input: { height: 50, borderWidth: 1, borderColor: line('#E9DFD2'), borderRadius: 14, paddingHorizontal: 15, color: fg('#171612'), backgroundColor: bg('#FFF') },
  button: { alignSelf: 'stretch', minHeight: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, borderRadius: 26, backgroundColor: bg(ORANGE), marginTop: 24 },
  buttonText: { color: fg('#FFF'), fontSize: 13, fontWeight: '900' },
  disabled: { opacity: 0.6 },
  cashNote: { color: fg('#777268'), fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 14 },
}));
