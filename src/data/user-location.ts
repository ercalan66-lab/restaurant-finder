import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';

import type { Coords } from '@/utils/distance';

/**
 * checking: reading the permission. undetermined: we may ask. denied: only phone settings can turn it on.
 * unavailable: allowed, but no position could be found (or the device has no location service).
 */
export type LocationStatus = 'checking' | 'undetermined' | 'granted' | 'denied' | 'unavailable';

type State = { status: LocationStatus; coords: Coords | null };

const toCoords = (position: Location.LocationObject | null): Coords | null =>
  position ? { latitude: position.coords.latitude, longitude: position.coords.longitude } : null;

/**
 * The phone's approximate position, used only on the phone to show how far restaurants are.
 * Never asks on its own: call `request()` from a button so people know why they are asked.
 */
export function useUserLocation() {
  const [state, setState] = useState<State>({ status: 'checking', coords: null });

  const locate = useCallback(() => {
    const apply = (position: Location.LocationObject | null) => {
      const coords = toCoords(position);
      if (coords) setState({ status: 'granted', coords });
    };
    setState((current) => ({ status: 'granted', coords: current.coords }));
    // A recent saved position shows distances at once; the fresh one replaces it a moment later.
    Location.getLastKnownPositionAsync().then(apply).catch(() => undefined);
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      .then(apply)
      .catch(() => setState((current) => current.coords ? current : { status: 'unavailable', coords: null }));
  }, []);

  useEffect(() => {
    let active = true;
    Location.getForegroundPermissionsAsync()
      .then((permission) => {
        if (!active) return;
        if (permission.granted) locate();
        else setState({ status: permission.canAskAgain ? 'undetermined' : 'denied', coords: null });
      })
      .catch(() => { if (active) setState({ status: 'unavailable', coords: null }); });
    return () => { active = false; };
  }, [locate]);

  const request = useCallback(async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.granted) locate();
      else setState({ status: permission.canAskAgain ? 'undetermined' : 'denied', coords: null });
    } catch {
      setState({ status: 'unavailable', coords: null });
    }
  }, [locate]);

  return { ...state, request };
}
