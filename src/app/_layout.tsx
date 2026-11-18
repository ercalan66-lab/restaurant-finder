import { router, Stack, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { syncPendingRequests } from '@/data/guest-storage';
import { handleNotificationTaps, registerDeviceForAccount } from '@/utils/push-notifications';
import { supabase } from '../../lib/supabase';

SplashScreen.preventAutoHideAsync();

const RETRY_INTERVAL_MS = 30_000;

export default function TabLayout() {
  // Orders and bookings that could not be sent are retried on launch, on return to the app, and every 30 s while open.
  useEffect(() => {
    void syncPendingRequests();
    const timer = setInterval(() => { if (AppState.currentState === 'active') void syncPendingRequests(); }, RETRY_INTERVAL_MS);
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') void syncPendingRequests(); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, []);

  // Keep this phone linked to whoever is signed in (only if notifications are already allowed),
  // and open the screen a tapped notification points to.
  useEffect(() => {
    void registerDeviceForAccount({ ask: false });
    const { data: auth } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') void registerDeviceForAccount({ ask: false });
    });
    const stopTaps = handleNotificationTaps((url) => router.push(url as Href));
    return () => { auth.subscription.unsubscribe(); stopTaps(); };
  }, []);

  return (
    <>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
