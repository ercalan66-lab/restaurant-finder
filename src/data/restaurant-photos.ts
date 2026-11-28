import type { SupabaseClient } from '@supabase/supabase-js';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform } from 'react-native';

import { t } from '@/i18n';
import { showMessage } from '@/utils/feedback';
import { supabase } from '../../lib/supabase';

const BUCKET = 'restaurant-photos';
const PUBLIC_PATH_MARKER = `/storage/v1/object/public/${BUCKET}/`;
const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const QUALITY = 0.7;

/** `menu` holds dish photos; `menu-pages` holds photos of the printed menu. */
export type PhotoFolder = 'cover' | 'gallery' | 'menu' | 'menu-pages';

type PickOptions = {
  /** Crop to this shape. Only offered for a single photo: phones cannot crop several at once. */
  aspect?: [number, number];
  /** How many photos may be chosen from the phone in one go (the camera always takes one). */
  max?: number;
};

async function fromCamera({ aspect }: PickOptions): Promise<ImagePicker.ImagePickerAsset[]> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    showMessage(t('photos.cameraDeniedTitle'), t('photos.cameraDeniedBody'));
    return [];
  }
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: aspect !== undefined, aspect, quality: QUALITY });
  return result.canceled ? [] : result.assets.slice(0, 1);
}

async function fromLibrary({ aspect, max = 1 }: PickOptions): Promise<ImagePicker.ImagePickerAsset[]> {
  const several = max > 1;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: !several && aspect !== undefined,
    aspect,
    allowsMultipleSelection: several,
    selectionLimit: several ? max : undefined,
    orderedSelection: several,
    quality: QUALITY,
    // Ask iOS for a JPEG rather than HEIC, which Android and browsers cannot always show.
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });
  return result.canceled ? [] : result.assets.slice(0, max);
}

/**
 * Asks whether to take a new photo or choose existing ones, then opens the camera or the phone's photos.
 * Resolves to the chosen photos, or an empty list if the owner cancels. The web version has no camera
 * choice and goes straight to the file picker.
 */
export function pickPhotos(options: PickOptions = {}): Promise<ImagePicker.ImagePickerAsset[]> {
  if (Platform.OS === 'web') return fromLibrary(options).catch(() => []);
  return new Promise((resolve) => {
    const open = (pick: (options: PickOptions) => Promise<ImagePicker.ImagePickerAsset[]>) => () => {
      pick(options).then(resolve, (error: unknown) => {
        showMessage(t('photos.uploadFailed'), error instanceof Error ? error.message : undefined);
        resolve([]);
      });
    };
    // Android lays three buttons out left to right, so Cancel goes first; iOS moves it to the bottom.
    Alert.alert(t('photos.sourceTitle'), undefined, [
      { text: t('common.cancel'), style: 'cancel', onPress: () => resolve([]) },
      { text: t('photos.takePhoto'), onPress: open(fromCamera) },
      { text: t('photos.fromPhone'), onPress: open(fromLibrary) },
    ], { cancelable: true, onDismiss: () => resolve([]) });
  });
}

/** One photo, from the camera or the phone, cropped to `aspect`. Resolves to null if the owner cancels. */
export async function pickPhoto(aspect: [number, number]) {
  return (await pickPhotos({ aspect }))[0] ?? null;
}

function contentTypeOf(asset: ImagePicker.ImagePickerAsset) {
  if (asset.mimeType) return asset.mimeType;
  const extension = asset.uri.split('?')[0].split('.').pop()?.toLowerCase();
  return extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg';
}

/** Uploads to `<restaurant id>/<folder>/…` (the storage policy requires this layout) and returns the public URL. */
export async function uploadRestaurantPhoto(restaurantId: number, asset: ImagePicker.ImagePickerAsset, folder: PhotoFolder, db: SupabaseClient = supabase) {
  const contentType = contentTypeOf(asset);
  const extension = EXTENSIONS[contentType];
  if (!extension) throw new Error(t('photos.badType'));
  const body = await (await fetch(asset.uri)).arrayBuffer();
  const path = `${restaurantId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const { error } = await db.storage.from(BUCKET).upload(path, body, { contentType, upsert: false });
  if (error) throw error;
  return db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/**
 * Uploads several photos one after another, reporting progress as (done, total). If one fails, the
 * photos already uploaded in this batch are deleted again and the error is passed on.
 */
export async function uploadRestaurantPhotos(restaurantId: number, assets: ImagePicker.ImagePickerAsset[], folder: PhotoFolder, onProgress?: (done: number, total: number) => void, db: SupabaseClient = supabase) {
  const urls: string[] = [];
  try {
    for (const asset of assets) {
      onProgress?.(urls.length, assets.length);
      urls.push(await uploadRestaurantPhoto(restaurantId, asset, folder, db));
    }
    return urls;
  } catch (error) {
    await Promise.all(urls.map((url) => removeRestaurantPhoto(url, db)));
    throw error;
  }
}

/** Deletes a photo this app uploaded. Other URLs (such as demo photos) are left alone. Failures are only logged. */
export async function removeRestaurantPhoto(url: string | null | undefined, db: SupabaseClient = supabase) {
  const index = url ? url.indexOf(PUBLIC_PATH_MARKER) : -1;
  if (!url || index === -1) return;
  const path = decodeURIComponent(url.slice(index + PUBLIC_PATH_MARKER.length).split('?')[0]);
  const { error } = await db.storage.from(BUCKET).remove([path]);
  if (error) console.warn('Could not delete old photo:', error.message);
}
