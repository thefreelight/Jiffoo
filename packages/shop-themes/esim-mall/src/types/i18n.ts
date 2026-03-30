/**
 * i18n Type Definitions for eSIM Mall Theme
 * Standalone types for internationalization support
 */

/**
 * Supported locale codes
 */
export type Locale = 'en' | 'zh-Hant';

/**
 * Translation function type
 * @param key - The translation key (e.g., 'shop.cart.title')
 * @param params - Optional interpolation parameters
 * @returns The translated string
 */
export type TranslationFunction = (
  key: string,
  params?: Record<string, string | number>
) => string;
