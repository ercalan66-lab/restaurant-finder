import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { router, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { APP_NAME, SUPPORT_EMAIL } from '@/constants/app-info';
import { useSettings, type LanguagePreference, type ThemePreference } from '@/data/settings';
import { showMessage } from '@/utils/feedback';
import { goBackOrReplace } from '@/utils/navigation';

const ORANGE = '#ED6417';
const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

const THEME_OPTIONS: { value: ThemePreference; label: string; hint: string }[] = [
  { value: 'system', label: 'Same as my phone', hint: 'Light or dark, following your phone setting' },
  { value: 'light', label: 'Light', hint: 'Always light' },
  { value: 'dark', label: 'Dark', hint: 'Easier on the eyes at night' },
];
const LANGUAGE_OPTIONS: { value: LanguagePreference; label: string; hint: string }[] = [
  { value: 'en', label: 'English', hint: 'English' },
  { value: 'sw', label: 'Kiswahili', hint: 'Swahili' },
];

const FAQS: { question: string; answer: string }[] = [
  { question: 'How do I order food?', answer: 'Open a restaurant, tap “Order food”, choose your dishes, then pick Pickup or Delivery and send. You can follow the order under Profile → Your activity.' },
  { question: 'How do I book a table?', answer: 'Open a restaurant, tap “Reserve a table”, and choose the date, time and number of guests. The restaurant confirms the booking, and you see the status under Profile.' },
  { question: 'How do I pay?', answer: 'Pickup orders are paid at the restaurant counter. Delivery orders are paid when the food arrives: in the app by mobile money, or in cash to the rider. In-app mobile money is still in test mode, so no real money moves yet.' },
  { question: 'Can I cancel an order or booking?', answer: 'Yes. Orders can be cancelled until the restaurant accepts them, and bookings until they are completed. Open Profile → Your activity and tap Cancel.' },
  { question: 'How do I add my restaurant?', answer: 'Create an account and choose “Restaurant owner”. Then open Profile → Open restaurant dashboard and fill in your details, photos and menu. Kwetu checks every new restaurant before customers can see it.' },
  { question: 'Does Kwetu share my location?', answer: 'No. If you turn on location, it is only used on your phone to show how far restaurants are. It is never sent to Kwetu or stored.' },
];

export default function SettingsScreen() {
  const { settings, update } = useSettings();

  const contact = (subject: string) => {
    if (!SUPPORT_EMAIL) return;
    const body = `\n\n—\n${APP_NAME} ${APP_VERSION} · ${Platform.OS}`;
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`)
      .catch(() => showMessage('No email app found', `Write to ${SUPPORT_EMAIL} from any email app.`));
  };

  return <SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.content}>
    <Pressable accessibilityRole="button" onPress={() => goBackOrReplace('/')}><Text style={styles.back}>‹ Back</Text></Pressable>
    <Text style={styles.eyebrow}>{APP_NAME.toUpperCase()}</Text>
    <Text accessibilityRole="header" style={styles.title}>Settings</Text>

    <Section comingNext="Dark mode is being added to every screen. Your choice is saved and will apply as soon as it is ready." title="Appearance">
      {THEME_OPTIONS.map((option) => <Choice hint={option.hint} key={option.value} label={option.label} onPress={() => update({ theme: option.value })} selected={settings.theme === option.value} />)}
    </Section>

    <Section comingNext="The Kiswahili translation is being added. Your choice is saved and will apply as soon as it is ready." title="Language · Lugha">
      {LANGUAGE_OPTIONS.map((option) => <Choice hint={option.hint} key={option.value} label={option.label} onPress={() => update({ language: option.value })} selected={settings.language === option.value} />)}
    </Section>

    <Section title="Help & support">
      <Text style={styles.groupLabel}>COMMON QUESTIONS</Text>
      {FAQS.map((faq) => <Faq answer={faq.answer} key={faq.question} question={faq.question} />)}

      <Text style={styles.groupLabel}>CONTACT US</Text>
      {SUPPORT_EMAIL
        ? <>
          <LinkRow icon="✉️" label="Email Kwetu support" note={SUPPORT_EMAIL} onPress={() => contact('Help with Kwetu')} />
          <LinkRow icon="⚠️" label="Report a problem" note="Tell us what went wrong" onPress={() => contact('Problem report')} />
        </>
        : <Text style={[styles.muted, styles.cardText]}>Our support contact will be added here soon. Meanwhile, the restaurant’s phone number is on its page for questions about an order or booking.</Text>}

      <Text style={styles.groupLabel}>MORE</Text>
      <LinkRow icon="🔒" label="Privacy policy" note="What we collect and how to delete it" onPress={() => router.push('/privacy' as Href)} />
    </Section>

    <Text style={styles.version}>{APP_NAME} · version {APP_VERSION}</Text>
  </ScrollView></SafeAreaView>;
}

function Section({ children, comingNext, title }: { children: ReactNode; comingNext?: string; title: string }) {
  return <View style={styles.section}>
    <View style={styles.sectionHeading}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>
      {comingNext && <Text style={styles.soon}>COMING NEXT</Text>}
    </View>
    {comingNext && <Text style={styles.muted}>{comingNext}</Text>}
    <View style={styles.card}>{children}</View>
  </View>;
}

function Choice({ hint, label, onPress, selected }: { hint: string; label: string; onPress: () => void; selected: boolean }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={styles.row}>
    <View style={styles.rowCopy}><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowNote}>{hint}</Text></View>
    <View style={[styles.radio, selected && styles.radioOn]}>{selected && <View style={styles.radioDot} />}</View>
  </Pressable>;
}

function Faq({ answer, question }: { answer: string; question: string }) {
  const [open, setOpen] = useState(false);
  return <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((current) => !current)} style={styles.faq}>
    <View style={styles.faqTop}><Text style={styles.rowLabel}>{question}</Text><Text style={styles.chevron}>{open ? '−' : '+'}</Text></View>
    {open && <Text style={styles.answer}>{answer}</Text>}
  </Pressable>;
}

function LinkRow({ icon, label, note, onPress }: { icon: string; label: string; note: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={styles.row}>
    <Text style={styles.icon}>{icon}</Text>
    <View style={styles.rowCopy}><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowNote}>{note}</Text></View>
    <Text style={styles.chevron}>›</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF8ED' },
  content: { width: '100%', maxWidth: 620, alignSelf: 'center', padding: 20, paddingBottom: 60 },
  back: { color: ORANGE, fontSize: 14, fontWeight: '800', marginBottom: 25 },
  eyebrow: { color: ORANGE, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#171612', fontSize: 34, fontWeight: '900', marginTop: 6 },
  section: { marginTop: 28 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { color: '#171612', fontSize: 19, fontWeight: '900' },
  soon: { color: '#6B5A30', backgroundColor: '#FFF1C7', borderRadius: 8, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 3, fontSize: 8, fontWeight: '900' },
  muted: { color: '#777268', fontSize: 12, lineHeight: 18, marginTop: 6 },
  cardText: { paddingHorizontal: 16, paddingBottom: 14 },
  card: { marginTop: 12, borderRadius: 18, borderWidth: 1, borderColor: '#E9DFD2', backgroundColor: '#FFF', overflow: 'hidden' },
  groupLabel: { color: '#8A7164', fontSize: 9, fontWeight: '900', letterSpacing: 0.8, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#F2EAE0' },
  rowCopy: { flex: 1 },
  rowLabel: { flexShrink: 1, color: '#171612', fontSize: 14, fontWeight: '800' },
  rowNote: { color: '#8A8278', fontSize: 11, marginTop: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#CDBFB3', alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: ORANGE },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: ORANGE },
  faq: { paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#F2EAE0' },
  faqTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  answer: { color: '#4F4A43', fontSize: 13, lineHeight: 20, marginTop: 8 },
  chevron: { color: ORANGE, fontSize: 20, fontWeight: '800' },
  icon: { fontSize: 20 },
  version: { color: '#9A9187', fontSize: 11, textAlign: 'center', marginTop: 28 },
});
