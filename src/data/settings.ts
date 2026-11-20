import { useCallback, useEffect, useState } from 'react';

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

/** The person's settings on this device, and a function to change one. */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    let active = true;
    void loadSettings().then((loaded) => { if (active) setSettings(loaded); });
    return () => { active = false; };
  }, []);

  const update = useCallback((changes: Partial<Settings>) => setSettings((current) => {
    const next = { ...current, ...changes };
    void Storage.setItem(SETTINGS_KEY, JSON.stringify(next));
    return next;
  }), []);

  return { settings, update };
}
