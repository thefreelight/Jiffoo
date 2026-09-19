import type { Locale } from '../types/i18n';

/**
 * Single source of truth for the theme's language switcher.
 *
 * `label` is the compact switcher badge; `nativeName` is shown in the
 * dropdown list. Keep in sync with the shared routing superset
 * (shared/src/i18n config LOCALES) and the store context's
 * supportedLocales for the storefront using this theme.
 */
export interface ThemeLocaleOption {
  code: Locale;
  label: string;
  nativeName: string;
}

export const THEME_LOCALES: readonly ThemeLocaleOption[] = [
  { code: 'en', label: 'EN', nativeName: 'English' },
  { code: 'zh-Hans', label: '简', nativeName: '简体中文' },
  { code: 'zh-Hant', label: '繁', nativeName: '繁體中文' },
  { code: 'es', label: 'ES', nativeName: 'Español' },
  { code: 'fr', label: 'FR', nativeName: 'Français' },
  { code: 'de', label: 'DE', nativeName: 'Deutsch' },
  { code: 'ja', label: 'JA', nativeName: '日本語' },
] as const;

export const THEME_LOCALE_CODES: readonly Locale[] = THEME_LOCALES.map((item) => item.code);

export function getThemeLocaleOption(code: Locale): ThemeLocaleOption {
  return THEME_LOCALES.find((item) => item.code === code) ?? THEME_LOCALES[0];
}

/**
 * Strip a leading locale segment from a storefront path.
 * Derived from THEME_LOCALE_CODES so new locales never need a regex edit.
 */
export function stripLocalePrefix(pathname: string): string {
  const pattern = new RegExp(`^/(?:${THEME_LOCALE_CODES.join('|')})(?=/|$)`);
  return pathname.replace(pattern, '') || '/';
}
