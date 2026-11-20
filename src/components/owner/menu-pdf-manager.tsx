import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { updateRestaurant } from '@/data/owner-restaurant';
import { MAX_MENU_PDF_MB, pickMenuPdf, removeMenuPdf, uploadMenuPdf } from '@/data/restaurant-menu-pdf';
import type { Restaurant } from '@/data/restaurants';
import { t } from '@/i18n';
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
      showMessage(t('pdf.published'), t('pdf.publishedBody', { file: file.name }));
    } catch (error) {
      void removeMenuPdf(uploaded);
      showMessage(t('pdf.uploadFailed'), errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const remove = () => confirmAction(t('pdf.removeTitle'), t('pdf.removeBody'), t('menu.remove'), () => {
    setBusy(true);
    updateRestaurant(restaurant.id, { menuPdfUrl: null })
      .then(() => { onUpdated({ menuPdfUrl: null }); void removeMenuPdf(current); })
      .catch((error: unknown) => showMessage(t('pdf.removeFailed'), errorMessage(error)))
      .finally(() => setBusy(false));
  });

  return <Section helper={t('pdf.helper', { mb: MAX_MENU_PDF_MB })} title={t('pdf.title')}>
    {current
      ? <View style={styles.file}>
        <Text style={styles.fileIcon}>📄</Text>
        <View style={styles.fileCopy}>
          <Text style={styles.fileTitle}>{t('pdf.isPublished')}</Text>
          <TextButton disabled={busy} label={t('pdf.open')} onPress={() => void WebBrowser.openBrowserAsync(current)} />
        </View>
      </View>
      : <View style={styles.file}>
        <Text style={styles.fileIcon}>📄</Text>
        <View style={styles.fileCopy}><Text style={styles.empty}>{t('pdf.none')}</Text></View>
      </View>}
    <PrimaryButton busy={busy} busyLabel={t('common.uploading')} disabled={busy} label={t(current ? 'pdf.replace' : 'pdf.upload')} onPress={() => void upload()} />
    {current && <TextButton destructive disabled={busy} label={t('pdf.remove')} onPress={remove} />}
  </Section>;
}

const styles = themedStyles(({ bg, fg, line }) => ({
  file: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: line(OWNER_COLORS.line), backgroundColor: bg('#FFF') },
  fileIcon: { fontSize: 30 },
  fileCopy: { flex: 1 },
  fileTitle: { color: fg(OWNER_COLORS.ink), fontSize: 14, fontWeight: '900' },
  empty: { color: fg(OWNER_COLORS.muted), fontSize: 13, fontWeight: '700' },
}));
