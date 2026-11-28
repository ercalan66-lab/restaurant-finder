import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useDashboardDb } from '@/data/dashboard-db';
import { updateRestaurant } from '@/data/owner-restaurant';
import { pickPhoto, removeRestaurantPhoto, uploadRestaurantPhoto } from '@/data/restaurant-photos';
import type { Restaurant } from '@/data/restaurants';
import { t } from '@/i18n';
import { errorMessage, showMessage } from '@/utils/feedback';

import { OWNER_COLORS, Section } from './form-controls';
import { PhotoStrip } from './photo-strip';
import { themedStyles } from '@/theme/theme';

const MAX_PLACE_PHOTOS = 8;
type PhotoChanges = Partial<Pick<Restaurant, 'coverUrl' | 'galleryUrls'>>;

/** The main photo (shown in search) and photos of the restaurant itself, inside and outside. */
export function PhotoManager({ onUpdated, restaurant }: { onUpdated: (changes: PhotoChanges) => void; restaurant: Restaurant }) {
  const db = useDashboardDb();
  const [busy, setBusy] = useState(false);

  const changeCover = async () => {
    const asset = await pickPhoto([16, 9]);
    if (!asset) return;
    const previous = restaurant.coverUrl;
    setBusy(true);
    let uploaded: string | null = null;
    try {
      uploaded = await uploadRestaurantPhoto(restaurant.id, asset, 'cover', db);
      await updateRestaurant(restaurant.id, { coverUrl: uploaded }, db);
      onUpdated({ coverUrl: uploaded });
      void removeRestaurantPhoto(previous, db);
    } catch (error) {
      void removeRestaurantPhoto(uploaded, db);
      showMessage(t('photos.uploadFailed'), errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return <>
    <Section helper={t('photos.coverHelper')} title={t('photos.coverTitle')}>
      <Pressable accessibilityLabel={t(restaurant.coverUrl ? 'photos.changeCover' : 'photos.addCover')} accessibilityRole="button" disabled={busy} onPress={() => void changeCover()} style={styles.coverWrap}>
        {restaurant.coverUrl
          ? <Image accessibilityLabel={t('photos.coverA11y')} contentFit="cover" source={restaurant.coverUrl} style={styles.cover} transition={200} />
          : <View style={[styles.cover, styles.placeholder]}><Text style={styles.placeholderIcon}>📷</Text><Text style={styles.placeholderText}>{t('photos.addCover')}</Text></View>}
        <Text style={styles.coverAction}>{t(busy ? 'common.uploading' : restaurant.coverUrl ? 'photos.changeCover' : 'photos.tapToAdd')}</Text>
      </Pressable>
    </Section>
    <Section helper={t('photos.helper')} title={t('photos.title')}>
      <PhotoStrip addLabel={t('photos.addPlace')} field="galleryUrls" folder="gallery" max={MAX_PLACE_PHOTOS} onUpdated={onUpdated} removeBody={t('photos.removeBody')} removeTitle={t('photos.removeTitle')} restaurant={restaurant} shape="wide" />
    </Section>
  </>;
}

const styles = themedStyles(({ bg, fg, line }) => ({
  coverWrap: { marginTop: 14 },
  cover: { width: '100%', aspectRatio: 16 / 9, borderRadius: 16, backgroundColor: bg('#E9DFD3') },
  placeholder: { alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderStyle: 'dashed', borderColor: line(OWNER_COLORS.accent), backgroundColor: bg('#FFF') },
  placeholderIcon: { fontSize: 34 },
  placeholderText: { color: fg(OWNER_COLORS.accent), fontSize: 15, fontWeight: '900' },
  coverAction: { color: fg(OWNER_COLORS.accent), fontSize: 12, fontWeight: '800', textAlign: 'center', marginTop: 8 },
}));
