import * as ImagePicker from 'expo-image-picker';

import { t } from '@/i18n';
import { supabase } from '../../lib/supabase';

const BUCKET = 'restaurant-photos';
const PUBLIC_PATH_MARKER = `/storage/v1/object/public/${BUCKET}/`;
const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export type PhotoFolder = 'cover' | 'gallery' | 'menu';

/** Opens the photo library with a crop step. Resolves to null if the owner cancels. */
export async function pickPhoto(aspect: [number, number]) {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect,
    quality: 0.7,
    // Ask iOS for a JPEG rather than HEIC, which Android and browsers cannot always show.
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });
  return result.canceled ? null : result.assets[0] ?? null;
}

function contentTypeOf(asset: ImagePicker.ImagePickerAsset) {
  if (asset.mimeType) return asset.mimeType;
  const extension = asset.uri.split('?')[0].split('.').pop()?.toLowerCase();
  return extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg';
}

/** Uploads to `<restaurant id>/<folder>/…` (the storage policy requires this layout) and returns the public URL. */
export async function uploadRestaurantPhoto(restaurantId: number, asset: ImagePicker.ImagePickerAsset, folder: PhotoFolder) {
  const contentType = contentTypeOf(asset);
  const extension = EXTENSIONS[contentType];
  if (!extension) throw new Error(t('photos.badType'));
  const body = await (await fetch(asset.uri)).arrayBuffer();
  const path = `${restaurantId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, { contentType, upsert: false });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Deletes a photo this app uploaded. Other URLs (such as demo photos) are left alone. Failures are only logged. */
export async function removeRestaurantPhoto(url: string | null | undefined) {
  const index = url ? url.indexOf(PUBLIC_PATH_MARKER) : -1;
  if (!url || index === -1) return;
  const path = decodeURIComponent(url.slice(index + PUBLIC_PATH_MARKER.length).split('?')[0]);
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) console.warn('Could not delete old photo:', error.message);
}
