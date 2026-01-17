/**
 * i18n Type Definitions
 *
 * Core types for the i18n system including locale types,
 * message types, and configuration interfaces.
 */

import type { Locale } from './config';

// Re-export Locale type for convenience
export type { Locale };

/**
 * Application names for namespace organization
 */
export type AppName = 'tenant' | 'agent' | 'shop' | 'whiteLabel';

/**
 * Message namespace identifiers
 * - common: Cross-app common messages (buttons, system prompts, error states)
 * - tenant: Tenant-specific messages
 * - merchant: Alias for tenant (backward compatibility with merchant.* keys)
 * - agent: Agent portal messages
 * - shop: Shop frontend messages
 * - whiteLabel: White-label studio messages
 */
export type MessageNamespace = 'common' | 'merchant' | AppName;

/**
 * Nested message object structure
 * Supports deeply nested message keys like 'auth.login.title'
 */
export type MessageObject = {
  [key: string]: string | MessageObject;
};

/**
 * Messages for all namespaces
 */
export type Messages = {
  [K in MessageNamespace]?: MessageObject;
};

/**
 * Translation function type
 */
export type TranslationFunction = (
  key: string,
  params?: Record<string, string | number>
) => string;

/**
 * i18n Provider props
 */
export interface I18nProviderProps {
  locale: Locale;
  messages: Messages;
  children: React.ReactNode;
}

/**
 * i18n context value
 */
export interface I18nContextValue {
  locale: Locale;
  messages: Messages;
  t: TranslationFunction;
}

/**
 * Mall context locale fields
 * These fields should be added to the Mall Context response
 */
export interface MallContextLocaleFields {
  /** Default locale for the tenant (currently always 'en') */
  defaultLocale: Locale;
  /** Supported locales for the tenant (currently always ['en', 'zh-Hant']) */
  supportedLocales: Locale[];
}

/**
 * Locale params from Next.js dynamic routes
 */
export interface LocaleParams {
  locale: string;
}

/**
 * Locale layout props for Next.js layouts
 */
export interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<LocaleParams>;
}

/**
 * Locale page props for Next.js pages
 */
export interface LocalePageProps {
  params: Promise<LocaleParams>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Language switcher item
 */
export interface LanguageSwitcherItem {
  locale: Locale;
  name: string;
  nativeName: string;
  href: string;
  isActive: boolean;
}

