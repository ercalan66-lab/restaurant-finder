import * as Location from 'expo-location';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { updateRestaurant } from '@/data/owner-restaurant';
import type { Restaurant } from '@/data/restaurants';
import { confirmAction, errorMessage, showMessage } from '@/utils/feedback';

import { OWNER_COLORS, PrimaryButton, Section, TextButton } from './form-controls';

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
        showMessage('Location is off', 'Allow location for Kwetu in your phone settings, then try again while you are at the restaurant.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const changes = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      confirmAction(
        'Save this as your restaurant’s location?',
        'Only do this while you are at the restaurant. Customers will see their distance to this spot.',
        'Save location',
        () => void updateRestaurant(restaurant.id, changes)
          .then(() => { onUpdated(changes); showMessage('Location saved', 'Customers can now see how far away your restaurant is.'); })
          .catch((error: unknown) => showMessage('Could not save the location', errorMessage(error))),
      );
    } catch (error) {
      showMessage('Could not find your location', errorMessage(error, 'Check that location is turned on, then try again.'));
    } finally {
      setBusy(false);
    }
  };

  return <Section helper="Customers see how far your restaurant is from them. Stand at the restaurant and tap the button below." title="Location on the map">
    <View style={styles.status}>
      <Text style={styles.icon}>📍</Text>
      <View style={styles.copy}>
        <Text style={styles.title}>{hasPosition ? 'Location saved' : 'No location yet'}</Text>
        {hasPosition
          ? <TextButton label="Check it on the map ›" onPress={() => void WebBrowser.openBrowserAsync(`https://www.google.com/maps/search/?api=1&query=${restaurant.latitude},${restaurant.longitude}`)} />
          : <Text style={styles.helper}>Until you add it, customers only see your area.</Text>}
      </View>
    </View>
    <PrimaryButton busy={busy} busyLabel="Finding your location…" disabled={busy} label={hasPosition ? 'Update to my current location' : 'Use my current location'} onPress={() => void saveCurrentLocation()} />
  </Section>;
}

const styles = StyleSheet.create({
  status: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: OWNER_COLORS.line, backgroundColor: '#FFF' },
  icon: { fontSize: 28 },
  copy: { flex: 1 },
  title: { color: OWNER_COLORS.ink, fontSize: 14, fontWeight: '900' },
  helper: { color: OWNER_COLORS.muted, fontSize: 12, lineHeight: 17, marginTop: 2 },
});
