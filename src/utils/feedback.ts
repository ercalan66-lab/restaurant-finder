import { Alert, Platform } from 'react-native';

/** Supabase returns plain objects with a `message` for database errors, so `instanceof Error` is not enough. */
export function errorMessage(error: unknown, fallback = 'Please try again.') {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message) return error.message;
  return fallback;
}

/** React Native Web's Alert ignores buttons, so the browser's confirm dialog is used there. */
export function confirmAction(title: string, message: string, confirmLabel: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
