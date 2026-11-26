import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/i18n';

type Props = {
  photos: string[];
  /** The photo to open on, or null when the viewer is closed. */
  startIndex: number | null;
  onClose: () => void;
};

/**
 * Photos shown full screen, one per page: swipe sideways for the next one. "Zoom" opens the photo in
 * the phone's browser, where it can be pinched to read small print on a menu.
 */
export function PhotoViewer({ onClose, photos, startIndex }: Props) {
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState(startIndex ?? 0);
  const open = startIndex !== null && photos.length > 0;
  const shown = Math.min(current, photos.length - 1);

  return <Modal animationType="fade" onRequestClose={onClose} onShow={() => setCurrent(startIndex ?? 0)} transparent={false} visible={open}>
    <View style={styles.backdrop}>
      {open && <FlatList
        data={photos}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        horizontal
        initialScrollIndex={Math.min(startIndex, photos.length - 1)}
        keyExtractor={(url) => url}
        onMomentumScrollEnd={(event) => setCurrent(Math.round(event.nativeEvent.contentOffset.x / width))}
        pagingEnabled
        renderItem={({ item }) => <Image accessibilityIgnoresInvertColors contentFit="contain" source={item} style={{ width, height }} transition={150} />}
        showsHorizontalScrollIndicator={false}
      />}
      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <Text style={styles.counter}>{photos.length > 1 ? t('viewer.counter', { index: shown + 1, total: photos.length }) : ''}</Text>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => void WebBrowser.openBrowserAsync(photos[shown])} style={styles.button}>
            <Text style={styles.buttonText}>{t('viewer.zoom')}</Text>
          </Pressable>
          <Pressable accessibilityLabel={t('viewer.close')} accessibilityRole="button" hitSlop={8} onPress={onClose} style={styles.button}>
            <Text style={styles.buttonText}>✕</Text>
          </Pressable>
        </View>
      </View>
    </View>
  </Modal>;
}

// Always dark, whatever the app theme: photos read best on black.
const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000' },
  topBar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  counter: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 10 },
  button: { minWidth: 44, height: 44, paddingHorizontal: 14, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
  buttonText: { color: '#FFF', fontSize: 15, fontWeight: '900' },
});
