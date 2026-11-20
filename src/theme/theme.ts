import { StyleSheet } from 'react-native';

export type Scheme = 'light' | 'dark';

/**
 * Turn a colour from the light design into the colour for the current scheme. Each one knows what
 * the colour is used for, because the same white is a card behind text but also text on a button.
 */
export type Painters = {
  /** backgroundColor */
  bg: (color: string) => string;
  /** color (text) */
  fg: (color: string) => string;
  /** border colours */
  line: (color: string) => string;
};

type Hsl = { h: number; s: number; l: number };

function parseHex(color: string): [number, number, number] | null {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!match) return null;
  const hex = match[1].length === 3 ? match[1].split('').map((c) => c + c).join('') : match[1];
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
}

function toHsl([r, g, b]: [number, number, number]): Hsl {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h / 6, s, l };
}

function toHex({ h, l, s }: Hsl) {
  const hueToRgb = (p: number, q: number, t: number) => {
    const u = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (u < 1 / 6) return p + (q - p) * 6 * u;
    if (u < 1 / 2) return q;
    if (u < 2 / 3) return p + (q - p) * (2 / 3 - u) * 6;
    return p;
  };
  let rgb: number[];
  if (s === 0) rgb = [l, l, l];
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    rgb = [hueToRgb(p, q, h + 1 / 3), hueToRgb(p, q, h), hueToRgb(p, q, h - 1 / 3)];
  }
  return `#${rgb.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
/** Strong colours (orange buttons, green and red badges) as opposed to creams, greys and browns. */
const isVivid = (c: Hsl) => c.s >= 0.35 && c.l >= 0.25 && c.l <= 0.8;

/** Dark-scheme versions of light-design colours. Anything that is not a plain hex colour is kept as it is. */
export function darkBackground(color: string) {
  const rgb = parseHex(color);
  if (!rgb) return color;
  const c = toHsl(rgb);
  if (c.l >= 0.99) return '#211C18';                                            // white cards sit just above the page
  if (c.l >= 0.85) return toHex({ h: c.h, s: Math.min(c.s, 0.35), l: clamp(0.13 - (c.l - 0.85) * 0.45, 0.07, 0.13) });
  if (isVivid(c)) return color;                                                 // buttons and badges keep their colour
  if (c.l < 0.3) return toHex({ ...c, l: clamp(c.l + 0.06, 0.12, 0.2) });       // dark panels stay dark, lifted a little
  return toHex({ h: c.h, s: Math.min(c.s, 0.3), l: clamp(1 - c.l, 0.16, 0.3) }); // light-mid fills become dark fills
}

export function darkText(color: string) {
  const rgb = parseHex(color);
  if (!rgb) return color;
  const c = toHsl(rgb);
  if (c.l >= 0.75) return color;                                                // light text already sits on photos, buttons or dark panels
  if (c.s >= 0.3 && c.l >= 0.2) return toHex({ ...c, l: Math.max(c.l, 0.64) });  // coloured text: brighten for dark
  if (c.l < 0.35) return toHex({ h: c.h, s: Math.min(c.s, 0.25), l: clamp(1 - c.l, 0.86, 0.95) });
  return toHex({ h: c.h, s: Math.min(c.s, 0.2), l: clamp(1.12 - c.l, 0.58, 0.76) }); // muted greys stay muted but readable
}

export function darkLine(color: string) {
  const rgb = parseHex(color);
  if (!rgb) return color;
  const c = toHsl(rgb);
  if (isVivid(c)) return color;                                                 // highlighted borders keep their colour
  if (c.l >= 0.6) return toHex({ h: c.h, s: Math.min(c.s, 0.2), l: clamp(0.36 - (c.l - 0.6) * 0.4, 0.2, 0.3) });
  return toHex({ h: c.h, s: Math.min(c.s, 0.2), l: clamp(c.l + 0.2, 0.3, 0.5) });
}

const keep = (color: string) => color;
const cached = (convert: (color: string) => string) => {
  const memo = new Map<string, string>();
  return (color: string) => {
    if (!memo.has(color)) memo.set(color, convert(color));
    return memo.get(color) as string;
  };
};
const lightPainters: Painters = { bg: keep, fg: keep, line: keep };
const darkPainters: Painters = { bg: cached(darkBackground), fg: cached(darkText), line: cached(darkLine) };

let scheme: Scheme = 'light';

/** Set by the root layout before any screen renders; screens are remounted when it changes. */
export function setScheme(next: Scheme) {
  scheme = next;
}
export const currentScheme = () => scheme;

/** Painters for colours used outside a stylesheet, such as icon tints. Read during render. */
export const paint = (): Painters => (scheme === 'dark' ? darkPainters : lightPainters);

/**
 * Like StyleSheet.create, but builds a light and a dark version from the light design and hands out
 * whichever matches the current scheme.
 */
export function themedStyles<S extends StyleDefinitions>(build: (painters: Painters) => S & StyleDefinitions): Readonly<S> {
  const light = StyleSheet.create(build(lightPainters));
  const dark = StyleSheet.create(build(darkPainters));
  // The proxy wraps an empty object: React Native freezes style objects in development, and a proxy
  // must not return a different value for a frozen property of its own target.
  return new Proxy({} as Readonly<S>, { get: (_target, key) => (scheme === 'dark' ? dark : light)[key as keyof S] });
}

/** Whatever StyleSheet.create accepts (React Native 0.88 does not export a public name for it). */
type StyleDefinitions = Parameters<typeof StyleSheet.create>[0];
