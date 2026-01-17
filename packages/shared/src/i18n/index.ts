/**
 * i18n Module (Server-Safe)
 * 
 * Unified internationalization module for the Jiffoo Mall platform.
 * Provides locale configuration, message loading, and middleware utilities.
 * 
 * Supported languages:
 * - en: English (default)
 * - zh-Hant: Traditional Chinese
 * 
 * All zh-* browser languages map to zh-Hant.
 * 
 * IMPORTANT: For React components and hooks, import from 'shared/src/i18n/react':
 * 
 *   import { useT, useLocale, I18nProvider } from 'shared/src/i18n/react';
 * 
 * This module only exports server-safe utilities to avoid client/server boundary issues.
 */

// Configuration exports (server-safe)
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

// Type exports (server-safe)
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

// Message exports (server-safe)
export { getAllMessages, getMessages, getNamespaceMessages } from './messages';

// Middleware exports (server-safe)
export {
  getLocaleFromPathname,
  shouldSkipLocaleHandling,
  getLocaleRedirectUrl,
  removeLocaleFromPathname,
  addLocaleToPathname,
  localeMiddlewareConfig,
} from './middleware';

