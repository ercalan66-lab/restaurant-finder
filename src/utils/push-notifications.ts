import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
// Named import: the lint rule cannot follow the package's nested `export *` for this enum.
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '../../lib/supabase';

// Show alerts even while the app is open. (Web has no remote push, so skip it there.)
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

const projectId: string | undefined = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

export type PushAvailability = 'granted' | 'undetermined' | 'denied' | 'unavailable';

/** Remote push needs a physical phone, a native build, and an EAS project id (`eas init`). */
export const pushSupported = Platform.OS !== 'web' && Device.isDevice && Boolean(projectId);

let cachedToken: string | null = null;

async function ensureAndroidChannel() {
  // Android needs a channel before it will show the permission prompt or issue a token.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', { name: 'Orders and bookings', importance: AndroidImportance.HIGH });
  }
}

export async function getPushAvailability(): Promise<PushAvailability> {
  if (!pushSupported) return 'unavailable';
  try {
    await ensureAndroidChannel();
    const { status, canAskAgain } = await Notifications.getPermissionsAsync();
    if (status === 'granted') return 'granted';
    return canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'unavailable';
  }
}

/**
 * This device's Expo push token, or null when push is unavailable or not allowed.
 * With `ask`, shows the system prompt if the person has not answered it before.
 */
export async function getPushToken({ ask }: { ask: boolean }): Promise<string | null> {
  if (cachedToken) return cachedToken;
  if (!pushSupported) return null;
  try {
    await ensureAndroidChannel();
    const current = await Notifications.getPermissionsAsync();
    let granted = current.status === 'granted';
    if (!granted && ask && current.canAskAgain) granted = (await Notifications.requestPermissionsAsync()).status === 'granted';
    if (!granted) return null;
    cachedToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    return cachedToken;
  } catch (error) {
    console.warn('Push notifications unavailable:', error instanceof Error ? error.message : error);
    return null;
  }
}

/** Links this device to the signed-in account, so alerts for that account reach it. */
export async function registerDeviceForAccount({ ask }: { ask: boolean }) {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return false;
  const token = await getPushToken({ ask });
  if (!token) return false;
  const { error } = await supabase.rpc('register_push_token', { p_token: token, p_platform: Platform.OS });
  if (error) console.warn('Could not register device for notifications:', error.message);
  return !error;
}

/** Call before signing out, so the next person using this phone does not get the previous account's alerts. */
export async function unregisterDevice() {
  const token = await getPushToken({ ask: false });
  if (!token) return;
  const { error } = await supabase.rpc('unregister_push_token', { p_token: token });
  if (error) console.warn('Could not unregister device:', error.message);
}

/** Opens the screen named in a tapped notification's `data.url`. Returns an unsubscribe function. */
export function handleNotificationTaps(open: (url: string) => void) {
  if (Platform.OS === 'web') return () => undefined;
  const openFrom = (response: Notifications.NotificationResponse | null) => {
    const url = response?.notification.request.content.data?.url;
    if (typeof url !== 'string') return;
    // Older notifications opened the in-app payment screen, which no longer exists (Kwetu is cash only).
    open(url.startsWith('/pay/') ? '/profile' : url);
    void Notifications.clearLastNotificationResponseAsync();
  };
  // Covers the tap that launched the app from closed.
  void Notifications.getLastNotificationResponseAsync().then(openFrom);
  const subscription = Notifications.addNotificationResponseReceivedListener(openFrom);
  return () => subscription.remove();
}

/** Runs `callback` whenever a notification arrives while the app is open. Returns an unsubscribe function. */
export function onNotificationReceived(callback: () => void) {
  if (Platform.OS === 'web') return () => undefined;
  const subscription = Notifications.addNotificationReceivedListener(callback);
  return () => subscription.remove();
}
