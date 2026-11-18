import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { syncPendingRequests } from '@/data/guest-storage';

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

  return (
    <>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
