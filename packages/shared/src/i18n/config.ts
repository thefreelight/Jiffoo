/**
 * i18n Configuration Module
 * 
 * Defines the core i18n configuration including supported locales,
 * default locale, and utility functions for locale validation and mapping.
 * 
 * Supported languages: en (English), zh-Hant (Traditional Chinese)
 * Default language: en
 */

/**
 * Supported locale codes
 * - en: English (default)
 * - zh-Hant: Traditional Chinese
 */
export const LOCALES = ['en', 'zh-Hant'] as const;

/**
 * Locale type derived from LOCALES constant
 */
export type Locale = (typeof LOCALES)[number];

/**
 * Default locale for all applications
 */
export const DEFAULT_LOCALE: Locale = 'en';

/**
 * Locale configuration with display names
 */
export const LOCALE_CONFIG: Record<Locale, { name: string; nativeName: string; dir: 'ltr' | 'rtl' }> = {
  en: {
    name: 'English',
    nativeName: 'English',
    dir: 'ltr',
  },
  'zh-Hant': {
    name: 'Traditional Chinese',
    nativeName: '繁體中文',
    dir: 'ltr',
  },
};

/**
 * Check if a string is a valid supported locale
 * @param locale - The locale string to validate
 * @returns True if the locale is supported
 */
export function isSupportedLocale(locale: string): locale is Locale {
  return LOCALES.includes(locale as Locale);
}

/**
 * Browser language to locale mapping
 * Maps various browser language codes to our supported locales
 * All zh-* variants map to zh-Hant
 */
const BROWSER_LANGUAGE_MAP: Record<string, Locale> = {
  // English variants
  'en': 'en',
  'en-US': 'en',
  'en-GB': 'en',
  'en-AU': 'en',
  'en-CA': 'en',
  'en-NZ': 'en',
  'en-IE': 'en',
  'en-ZA': 'en',
  // Chinese variants - all map to Traditional Chinese
  'zh': 'zh-Hant',
  'zh-CN': 'zh-Hant',
  'zh-TW': 'zh-Hant',
  'zh-HK': 'zh-Hant',
  'zh-SG': 'zh-Hant',
  'zh-Hans': 'zh-Hant',
  'zh-Hant': 'zh-Hant',
};

/**
 * Map a browser language code to a supported locale
 * @param browserLanguage - The browser's language code (e.g., 'zh-CN', 'en-US')
 * @returns The mapped locale or default locale if not found
 */
export function mapBrowserLanguageToLocale(browserLanguage: string): Locale {
  // Try exact match first
  if (BROWSER_LANGUAGE_MAP[browserLanguage]) {
    return BROWSER_LANGUAGE_MAP[browserLanguage];
  }

  // Try language prefix match (e.g., 'en' from 'en-US')
  const languagePrefix = browserLanguage.split('-')[0];
  if (BROWSER_LANGUAGE_MAP[languagePrefix]) {
    return BROWSER_LANGUAGE_MAP[languagePrefix];
  }

  // Fallback to default locale
  return DEFAULT_LOCALE;
}

/**
 * Get locale from Accept-Language header
 * @param acceptLanguage - The Accept-Language header value
 * @returns The best matching locale
 */
export function getLocaleFromAcceptLanguage(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) {
    return DEFAULT_LOCALE;
  }

  // Parse Accept-Language header (e.g., "zh-TW,zh;q=0.9,en;q=0.8")
  const languages = acceptLanguage
    .split(',')
    .map((lang) => {
      const [code, quality] = lang.trim().split(';q=');
      return {
        code: code.trim(),
        quality: quality ? parseFloat(quality) : 1,
      };
    })
    .sort((a, b) => b.quality - a.quality);

  // Find first matching locale
  for (const { code } of languages) {
    const locale = mapBrowserLanguageToLocale(code);
    if (locale !== DEFAULT_LOCALE || code.startsWith('en')) {
      return locale;
    }
  }

  return DEFAULT_LOCALE;
}

/**
 * Normalize locale string to ensure consistency
 * @param locale - The locale string to normalize
 * @returns The normalized locale or default if invalid
 */
export function normalizeLocale(locale: string | undefined | null): Locale {
  if (!locale) {
    return DEFAULT_LOCALE;
  }

  // Direct match
  if (isSupportedLocale(locale)) {
    return locale;
  }

  // Try mapping from browser language
  return mapBrowserLanguageToLocale(locale);
}

