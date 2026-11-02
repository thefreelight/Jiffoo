// API Types
export { formatStoreTimestamp, formatStoreDate, isStoreTimezone, storeTimezones, storeLocalToUtc } from './store-time';
export * from './error-codes';
export { PRODUCT_CODE_GENERATION } from './product-codes';
export * from './types/api';
export * from './types/auth';
export * from './types/user';
export * from './types/product';
export * from './types/order';
export * from './types/cart';
export * from './types/common';
export * from './extensions/plugin-contract';
export * from './extensions/service-schema';
export * from './extensions/plugin-config-schema';
export * from './extensions/theme-contract';
export * from './extensions/theme-css';
export * from './extensions/theme-font-faces';
export * from './extensions/storefront-code';
export * from './extensions/contracts';

export * from './events/registry';

// Admin list preferences (saved views and custom columns)
export * from './admin-list-preferences';

// Validation Schemas
export * from './schemas/auth';
export * from './schemas/product';
export * from './schemas/order';

// Utilities
export * from './utils/constants';
export * from './utils/helpers';
export * from './utils/validation';

// i18n - Internationalization
// Note: React components require 'use client' directive
// For server-side use, import config/messages directly from './i18n/config' or './i18n/messages'
//
// The barrel carries the locale configuration, the types and the middleware, but not the message
// catalogue. The catalogue is assembled per locale, so a consumer of the barrel that carried it
// would reach every label of every namespace, and a change to one label of one namespace would
// select every suite of every application. A consumer that reads a label imports the module of
// that label.
export {
  LOCALES,
  DEFAULT_LOCALE,
  LOCALE_CONFIG,
  isSupportedLocale,
  mapBrowserLanguageToLocale,
  getLocaleFromAcceptLanguage,
  normalizeLocale,
  type Locale,
} from './i18n/config';
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
} from './i18n/types';
export {
  getLocaleFromPathname,
  shouldSkipLocaleHandling,
  getLocaleRedirectUrl,
  removeLocaleFromPathname,
  addLocaleToPathname,
  localeMiddlewareConfig,
} from './i18n/middleware';

// Logger - Not exported here, choose based on environment:
// - Browser environment: import from 'shared/src/logger/index.browser'
// - Node.js environment: import from 'shared/src/logger'

// Security - Security module
// Only use in Node.js environment, contains crypto dependencies
// import { RateLimiter, CircuitBreaker, ... } from '@shared/security'
