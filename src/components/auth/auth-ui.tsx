import { router, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { goBackOrReplace } from '@/utils/navigation';

export const ACCENT = '#B93F1D';
const ERROR = '#B3261E';

/** Page frame for sign-in and registration. `privacyNote` adds the "By continuing you agree…" line. */
export function AuthShell({ children, privacyNote = true, subtitle, title }: { children: ReactNode; privacyNote?: boolean; subtitle: string; title: string }) {
  return <SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Pressable accessibilityRole="button" onPress={() => goBackOrReplace('/profile')}><Text style={styles.back}>‹ Back</Text></Pressable>
    <Text style={styles.eyebrow}>KWETU ACCOUNT</Text>
    <Text accessibilityRole="header" style={styles.title}>{title}</Text>
    <Text style={styles.subtitle}>{subtitle}</Text>
    {children}
    {privacyNote && <Pressable accessibilityRole="link" onPress={() => router.push('/privacy' as Href)}>
      <Text style={styles.privacy}>By continuing you agree to Kwetu&apos;s <Text style={styles.privacyLink}>privacy policy</Text>.</Text>
    </Pressable>}
  </ScrollView></SafeAreaView>;
}

export function Segmented<T extends string>({ disabled, onChange, options, value }: { disabled?: boolean; onChange: (value: T) => void; options: { value: T; label: string }[]; value: T }) {
  return <View accessibilityRole="tablist" style={styles.segmented}>
    {options.map((option) => <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: value === option.value }}
      disabled={disabled}
      key={option.value}
      onPress={() => onChange(option.value)}
      style={[styles.segment, value === option.value && styles.segmentActive]}>
      <Text style={[styles.segmentText, value === option.value && styles.segmentTextActive]}>{option.label}</Text>
    </Pressable>)}
  </View>;
}

/** A red message under a field, or a grey hint when there is no problem. */
function FieldNote({ error, hint }: { error?: string; hint?: string }) {
  if (error) return <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>;
  return hint ? <Text style={styles.helper}>{hint}</Text> : null;
}

type FieldExtras = { label: string; error?: string; hint?: string };

export function Field({ error, hint, label, ...input }: TextInputProps & FieldExtras) {
  return <>
    <Text style={styles.label}>{label}</Text>
    <TextInput accessibilityLabel={label} placeholderTextColor="#B5A99F" style={[styles.input, error && styles.inputError]} {...input} />
    <FieldNote error={error} hint={hint} />
  </>;
}

export function PasswordField({ error, hint, label, ...input }: Omit<TextInputProps, 'secureTextEntry'> & FieldExtras) {
  const [visible, setVisible] = useState(false);
  return <>
    <Text style={styles.label}>{label}</Text>
    <View style={[styles.passwordRow, error && styles.inputError]}>
      <TextInput accessibilityLabel={label} autoCapitalize="none" autoCorrect={false} placeholderTextColor="#B5A99F" secureTextEntry={!visible} style={styles.passwordInput} {...input} />
      <Pressable accessibilityLabel={visible ? 'Hide password' : 'Show password'} accessibilityRole="button" onPress={() => setVisible((current) => !current)} style={styles.showButton}>
        <Text style={styles.showText}>{visible ? 'Hide' : 'Show'}</Text>
      </Pressable>
    </View>
    <FieldNote error={error} hint={hint} />
  </>;
}

/** A tick box with its label; the label can contain links. */
export function Checkbox({ checked, children, error, onChange }: { checked: boolean; children: ReactNode; error?: string; onChange: (checked: boolean) => void }) {
  return <>
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} hitSlop={6} onPress={() => onChange(!checked)} style={styles.checkRow}>
      <View style={[styles.checkBox, checked && styles.checkBoxOn, error && !checked && styles.inputError]}>{checked && <Text style={styles.checkMark}>✓</Text>}</View>
      <Text style={styles.checkLabel}>{children}</Text>
    </Pressable>
    <FieldNote error={error} />
  </>;
}

export function PrimaryButton({ disabled, label, loading, onPress }: { disabled?: boolean; label: string; loading?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ busy: loading, disabled: disabled || loading }} disabled={disabled || loading} onPress={onPress} style={[styles.button, (disabled || loading) && styles.disabled]}>
    {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>{label}</Text>}
  </Pressable>;
}

export function TextLink({ align = 'left', disabled, label, onPress }: { align?: 'left' | 'right' | 'center'; disabled?: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.textLink, align === 'right' && styles.alignRight, align === 'center' && styles.alignCenter]}>
    <Text style={styles.textLinkText}>{label}</Text>
  </Pressable>;
}

