import * as Location from 'expo-location';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { updateRestaurant } from '@/data/owner-restaurant';
import type { Restaurant } from '@/data/restaurants';
import { t } from '@/i18n';
import { confirmAction, errorMessage, showMessage } from '@/utils/feedback';

import { OWNER_COLORS, PrimaryButton, Section, TextButton } from './form-controls';
import { themedStyles } from '@/theme/theme';

type Changes = Pick<Restaurant, 'latitude' | 'longitude'>;

/** Saves the restaurant's map position, so customers see how far away it is. */
export function LocationManager({ onUpdated, restaurant }: { onUpdated: (changes: Changes) => void; restaurant: Restaurant }) {
  const [busy, setBusy] = useState(false);
  const hasPosition = restaurant.latitude != null && restaurant.longitude != null;

  const saveCurrentLocation = async () => {
    setBusy(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        showMessage(t('loc.offTitle'), t('loc.offBody'));
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const changes = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      confirmAction(
        t('loc.confirmTitle'),
        t('loc.confirmBody'),
        t('loc.save'),
        () => void updateRestaurant(restaurant.id, changes)
          .then(() => { onUpdated(changes); showMessage(t('loc.saved'), t('loc.savedBody')); })
          .catch((error: unknown) => showMessage(t('loc.saveFailed'), errorMessage(error))),
      );
    } catch (error) {
      showMessage(t('loc.findFailed'), errorMessage(error, t('loc.findFailedBody')));
    } finally {
      setBusy(false);
    }
  };

  return <Section helper={t('loc.helper')} title={t('loc.title')}>
    <View style={styles.status}>
      <Text style={styles.icon}>📍</Text>
      <View style={styles.copy}>
        <Text style={styles.title}>{t(hasPosition ? 'loc.saved' : 'loc.none')}</Text>
        {hasPosition
          ? <TextButton label={t('loc.check')} onPress={() => void WebBrowser.openBrowserAsync(`https://www.google.com/maps/search/?api=1&query=${restaurant.latitude},${restaurant.longitude}`)} />
          : <Text style={styles.helper}>{t('loc.noneHint')}</Text>}
      </View>
    </View>
    <PrimaryButton busy={busy} busyLabel={t('loc.finding')} disabled={busy} label={t(hasPosition ? 'loc.update' : 'loc.use')} onPress={() => void saveCurrentLocation()} />
  </Section>;
}

const styles = themedStyles(({ bg, fg, line }) => ({
  status: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: line(OWNER_COLORS.line), backgroundColor: bg('#FFF') },
  icon: { fontSize: 28 },
  copy: { flex: 1 },
  title: { color: fg(OWNER_COLORS.ink), fontSize: 14, fontWeight: '900' },
  helper: { color: fg(OWNER_COLORS.muted), fontSize: 12, lineHeight: 17, marginTop: 2 },
}));
