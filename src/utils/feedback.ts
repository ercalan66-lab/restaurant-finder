import { Alert, Platform } from 'react-native';

import { t } from '@/i18n';

/** Supabase returns plain objects with a `message` for database errors, so `instanceof Error` is not enough. */
export function errorMessage(error: unknown, fallback = t('common.tryAgain')) {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message) return error.message;
  return fallback;
}

/**
 * A short message with an OK button. React Native Web's Alert does nothing at all, so browsers
 * use their own message box; without this, errors in the web version looked like nothing happened.
 */
export function showMessage(title: string, message?: string) {
  if (Platform.OS === 'web') {
    globalThis.alert?.(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

/** React Native Web's Alert ignores buttons, so the browser's confirm dialog is used there. */
export function confirmAction(title: string, message: string, confirmLabel: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: t('common.cancel'), style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
