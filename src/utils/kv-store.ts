// Small key-value storage on this device: SQLite on iOS and Android.
// Browsers use kv-store.web.ts instead, which Metro picks automatically for the web build.
export { default } from 'expo-sqlite/kv-store';