/** "New to Kwetu? Create account" under the main button. */
export function SwitchPrompt({ action, disabled, onPress, question }: { action: string; disabled?: boolean; onPress: () => void; question: string }) {
  return <View style={styles.switchRow}>
    <Text style={styles.switchCopy}>{question}</Text>
    <Pressable accessibilityRole="link" disabled={disabled} onPress={onPress}><Text style={styles.switchLink}>{action}</Text></Pressable>
  </View>;
}

export function Notice({ children, title, tone = 'success' }: { children: ReactNode; title: string; tone?: 'success' | 'error' }) {
  return <View accessibilityRole="alert" style={[styles.notice, tone === 'error' && styles.noticeError]}>
    <Text style={[styles.noticeTitle, tone === 'error' && styles.noticeTitleError]}>{title}</Text>
    <Text style={[styles.noticeCopy, tone === 'error' && styles.noticeCopyError]}>{children}</Text>
  </View>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF8EE' },
  content: { width: '100%', maxWidth: 520, alignSelf: 'center', padding: 22, paddingBottom: 60 },
  back: { color: ACCENT, fontSize: 14, fontWeight: '800', marginBottom: 28 },
  eyebrow: { color: ACCENT, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#271812', fontSize: 34, fontWeight: '900', marginTop: 6 },
  subtitle: { color: '#71675F', fontSize: 14, lineHeight: 21, marginTop: 7, marginBottom: 20 },
  segmented: { flexDirection: 'row', padding: 4, borderRadius: 16, backgroundColor: '#F4EAE1', marginBottom: 4 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 12 },
  segmentActive: { backgroundColor: '#FFF' },
  segmentText: { color: '#7B7068', fontSize: 12, fontWeight: '800' },
  segmentTextActive: { color: ACCENT },
  label: { color: '#71675F', fontSize: 9, fontWeight: '900', letterSpacing: 0.8, marginTop: 16, marginBottom: 7 },
  input: { height: 50, borderWidth: 1, borderColor: '#EADFD3', borderRadius: 14, paddingHorizontal: 15, color: '#271812', backgroundColor: '#FFF' },
  inputError: { borderColor: ERROR, borderWidth: 1.5 },
  passwordRow: { height: 50, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#EADFD3', borderRadius: 14, backgroundColor: '#FFF' },
  passwordInput: { flex: 1, height: 48, paddingHorizontal: 15, color: '#271812' },
  showButton: { height: 48, justifyContent: 'center', paddingHorizontal: 15 },
  showText: { color: ACCENT, fontSize: 11, fontWeight: '900' },
  error: { color: ERROR, fontSize: 11, fontWeight: '700', lineHeight: 16, marginTop: 6 },
  helper: { color: '#8A7F76', fontSize: 11, lineHeight: 16, marginTop: 6 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20 },
  checkBox: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: '#CDBFB3', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' },
  checkBoxOn: { borderColor: ACCENT, backgroundColor: ACCENT },
  checkMark: { color: '#FFF', fontSize: 14, fontWeight: '900', lineHeight: 16 },
  checkLabel: { flex: 1, color: '#4E453F', fontSize: 13, lineHeight: 19 },
  button: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 26, backgroundColor: ACCENT, marginTop: 24 },
  buttonText: { color: '#FFF', fontSize: 13, fontWeight: '900' },
  disabled: { opacity: 0.6 },
  textLink: { paddingVertical: 8 },
  textLinkText: { color: ACCENT, fontSize: 12, fontWeight: '800' },
  alignRight: { alignSelf: 'flex-end' },
  alignCenter: { alignSelf: 'center' },
  switchRow: { flexDirection: 'row', justifyContent: 'center', gap: 7, marginTop: 22 },
  switchCopy: { color: '#71675F', fontSize: 12 },
  switchLink: { color: ACCENT, fontSize: 12, fontWeight: '900' },
  notice: { marginTop: 18, padding: 14, borderRadius: 14, backgroundColor: '#E8F5ED' },
  noticeError: { backgroundColor: '#FBE5DF' },
  noticeTitle: { color: '#1F5E3D', fontSize: 14, fontWeight: '900' },
  noticeTitleError: { color: '#8E2F1A' },
  noticeCopy: { color: '#28734D', fontSize: 12, lineHeight: 18, marginTop: 4 },
  noticeCopyError: { color: '#8E2F1A' },
  privacy: { color: '#8A7F76', fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 22 },
  privacyLink: { color: ACCENT, fontWeight: '800', textDecorationLine: 'underline' },
});

export const authStyles = styles;
