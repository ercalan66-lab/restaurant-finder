import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { PhotoViewer } from '@/components/photo-viewer';
import { updateRestaurant } from '@/data/owner-restaurant';
import { pickPhotos, removeRestaurantPhoto, uploadRestaurantPhotos, type PhotoFolder } from '@/data/restaurant-photos';
import type { Restaurant } from '@/data/restaurants';
import { t } from '@/i18n';
import { confirmAction, errorMessage, showMessage } from '@/utils/feedback';

import { OWNER_COLORS } from './form-controls';
import { themedStyles } from '@/theme/theme';

type ListField = 'galleryUrls' | 'menuPhotoUrls';

type Props = {
  restaurant: Restaurant;
  field: ListField;
  folder: PhotoFolder;
  max: number;
  onUpdated: (changes: Partial<Pick<Restaurant, ListField>>) => void;
  /** Big button text, e.g. "Add menu photos". */
  addLabel: string;
  /** Confirmation shown before a photo is removed. */
  removeTitle: string;
  removeBody: string;
  /** Menu pages are upright (3:4); photos of the place are wide (4:3). */
  shape: 'upright' | 'wide';
};

/**
 * A row of photos with a big "add" button. Owners can take a photo or pick several from their phone
 * at once; each is uploaded in turn with a "2 of 5" progress line. Tapping a photo shows it full size.
 */
export function PhotoStrip({ addLabel, field, folder, max, onUpdated, removeBody, removeTitle, restaurant, shape }: Props) {
  const [progress, setProgress] = useState<string | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const urls = restaurant[field];
  const room = max - urls.length;
  const busy = progress !== null;
  const changeTo = (next: string[]) => (field === 'galleryUrls' ? { galleryUrls: next } : { menuPhotoUrls: next });

  const add = async () => {
    if (room <= 0) return showMessage(t('photos.fullTitle'), t('photos.fullBody', { max }));
    const assets = await pickPhotos({ max: room });
    if (assets.length === 0) return;
    setProgress(t('photos.uploadingCount', { done: 1, total: assets.length }));
    let uploaded: string[] = [];
    try {
      uploaded = await uploadRestaurantPhotos(restaurant.id, assets, folder, (done, total) => setProgress(t('photos.uploadingCount', { done: done + 1, total })));
      const changes = changeTo([...urls, ...uploaded]);
      await updateRestaurant(restaurant.id, changes);
      onUpdated(changes);
    } catch (error) {
      await Promise.all(uploaded.map((url) => removeRestaurantPhoto(url)));
      showMessage(t('photos.uploadFailed'), errorMessage(error));
    } finally {
      setProgress(null);
    }
  };

  const remove = (url: string) => confirmAction(removeTitle, removeBody, t('menu.remove'), () => {
    const changes = changeTo(urls.filter((item) => item !== url));
    updateRestaurant(restaurant.id, changes)
      .then(() => { onUpdated(changes); void removeRestaurantPhoto(url); })
      .catch((error: unknown) => showMessage(t('photos.removeFailed'), errorMessage(error)));
  });

  const thumbStyle = shape === 'upright' ? styles.upright : styles.wide;
  return <View>
    <Text style={styles.count}>{t('photos.count', { count: urls.length, max })}</Text>
    {urls.length > 0 && <ScrollView contentContainerStyle={styles.strip} horizontal showsHorizontalScrollIndicator={false}>
      {urls.map((url, index) => <View key={url}>
        <Pressable accessibilityLabel={t('photos.view')} accessibilityRole="imagebutton" onPress={() => setViewing(index)}>
          <Image contentFit="cover" source={url} style={thumbStyle} transition={200} />
        </Pressable>
        <Pressable accessibilityLabel={t('photos.removeOne')} accessibilityRole="button" disabled={busy} hitSlop={8} onPress={() => remove(url)} style={styles.removeBadge}>
          <Text style={styles.removeText}>×</Text>
        </Pressable>
      </View>)}
    </ScrollView>}
    {room > 0 && <Pressable accessibilityRole="button" accessibilityState={{ busy, disabled: busy }} disabled={busy} onPress={() => void add()} style={[styles.addButton, busy && styles.inactive]}>
      <Text style={styles.addIcon}>{busy ? '⏳' : '📷'}</Text>
      <View style={styles.addCopy}>
        <Text style={styles.addLabel}>{progress ?? addLabel}</Text>
        {!busy && <Text style={styles.addHint}>{t('photos.addHint', { room })}</Text>}
      </View>
    </Pressable>}
    <PhotoViewer onClose={() => setViewing(null)} photos={urls} startIndex={viewing} />
  </View>;
}

const styles = themedStyles(({ bg, fg, line }) => ({
  count: { color: fg(OWNER_COLORS.muted), fontSize: 9, fontWeight: '900', letterSpacing: 0.7, marginTop: 16, marginBottom: 8 },
  strip: { gap: 10, paddingTop: 6, paddingRight: 6, paddingBottom: 4 },
  wide: { width: 132, height: 99, borderRadius: 14, backgroundColor: bg('#E9DFD3') },
  upright: { width: 96, height: 128, borderRadius: 12, backgroundColor: bg('#E9DFD3') },
  removeBadge: { position: 'absolute', top: -6, right: -6, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: bg(OWNER_COLORS.ink) },
  removeText: { color: fg('#FFF'), fontSize: 18, lineHeight: 20, fontWeight: '900' },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 72, marginTop: 12, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 18, borderWidth: 1.5, borderStyle: 'dashed', borderColor: line(OWNER_COLORS.accent), backgroundColor: bg('#FFF') },
  addIcon: { fontSize: 28 },
  addCopy: { flex: 1 },
  addLabel: { color: fg(OWNER_COLORS.accent), fontSize: 15, fontWeight: '900' },
  addHint: { color: fg(OWNER_COLORS.muted), fontSize: 11, lineHeight: 16, marginTop: 2 },
  inactive: { opacity: 0.6 },
}));
