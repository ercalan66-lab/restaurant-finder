import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { router, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { APP_NAME, SUPPORT_EMAIL } from '@/constants/app-info';
import { useSettings, type LanguagePreference, type ThemePreference } from '@/data/settings';
import { t, type MessageKey } from '@/i18n';
import { showMessage } from '@/utils/feedback';
import { goBackOrReplace } from '@/utils/navigation';
import { themedStyles } from '@/theme/theme';

const ORANGE = '#ED6417';
const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

const THEME_OPTIONS: { value: ThemePreference; label: MessageKey; hint: MessageKey }[] = [
  { value: 'system', label: 'settings.theme.system', hint: 'settings.theme.systemHint' },
  { value: 'light', label: 'settings.theme.light', hint: 'settings.theme.lightHint' },
  { value: 'dark', label: 'settings.theme.dark', hint: 'settings.theme.darkHint' },
];
// Each language is named in its own words, so it can be found whichever language is showing.
const LANGUAGE_OPTIONS: { value: LanguagePreference; label: string; hint: MessageKey }[] = [
  { value: 'en', label: 'English', hint: 'settings.lang.enHint' },
  { value: 'sw', label: 'Kiswahili', hint: 'settings.lang.swHint' },
];

const FAQS = ['order', 'pay', 'cancel', 'secure', 'owner', 'location'] as const;

export default function SettingsScreen() {
  const { settings, update } = useSettings();

  const contact = (subject: string) => {
    if (!SUPPORT_EMAIL) return;
    const body = `\n\n—\n${APP_NAME} ${APP_VERSION} · ${Platform.OS}`;
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`)
      .catch(() => showMessage(t('settings.noEmailApp'), t('settings.noEmailAppBody', { email: SUPPORT_EMAIL })));
  };

  return <SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.content}>
    <Pressable accessibilityRole="button" onPress={() => goBackOrReplace('/')}><Text style={styles.back}>{t('common.back')}</Text></Pressable>
    <Text style={styles.eyebrow}>{APP_NAME.toUpperCase()}</Text>
    <Text accessibilityRole="header" style={styles.title}>{t('settings.title')}</Text>

    <Section title={t('settings.account')}>
      <LinkRow icon="👤" label={t('settings.profile')} note={t('settings.profileNote')} onPress={() => router.push('/profile' as Href)} />
    </Section>

    <Section title={t('settings.appearance')}>
      {THEME_OPTIONS.map((option) => <Choice hint={t(option.hint)} key={option.value} label={t(option.label)} onPress={() => update({ theme: option.value })} selected={settings.theme === option.value} />)}
    </Section>

    <Section title={t('settings.language')}>
      {LANGUAGE_OPTIONS.map((option) => <Choice hint={t(option.hint)} key={option.value} label={option.label} onPress={() => update({ language: option.value })} selected={settings.language === option.value} />)}
    </Section>

    <Section title={t('settings.help')}>
      <Text style={styles.groupLabel}>{t('settings.commonQuestions')}</Text>
      {FAQS.map((faq) => <Faq answer={t(`settings.faq.${faq}.a`)} key={faq} question={t(`settings.faq.${faq}.q`)} />)}

      <Text style={styles.groupLabel}>{t('settings.contact')}</Text>
      {SUPPORT_EMAIL
        ? <>
          <LinkRow icon="✉️" label={t('settings.emailSupport')} note={SUPPORT_EMAIL} onPress={() => contact(t('settings.emailSubjectHelp'))} />
          <LinkRow icon="⚠️" label={t('settings.reportProblem')} note={t('settings.reportProblemNote')} onPress={() => contact(t('settings.emailSubjectProblem'))} />
        </>
        : <Text style={[styles.muted, styles.cardText]}>{t('settings.noContact')}</Text>}

      <Text style={styles.groupLabel}>{t('settings.more')}</Text>
      <LinkRow icon="🔒" label={t('settings.privacy')} note={t('settings.privacyNote')} onPress={() => router.push('/privacy' as Href)} />
    </Section>

    <Text style={styles.version}>{t('settings.version', { app: APP_NAME, version: APP_VERSION })}</Text>
  </ScrollView></SafeAreaView>;
}

function Section({ children, title }: { children: ReactNode; title: string }) {
  return <View style={styles.section}>
    <Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>
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

const styles = themedStyles(({ bg, fg, line }) => ({
  safeArea: { flex: 1, backgroundColor: bg('#FFF8ED') },
  content: { width: '100%', maxWidth: 620, alignSelf: 'center', padding: 20, paddingBottom: 60 },
  back: { color: fg(ORANGE), fontSize: 14, fontWeight: '800', marginBottom: 25 },
  eyebrow: { color: fg(ORANGE), fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: fg('#171612'), fontSize: 34, fontWeight: '900', marginTop: 6 },
  section: { marginTop: 28 },
  sectionTitle: { color: fg('#171612'), fontSize: 19, fontWeight: '900' },
  muted: { color: fg('#777268'), fontSize: 12, lineHeight: 18, marginTop: 6 },
  cardText: { paddingHorizontal: 16, paddingBottom: 14 },
  card: { marginTop: 12, borderRadius: 18, borderWidth: 1, borderColor: line('#E9DFD2'), backgroundColor: bg('#FFF'), overflow: 'hidden' },
  groupLabel: { color: fg('#8A7164'), fontSize: 9, fontWeight: '900', letterSpacing: 0.8, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: line('#F2EAE0') },
  rowCopy: { flex: 1 },
  rowLabel: { flexShrink: 1, color: fg('#171612'), fontSize: 14, fontWeight: '800' },
  rowNote: { color: fg('#8A8278'), fontSize: 11, marginTop: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: line('#CDBFB3'), alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: line(ORANGE) },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: bg(ORANGE) },
  faq: { paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: line('#F2EAE0') },
  faqTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  answer: { color: fg('#4F4A43'), fontSize: 13, lineHeight: 20, marginTop: 8 },
  chevron: { color: fg(ORANGE), fontSize: 20, fontWeight: '800' },
  icon: { fontSize: 20 },
  version: { color: fg('#9A9187'), fontSize: 11, textAlign: 'center', marginTop: 28 },
}));
