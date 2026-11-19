import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export const ACCENT = '#B93F1D';

export type AdminSection = 'overview' | 'restaurants' | 'requests' | 'team';

/** Loading state shared by the admin sections. */
export type Loadable<T> = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; value: T };

export const formatMoney = (amount: number) => `TSh ${amount.toLocaleString()}`;

export function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function SectionHeading({ helper, loading, onRefresh, title }: { helper?: string; loading?: boolean; onRefresh?: () => void; title: string }) {
  return <View style={adminStyles.headingRow}>
    <View style={adminStyles.headingCopy}>
      <Text style={adminStyles.sectionTitle}>{title}</Text>
      {helper ? <Text style={adminStyles.helper}>{helper}</Text> : null}
    </View>
    {onRefresh && <Pressable accessibilityRole="button" disabled={loading} onPress={onRefresh}><Text style={adminStyles.refresh}>{loading ? 'Loading…' : 'Refresh'}</Text></Pressable>}
  </View>;
}

export function Chips<T extends string>({ onChange, options, value }: { onChange: (value: T) => void; options: { value: T; label: string }[]; value: T }) {
  return <View style={adminStyles.chips}>
    {options.map((option) => <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: value === option.value }}
      key={option.value}
      onPress={() => onChange(option.value)}
      style={[adminStyles.chip, value === option.value && adminStyles.chipActive]}>
      <Text style={[adminStyles.chipText, value === option.value && adminStyles.chipTextActive]}>{option.label}</Text>
    </Pressable>)}
  </View>;
}

export function SearchField({ onChangeText, onSubmit, placeholder, value }: { onChangeText: (text: string) => void; onSubmit?: () => void; placeholder: string; value: string }) {
  return <TextInput
    autoCapitalize="none"
    autoCorrect={false}
    clearButtonMode="while-editing"
    onChangeText={onChangeText}
    onSubmitEditing={onSubmit}
    placeholder={placeholder}
    returnKeyType="search"
    style={[adminStyles.input, adminStyles.search]}
    value={value}
  />;
}

export function Action({ disabled, label, onPress, secondary }: { disabled?: boolean; label: string; onPress: () => void; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[adminStyles.action, secondary && adminStyles.actionSecondary, disabled && adminStyles.disabled]}>
    <Text style={[adminStyles.actionText, secondary && adminStyles.actionSecondaryText]}>{label}</Text>
  </Pressable>;
}

export function Badge({ attention, label }: { attention?: boolean; label: string }) {
  return <Text style={[adminStyles.badge, attention && adminStyles.badgeAttention]}>{label}</Text>;
}

export function Empty({ copy, title }: { copy: string; title: string }) {
  return <View style={adminStyles.empty}><Text style={adminStyles.emptyTitle}>{title}</Text><Text style={[adminStyles.helper, adminStyles.center]}>{copy}</Text></View>;
}

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <View style={adminStyles.empty}>
    <Text style={adminStyles.emptyTitle}>Could not load this</Text>
    <Text style={[adminStyles.helper, adminStyles.center]}>{message}</Text>
    <Pressable accessibilityRole="button" onPress={onRetry}><Text style={adminStyles.link}>Try again</Text></Pressable>
  </View>;
}

export const adminStyles = StyleSheet.create({
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginTop: 22 },
  headingCopy: { flex: 1 },
  sectionTitle: { color: '#271812', fontSize: 22, fontWeight: '900' },
  helper: { color: '#71675F', fontSize: 13, lineHeight: 19, marginTop: 6 },
  center: { textAlign: 'center' },
  refresh: { color: ACCENT, fontSize: 12, fontWeight: '900', paddingVertical: 6 },
  link: { color: ACCENT, fontSize: 12, fontWeight: '800', marginTop: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 4, borderRadius: 16, backgroundColor: '#F4EAE1', marginTop: 16 },
  chip: { flexGrow: 1, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8, borderRadius: 12 },
  chipActive: { backgroundColor: '#FFF' },
  chipText: { color: '#7B7068', fontSize: 11, fontWeight: '800' },
  chipTextActive: { color: ACCENT },
  card: { marginTop: 12, padding: 16, borderWidth: 1, borderColor: '#EADFD3', borderRadius: 18, backgroundColor: '#FFF' },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardCopy: { flex: 1 },
  eyebrow: { color: ACCENT, fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  name: { color: '#271812', fontSize: 17, fontWeight: '900', marginTop: 2 },
  meta: { color: '#71675F', fontSize: 12, lineHeight: 18, marginTop: 4 },
  label: { color: '#71675F', fontSize: 9, fontWeight: '900', letterSpacing: 0.7, marginTop: 14, marginBottom: 6 },
  input: { minHeight: 46, borderWidth: 1, borderColor: '#EADFD3', borderRadius: 12, paddingHorizontal: 12, color: '#271812', backgroundColor: '#FFF' },
  search: { marginTop: 14 },
  multiline: { minHeight: 76, paddingTop: 12, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  action: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 20, backgroundColor: ACCENT },
  actionSecondary: { borderWidth: 1, borderColor: '#D9C8BC', backgroundColor: '#FFF' },
  actionText: { color: '#FFF', fontSize: 11, fontWeight: '900' },
  actionSecondaryText: { color: '#8E2F1A' },
  disabled: { opacity: 0.55 },
  badge: { color: '#28734D', backgroundColor: '#E8F5ED', borderRadius: 9, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 4, fontSize: 8, fontWeight: '900' },
  badgeAttention: { color: '#8E2F1A', backgroundColor: '#F5D8D1' },
  empty: { alignItems: 'center', padding: 26, marginTop: 14, borderRadius: 16, backgroundColor: '#FFF' },
  emptyTitle: { color: '#271812', fontSize: 16, fontWeight: '900' },
});
