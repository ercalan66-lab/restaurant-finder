import * as DocumentPicker from 'expo-document-picker';

import { supabase } from '../../lib/supabase';

const BUCKET = 'restaurant-menus';
const PUBLIC_PATH_MARKER = `/storage/v1/object/public/${BUCKET}/`;
/** Matches the bucket's file_size_limit in 202611200004_menu_pdf.sql. */
export const MAX_MENU_PDF_MB = 10;

/** Opens the phone's file picker for a PDF. Resolves to null if the owner cancels. */
export async function pickMenuPdf() {
  const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, multiple: false });
  return result.canceled ? null : result.assets[0] ?? null;
}

/** Uploads to `<restaurant id>/…` (the storage policy requires this layout) and returns the public URL. */
export async function uploadMenuPdf(restaurantId: number, file: DocumentPicker.DocumentPickerAsset) {
  const isPdf = file.mimeType === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) throw new Error('Please choose a PDF file.');
  if (file.size && file.size > MAX_MENU_PDF_MB * 1024 * 1024) throw new Error(`The PDF is larger than ${MAX_MENU_PDF_MB} MB. Please choose a smaller file.`);
  const body = await (await fetch(file.uri)).arrayBuffer();
  const path = `${restaurantId}/menu-${Date.now()}.pdf`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, { contentType: 'application/pdf', upsert: false });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Deletes a menu PDF this app uploaded. Failures are only logged, so saving the restaurant still works. */
export async function removeMenuPdf(url: string | null | undefined) {
  const index = url ? url.indexOf(PUBLIC_PATH_MARKER) : -1;
  if (!url || index === -1) return;
  const path = decodeURIComponent(url.slice(index + PUBLIC_PATH_MARKER.length).split('?')[0]);
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) console.warn('Could not delete old menu PDF:', error.message);
}

/** The same file, but Supabase sends it as a download named after the restaurant. */
export function menuPdfDownloadUrl(url: string, restaurantName: string) {
  const fileName = `${restaurantName.replace(/[^A-Za-z0-9 ]+/g, '').trim() || 'Restaurant'} menu.pdf`;
  return `${url.split('?')[0]}?download=${encodeURIComponent(fileName)}`;
}
