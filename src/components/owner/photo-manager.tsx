import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { updateRestaurant } from '@/data/owner-restaurant';
import { pickPhoto, removeRestaurantPhoto, uploadRestaurantPhoto } from '@/data/restaurant-photos';
import type { Restaurant } from '@/data/restaurants';
import { confirmAction, errorMessage, showMessage } from '@/utils/feedback';

import { OWNER_COLORS, PrimaryButton, Section } from './form-controls';
import { themedStyles } from '@/theme/theme';

const MAX_GALLERY_PHOTOS = 8;
type PhotoChanges = Partial<Pick<Restaurant, 'coverUrl' | 'galleryUrls'>>;

export function PhotoManager({ onUpdated, restaurant }: { onUpdated: (changes: PhotoChanges) => void; restaurant: Restaurant }) {
  const [busy, setBusy] = useState<'cover' | 'gallery' | null>(null);

  /** Uploads a photo, saves the new URL list, and cleans up the upload if saving fails. */
  const upload = async (folder: 'cover' | 'gallery', aspect: [number, number], save: (url: string) => PhotoChanges) => {
    const asset = await pickPhoto(aspect);
    if (!asset) return null;
    setBusy(folder);
    let uploaded: string | null = null;
    try {
      uploaded = await uploadRestaurantPhoto(restaurant.id, asset, folder);
      const changes = save(uploaded);
      await updateRestaurant(restaurant.id, changes);
      onUpdated(changes);
      return uploaded;
    } catch (error) {
      void removeRestaurantPhoto(uploaded);
      showMessage('Could not upload photo', errorMessage(error));
      return null;
    } finally {
      setBusy(null);
    }
  };

  const changeCover = async () => {
    const previous = restaurant.coverUrl;
    const url = await upload('cover', [16, 9], (coverUrl) => ({ coverUrl }));
    if (url) void removeRestaurantPhoto(previous);
  };

  const addGalleryPhoto = () => upload('gallery', [4, 3], (url) => ({ galleryUrls: [...restaurant.galleryUrls, url] }));

  const removeGalleryPhoto = (url: string) => confirmAction('Remove photo?', 'Customers will no longer see this photo.', 'Remove', () => {
    const galleryUrls = restaurant.galleryUrls.filter((item) => item !== url);
    updateRestaurant(restaurant.id, { galleryUrls })
      .then(() => { onUpdated({ galleryUrls }); void removeRestaurantPhoto(url); })
      .catch((error: unknown) => showMessage('Could not remove photo', errorMessage(error)));
  });

  return <Section helper="The cover appears in search results and at the top of your page. Gallery photos show your dining space." title="Photos">
    <Text style={styles.label}>COVER PHOTO</Text>
    {restaurant.coverUrl
      ? <Image accessibilityLabel="Cover photo" contentFit="cover" source={restaurant.coverUrl} style={styles.cover} transition={200} />
      : <View style={[styles.cover, styles.placeholder]}><Text style={styles.placeholderIcon}>🏞️</Text><Text style={styles.placeholderText}>No cover photo yet</Text></View>}
    <PrimaryButton busy={busy === 'cover'} busyLabel="Uploading…" disabled={busy !== null} label={restaurant.coverUrl ? 'Change cover photo' : 'Add cover photo'} onPress={() => void changeCover()} />

    <Text style={styles.label}>GALLERY ({restaurant.galleryUrls.length}/{MAX_GALLERY_PHOTOS})</Text>
    <ScrollView contentContainerStyle={styles.gallery} horizontal showsHorizontalScrollIndicator={false}>
      {restaurant.galleryUrls.map((url) => <View key={url}>
        <Image contentFit="cover" source={url} style={styles.thumb} transition={200} />
        <Pressable accessibilityLabel="Remove gallery photo" disabled={busy !== null} hitSlop={6} onPress={() => removeGalleryPhoto(url)} style={styles.removeBadge}><Text style={styles.removeText}>×</Text></Pressable>
      </View>)}
      {restaurant.galleryUrls.length < MAX_GALLERY_PHOTOS && <Pressable accessibilityLabel="Add gallery photo" accessibilityRole="button" disabled={busy !== null} onPress={() => void addGalleryPhoto()} style={[styles.thumb, styles.addTile, busy !== null && styles.inactive]}>
        <Text style={styles.addIcon}>{busy === 'gallery' ? '…' : '+'}</Text>
        <Text style={styles.addText}>{busy === 'gallery' ? 'Uploading' : 'Add photo'}</Text>
      </Pressable>}
    </ScrollView>
  </Section>;
}

const styles = themedStyles(({ bg, fg, line }) => ({
  label: { color: fg(OWNER_COLORS.muted), fontSize: 9, fontWeight: '900', letterSpacing: 0.7, marginTop: 16, marginBottom: 8 },
  cover: { width: '100%', aspectRatio: 16 / 9, borderRadius: 16, backgroundColor: bg('#E9DFD3') },
  placeholder: { alignItems: 'center', justifyContent: 'center', gap: 6 },
  placeholderIcon: { fontSize: 34 },
  placeholderText: { color: fg(OWNER_COLORS.muted), fontSize: 12, fontWeight: '700' },
  gallery: { gap: 10, paddingTop: 6, paddingRight: 6 },
  thumb: { width: 132, height: 99, borderRadius: 14, backgroundColor: bg('#E9DFD3') },
  removeBadge: { position: 'absolute', top: -6, right: -6, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: bg(OWNER_COLORS.ink) },
  removeText: { color: fg('#FFF'), fontSize: 17, lineHeight: 19, fontWeight: '900' },
  addTile: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderColor: line('#D3C3B5'), backgroundColor: bg('#FFF') },
  addIcon: { color: fg(OWNER_COLORS.accent), fontSize: 26, fontWeight: '900', lineHeight: 28 },
  addText: { color: fg(OWNER_COLORS.accent), fontSize: 10, fontWeight: '800', marginTop: 2 },
  inactive: { opacity: 0.55 },
}));
