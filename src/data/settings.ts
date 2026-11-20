import { useSyncExternalStore } from 'react';

import Storage from '@/utils/kv-store';

export type ThemePreference = 'system' | 'light' | 'dark';
export type LanguagePreference = 'en' | 'sw';
export type Settings = { theme: ThemePreference; language: LanguagePreference };

const SETTINGS_KEY = 'kwetu-settings';
export const DEFAULT_SETTINGS: Settings = { theme: 'system', language: 'en' };

const THEMES: ThemePreference[] = ['system', 'light', 'dark'];
const LANGUAGES: LanguagePreference[] = ['en', 'sw'];

/** Reads saved settings, ignoring anything unknown so an old or damaged value never breaks the app. */
export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await Storage.getItem(SETTINGS_KEY);
    const saved = raw ? (JSON.parse(raw) as Partial<Settings>) : {};
    return {
      theme: THEMES.includes(saved.theme as ThemePreference) ? saved.theme as ThemePreference : DEFAULT_SETTINGS.theme,
      language: LANGUAGES.includes(saved.language as LanguagePreference) ? saved.language as LanguagePreference : DEFAULT_SETTINGS.language,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

// One shared copy, so a change on the Settings page reaches the root layout (theme) at once.
let current: Settings = DEFAULT_SETTINGS;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

let loaded = false;
function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  void loadSettings().then((saved) => { current = saved; emit(); });
}

export function updateSettings(changes: Partial<Settings>) {
  current = { ...current, ...changes };
  void Storage.setItem(SETTINGS_KEY, JSON.stringify(current));
  emit();
}

function subscribe(listener: () => void) {
  ensureLoaded();
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** The person's settings on this device, and a function to change them. */
export function useSettings() {
  const settings = useSyncExternalStore(subscribe, () => current, () => current);
  return { settings, update: updateSettings };
}
