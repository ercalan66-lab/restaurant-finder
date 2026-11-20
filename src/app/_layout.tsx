import { router, Stack, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { syncPendingRequests } from '@/data/guest-storage';
import { useSettings } from '@/data/settings';
import { setLanguage } from '@/i18n';
import { paint, setScheme, type Scheme } from '@/theme/theme';
import { handleNotificationTaps, registerDeviceForAccount } from '@/utils/push-notifications';
import { supabase } from '../../lib/supabase';

SplashScreen.preventAutoHideAsync();

const RETRY_INTERVAL_MS = 30_000;
const PAGE_BACKGROUND = '#FFF8ED';

export default function TabLayout() {
  // Light or dark: the person's choice in Settings, or the phone's own setting.
  const { settings } = useSettings();
  const phoneScheme = useColorScheme();
  const scheme: Scheme = settings.theme === 'system' ? (phoneScheme === 'dark' ? 'dark' : 'light') : settings.theme;
  // Themed styles and t() read these while rendering, so they are set before any screen renders.
  setScheme(scheme);
  setLanguage(settings.language);

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
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {/* Changing the scheme or language remounts the screens (the key), so every style and text is
          read again. The open screens stay open: navigation state is kept globally. */}
      <Stack key={`${scheme}-${settings.language}`} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: paint().bg(PAGE_BACKGROUND) } }} />
    </>
  );
}
