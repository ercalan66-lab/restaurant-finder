import { en } from './en';
import { sw } from './sw';

export type Language = 'en' | 'sw';
export type MessageKey = keyof typeof en;
/** Every language must translate every English key; TypeScript fails the build when one is missing. */
export type Dictionary = Record<MessageKey, string>;

const dictionaries: Record<Language, Dictionary> = { en, sw };

let language: Language = 'en';

/** Set by the root layout before any screen renders; screens are remounted when it changes. */
export function setLanguage(next: Language) {
  language = next;
}
export const currentLanguage = () => language;

/**
 * The text for `key` in the current language. `{name}` placeholders are filled from `params`:
 * t('home.results', { query: 'pilau' }).
 */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const template = dictionaries[language][key] ?? en[key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole));
}

/**
 * Counted text: uses `${base}.one` for 1 and `${base}.other` otherwise, with `{count}` filled in.
 * tn('count.restaurants', 3) → "3 restaurants" / "migahawa 3".
 */
export function tn(base: PluralBase, count: number, params?: Record<string, string | number>) {
  return t(`${base}.${count === 1 ? 'one' : 'other'}` as MessageKey, { count, ...params });
}
type PluralBase = MessageKey extends infer K ? K extends `${infer B}.one` ? B : never : never;

/** Locale for dates, for example "20 Nov 2026" or "20 Nov 2026" in Kiswahili. */
export const dateLocale = () => (language === 'sw' ? 'sw-TZ' : 'en-GB');
