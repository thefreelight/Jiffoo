/**
 * Backend i18n Utilities
 * 
 * Provides locale detection and validation for API requests.
 * Supports language negotiation via Accept-Language header or query parameter.
 */

// Supported locales
export const LOCALES = ['en', 'zh-Hant'] as const;
export type Locale = typeof LOCALES[number];
export const DEFAULT_LOCALE: Locale = 'en';

/**
 * Check if a locale is supported
 */
export function isSupportedLocale(locale: string): locale is Locale {
  return LOCALES.includes(locale as Locale);
}

/**
 * Map browser language codes to supported locales
 * All zh-* variants map to zh-Hant
 */
export function mapBrowserLanguageToLocale(browserLang: string): Locale {
  const lang = browserLang.toLowerCase().trim();

  // Direct match
  if (isSupportedLocale(lang)) {
    return lang;
  }

  // Map all Chinese variants to zh-Hant
  if (lang.startsWith('zh')) {
    return 'zh-Hant';
  }

  // Map English variants to en
  if (lang.startsWith('en')) {
    return 'en';
  }

  // Default to English
  return DEFAULT_LOCALE;
}

/**
 * Parse Accept-Language header and return the best matching locale
 * @param acceptLanguage - The Accept-Language header value
 * @returns The best matching locale
 */
export function getLocaleFromAcceptLanguage(acceptLanguage?: string | null): Locale {
  if (!acceptLanguage) {
    return DEFAULT_LOCALE;
  }

  // Parse Accept-Language header
  // Format: "en-US,en;q=0.9,zh-TW;q=0.8,zh;q=0.7"
  const languages = acceptLanguage
    .split(',')
    .map((lang) => {
      const [code, qValue] = lang.trim().split(';q=');
      return {
        code: code.trim(),
        quality: qValue ? parseFloat(qValue) : 1.0,
      };
    })
    .sort((a, b) => b.quality - a.quality);

  // Find the first supported locale
  for (const { code } of languages) {
    const mapped = mapBrowserLanguageToLocale(code);
    if (isSupportedLocale(mapped)) {
      return mapped;
    }
  }

  return DEFAULT_LOCALE;
}

/**
 * Get locale from request
 * Priority: query param > Accept-Language header > default
 * @param queryLocale - Locale from query parameter
 * @param acceptLanguage - Accept-Language header value
 * @returns The resolved locale
 */
export function getLocaleFromRequest(
  queryLocale?: string | null,
  acceptLanguage?: string | null
): Locale {
  // Priority 1: Query parameter
  if (queryLocale && isSupportedLocale(queryLocale)) {
    return queryLocale;
  }

  // Priority 2: Accept-Language header
  if (acceptLanguage) {
    return getLocaleFromAcceptLanguage(acceptLanguage);
  }

  // Priority 3: Default locale
  return DEFAULT_LOCALE;
}

/**
 * Normalize locale string
 * Ensures consistent locale format
 */
export function normalizeLocale(locale: string): Locale {
  return mapBrowserLanguageToLocale(locale);
}

