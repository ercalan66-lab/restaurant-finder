import { router, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { AuthMethod } from '@/data/auth';
import { goBackOrReplace } from '@/utils/navigation';

export const ACCENT = '#B93F1D';

export function AuthShell({ children, subtitle, title }: { children: ReactNode; subtitle: string; title: string }) {
  return <SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Pressable accessibilityRole="button" onPress={() => goBackOrReplace('/profile')}><Text style={styles.back}>‹ Back</Text></Pressable>
    <Text style={styles.eyebrow}>KWETU ACCOUNT</Text>
    <Text accessibilityRole="header" style={styles.title}>{title}</Text>
    <Text style={styles.subtitle}>{subtitle}</Text>
    {children}
    <Pressable accessibilityRole="link" onPress={() => router.push('/privacy' as Href)}>
      <Text style={styles.privacy}>By continuing you agree to Kwetu&apos;s <Text style={styles.privacyLink}>privacy policy</Text>.</Text>
    </Pressable>
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

export const METHOD_OPTIONS: { value: AuthMethod; label: string }[] = [{ value: 'email', label: 'Email' }, { value: 'phone', label: 'Phone' }];

export function Field({ label, ...input }: TextInputProps & { label: string }) {
  return <>
    <Text style={styles.label}>{label}</Text>
    <TextInput placeholderTextColor="#B5A99F" style={styles.input} {...input} />
  </>;
}

export function PasswordField({ label, ...input }: Omit<TextInputProps, 'secureTextEntry'> & { label: string }) {
  const [visible, setVisible] = useState(false);
  return <>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.passwordRow}>
      <TextInput autoCapitalize="none" autoCorrect={false} placeholderTextColor="#B5A99F" secureTextEntry={!visible} style={styles.passwordInput} {...input} />
      <Pressable accessibilityLabel={visible ? 'Hide password' : 'Show password'} accessibilityRole="button" onPress={() => setVisible((current) => !current)} style={styles.showButton}>
        <Text style={styles.showText}>{visible ? 'Hide' : 'Show'}</Text>
      </Pressable>
    </View>
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

export function Notice({ children, title }: { children: ReactNode; title: string }) {
  return <View accessibilityRole="alert" style={styles.notice}>
    <Text style={styles.noticeTitle}>{title}</Text>
    <Text style={styles.noticeCopy}>{children}</Text>
  </View>;
}

type CodeStepProps = { code: string; loading: boolean; onChangeCode: (code: string) => void; onChangeNumber: () => void; onResend: () => void; onVerify: () => void; phone: string };

/** Second step of phone sign-in and sign-up: type the code from the SMS. */
export function PhoneCodeStep({ code, loading, onChangeCode, onChangeNumber, onResend, onVerify, phone }: CodeStepProps) {
  return <>
    <Text style={styles.codeHint}>Enter the code we sent by SMS to <Text style={styles.codePhone}>{phone}</Text>.</Text>
    <Text style={styles.label}>VERIFICATION CODE</Text>
    <TextInput
      autoComplete="one-time-code"
      autoFocus
      editable={!loading}
      keyboardType="number-pad"
      maxLength={10}
      onChangeText={(value) => onChangeCode(value.replace(/\D/g, ''))}
      onSubmitEditing={onVerify}
      placeholder="••••••"
      placeholderTextColor="#CDBFB3"
      style={[styles.input, styles.codeInput]}
      textContentType="oneTimeCode"
      value={code}
    />
    <View style={styles.codeLinks}>
      <TextLink disabled={loading} label="Resend code" onPress={onResend} />
      <TextLink disabled={loading} label="Use a different number" onPress={onChangeNumber} />
    </View>
    <PrimaryButton label="Verify and continue" loading={loading} onPress={onVerify} />
  </>;
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
  passwordRow: { height: 50, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#EADFD3', borderRadius: 14, backgroundColor: '#FFF' },
  passwordInput: { flex: 1, height: 48, paddingHorizontal: 15, color: '#271812' },
  showButton: { height: 48, justifyContent: 'center', paddingHorizontal: 15 },
  showText: { color: ACCENT, fontSize: 11, fontWeight: '900' },
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
  noticeTitle: { color: '#1F5E3D', fontSize: 14, fontWeight: '900' },
  noticeCopy: { color: '#28734D', fontSize: 12, lineHeight: 18, marginTop: 4 },
  helper: { color: '#8A7F76', fontSize: 11, lineHeight: 16, marginTop: 8 },
  codeHint: { color: '#71675F', fontSize: 13, lineHeight: 20, marginTop: 18 },
  codePhone: { color: '#271812', fontWeight: '900' },
  codeInput: { fontSize: 22, fontWeight: '900', letterSpacing: 6, textAlign: 'center' },
  codeLinks: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  privacy: { color: '#8A7F76', fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 22 },
  privacyLink: { color: ACCENT, fontWeight: '800', textDecorationLine: 'underline' },
});

export const authStyles = styles;
