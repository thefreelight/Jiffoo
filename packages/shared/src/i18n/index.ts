/**
 * i18n Module
 * 
 * Unified internationalization module for the Jiffoo Mall platform.
 * Provides locale configuration, message loading, and React integration.
 * 
 * Supported languages:
 * - en: English (default)
 * - zh-Hant: Traditional Chinese
 * 
 * All zh-* browser languages map to zh-Hant.
 */

// Configuration exports
export {
  LOCALES,
  DEFAULT_LOCALE,
  LOCALE_CONFIG,
  isSupportedLocale,
  mapBrowserLanguageToLocale,
  getLocaleFromAcceptLanguage,
  normalizeLocale,
  type Locale,
} from './config';

// Type exports
export type {
  AppName,
  MessageNamespace,
  MessageObject,
  Messages,
  TranslationFunction,
  I18nProviderProps,
  I18nContextValue,
  MallContextLocaleFields,
  LocaleParams,
  LocaleLayoutProps,
  LocalePageProps,
  LanguageSwitcherItem,
} from './types';

// Message exports
export { getAllMessages, getMessages, getNamespaceMessages } from './messages';

// React exports
export {
  I18nProvider,
  useI18n,
  useLocale,
  useTranslation,
  useT,
  LanguageSwitcher,
  getLanguageSwitcherItems,
  useLanguageSwitcher,
} from './react';

// Middleware exports
export {
  getLocaleFromPathname,
  shouldSkipLocaleHandling,
  getLocaleRedirectUrl,
  removeLocaleFromPathname,
  addLocaleToPathname,
  localeMiddlewareConfig,
} from './middleware';

