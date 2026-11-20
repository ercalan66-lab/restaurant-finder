import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ACTIVE = '#ED6417';
const INACTIVE = '#5E574F';

type SymbolName = Extract<SymbolViewProps['name'], object>;

export type NavItem = {
  label: string;
  /** iOS shows the filled symbol for the selected tab; Android and web use Material Symbols. */
  icon: { ios: NonNullable<SymbolName['ios']>; iosSelected: NonNullable<SymbolName['ios']>; android: NonNullable<SymbolName['android']> };
  active: boolean;
  onPress: () => void;
};

/** The home screen's tab bar: large icons, clear labels, and a highlighted pill for the current tab. */
export function BottomNav({ items }: { items: NavItem[] }) {
  const insets = useSafeAreaInsets();
  return <View accessibilityRole="tablist" style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
    {items.map((item) => <Pressable
      accessibilityLabel={item.label}
      accessibilityRole="tab"
      accessibilityState={{ selected: item.active }}
      key={item.label}
      onPress={item.onPress}
      style={styles.item}>
      <View style={[styles.pill, item.active && styles.pillActive]}>
        <SymbolView
          name={{ ios: item.active ? item.icon.iosSelected : item.icon.ios, android: item.icon.android, web: item.icon.android }}
          size={24}
          tintColor={item.active ? ACTIVE : INACTIVE}
        />
      </View>
      <Text style={[styles.label, item.active && styles.labelActive]}>{item.label}</Text>
    </Pressable>)}
  </View>;
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', paddingTop: 8, paddingHorizontal: 12,
    backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#EFE6DA',
    shadowColor: '#3B2A1A', shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: -3 }, elevation: 12,
  },
  item: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 2 },
  pill: { width: 60, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  pillActive: { backgroundColor: '#FFE8D9' },
  label: { color: INACTIVE, fontSize: 12, fontWeight: '700' },
  labelActive: { color: ACTIVE, fontWeight: '900' },
});
