import type { ComponentProps, ReactNode } from 'react';
import { Pressable, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { t } from '@/i18n';
import { themedStyles } from '@/theme/theme';

export const OWNER_COLORS = { accent: '#B93F1D', cream: '#FFF8EE', ink: '#271812', muted: '#71675F', line: '#EADFD3' };

type FieldProps = ComponentProps<typeof TextInput> & { label: string; containerStyle?: StyleProp<ViewStyle> };
export function Field({ label, containerStyle, multiline, style, ...props }: FieldProps) {
  return <View style={containerStyle}>
    <Text style={styles.label}>{label}</Text>
    <TextInput {...props} multiline={multiline} placeholderTextColor="#968B82" style={[styles.input, multiline && styles.multiline, style]} />
  </View>;
}

export function PrimaryButton({ busy, busyLabel, disabled, label, onPress }: { busy?: boolean; busyLabel?: string; disabled?: boolean; label: string; onPress: () => void }) {
  const inactive = busy || disabled;
  return <Pressable accessibilityRole="button" accessibilityState={{ busy, disabled: inactive }} disabled={inactive} onPress={onPress} style={[styles.button, inactive && styles.inactive]}>
    <Text style={styles.buttonText}>{busy ? busyLabel ?? t('common.saving') : label}</Text>
  </Pressable>;
}

export function TextButton({ destructive, disabled, label, onPress }: { destructive?: boolean; disabled?: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" disabled={disabled} hitSlop={6} onPress={onPress}>
    <Text style={[styles.textButton, destructive && styles.destructive, disabled && styles.inactive]}>{label}</Text>
  </Pressable>;
}

export function Section({ children, helper, title }: { children: ReactNode; helper?: string; title: string }) {
  return <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {helper ? <Text style={styles.helper}>{helper}</Text> : null}
    {children}
  </View>;
}

export function ChoiceChips<T extends string>({ label, onChange, options, value }: { label: string; onChange: (value: T) => void; options: readonly T[]; value: T }) {
  return <View>
    <Text style={styles.label}>{label}</Text>
    <View accessibilityRole="radiogroup" style={styles.chips}>
      {options.map((option) => {
        const selected = option === value;
        return <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} key={option} onPress={() => onChange(option)} style={[styles.chip, selected && styles.chipActive]}>
          <Text style={[styles.chipText, selected && styles.chipTextActive]}>{option}</Text>
        </Pressable>;
      })}
    </View>
  </View>;
}

export const formStyles = themedStyles(({ fg }) => ({
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  helper: { color: fg(OWNER_COLORS.muted), fontSize: 12, lineHeight: 18, marginTop: 5 },
}));

const styles = themedStyles(({ bg, fg, line }) => ({
  label: { color: fg(OWNER_COLORS.muted), fontSize: 9, fontWeight: '900', letterSpacing: 0.7, marginTop: 15, marginBottom: 6 },
  input: { minHeight: 48, borderWidth: 1, borderColor: line(OWNER_COLORS.line), borderRadius: 13, paddingHorizontal: 13, color: fg(OWNER_COLORS.ink), backgroundColor: bg('#FFF') },
  multiline: { minHeight: 82, paddingTop: 13, textAlignVertical: 'top' },
  button: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 25, backgroundColor: bg(OWNER_COLORS.accent), marginTop: 18, paddingHorizontal: 18 },
  buttonText: { color: fg('#FFF'), fontSize: 13, fontWeight: '900' },
  inactive: { opacity: 0.55 },
  textButton: { color: fg(OWNER_COLORS.accent), fontSize: 11, fontWeight: '800', paddingVertical: 4 },
  destructive: { color: fg('#9B321C') },
  section: { marginTop: 22, padding: 17, borderWidth: 1, borderColor: line(OWNER_COLORS.line), borderRadius: 22, backgroundColor: bg('#FFFDF9') },
  sectionTitle: { color: fg(OWNER_COLORS.ink), fontSize: 20, fontWeight: '900' },
  helper: { color: fg(OWNER_COLORS.muted), fontSize: 12, lineHeight: 18, marginTop: 5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 13, paddingVertical: 9, borderWidth: 1, borderColor: line(OWNER_COLORS.line), borderRadius: 20, backgroundColor: bg('#FFF') },
  chipActive: { borderColor: line(OWNER_COLORS.accent), backgroundColor: bg(OWNER_COLORS.accent) },
  chipText: { color: fg('#4F4A43'), fontSize: 11, fontWeight: '800' },
  chipTextActive: { color: fg('#FFF') },
}));
