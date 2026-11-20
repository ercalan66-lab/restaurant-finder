import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { updateRestaurant } from '@/data/owner-restaurant';
import { MAX_MENU_PDF_MB, pickMenuPdf, removeMenuPdf, uploadMenuPdf } from '@/data/restaurant-menu-pdf';
import type { Restaurant } from '@/data/restaurants';
import { confirmAction, errorMessage, showMessage } from '@/utils/feedback';

import { OWNER_COLORS, PrimaryButton, Section, TextButton } from './form-controls';
import { themedStyles } from '@/theme/theme';

type Changes = Pick<Restaurant, 'menuPdfUrl'>;

/** Lets the owner publish their full menu as a PDF that customers can view or download. */
export function MenuPdfManager({ onUpdated, restaurant }: { onUpdated: (changes: Changes) => void; restaurant: Restaurant }) {
  const [busy, setBusy] = useState(false);
  const current = restaurant.menuPdfUrl;

  const upload = async () => {
    const file = await pickMenuPdf();
    if (!file) return;
    setBusy(true);
    let uploaded: string | null = null;
    try {
      uploaded = await uploadMenuPdf(restaurant.id, file);
      await updateRestaurant(restaurant.id, { menuPdfUrl: uploaded });
      onUpdated({ menuPdfUrl: uploaded });
      void removeMenuPdf(current);
      showMessage('Menu published', `Customers can now view and download ${file.name} from your page.`);
    } catch (error) {
      void removeMenuPdf(uploaded);
      showMessage('Could not upload the menu', errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const remove = () => confirmAction('Remove the menu PDF?', 'Customers will no longer be able to view or download it.', 'Remove', () => {
    setBusy(true);
    updateRestaurant(restaurant.id, { menuPdfUrl: null })
      .then(() => { onUpdated({ menuPdfUrl: null }); void removeMenuPdf(current); })
      .catch((error: unknown) => showMessage('Could not remove the menu', errorMessage(error)))
      .finally(() => setBusy(false));
  });

  return <Section helper={`Upload your full printed menu as a PDF (up to ${MAX_MENU_PDF_MB} MB). Customers can open or download it from your page, next to the dishes listed below.`} title="Menu PDF">
    {current
      ? <View style={styles.file}>
        <Text style={styles.fileIcon}>📄</Text>
        <View style={styles.fileCopy}>
          <Text style={styles.fileTitle}>Menu PDF is published</Text>
          <TextButton disabled={busy} label="Open it ›" onPress={() => void WebBrowser.openBrowserAsync(current)} />
        </View>
      </View>
      : <View style={styles.file}>
        <Text style={styles.fileIcon}>📄</Text>
        <View style={styles.fileCopy}><Text style={styles.empty}>No menu PDF yet</Text></View>
      </View>}
    <PrimaryButton busy={busy} busyLabel="Uploading…" disabled={busy} label={current ? 'Replace menu PDF' : 'Upload menu PDF'} onPress={() => void upload()} />
    {current && <TextButton destructive disabled={busy} label="Remove menu PDF" onPress={remove} />}
  </Section>;
}

const styles = themedStyles(({ bg, fg, line }) => ({
  file: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: line(OWNER_COLORS.line), backgroundColor: bg('#FFF') },
  fileIcon: { fontSize: 30 },
  fileCopy: { flex: 1 },
  fileTitle: { color: fg(OWNER_COLORS.ink), fontSize: 14, fontWeight: '900' },
  empty: { color: fg(OWNER_COLORS.muted), fontSize: 13, fontWeight: '700' },
}));
