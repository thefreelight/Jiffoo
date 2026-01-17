/**
 * Messages Module
 * 
 * Provides message loading and aggregation for all locales.
 * Supports lazy loading and namespace-based organization.
 */

import type { Locale } from '../config';
import type { Messages, AppName } from '../types';

import * as enMessages from './en';
import * as zhHantMessages from './zh-Hant';

/**
 * All messages organized by locale
 *
 * Note: For backward compatibility, we include both:
 * - 'tenant' namespace (for getMessages with appName='tenant')
 * - 'merchant' namespace (for direct merchant.* key lookups)
 */
const allMessages: Record<Locale, Messages> = {
  en: {
    common: enMessages.common,
    shop: enMessages.shop,
    tenant: enMessages.merchant,
    merchant: enMessages.merchant, // Alias for backward compatibility with merchant.* keys
    agent: enMessages.agent,
    whiteLabel: enMessages.whiteLabel,
  },
  'zh-Hans': {
    common: zhHantMessages.common,
    shop: zhHantMessages.shop,
    tenant: zhHantMessages.merchant,
    merchant: zhHantMessages.merchant, // Alias for backward compatibility with merchant.* keys
    agent: zhHantMessages.agent,
    whiteLabel: zhHantMessages.whiteLabel,
  },
};

/**
 * Get all messages for a specific locale
 * @param locale - The locale to get messages for
 * @returns All messages for the locale
 */
export function getAllMessages(locale: Locale): Messages {
  return allMessages[locale] || allMessages.en;
}

/**
 * Get messages for a specific locale and app
 * Only includes common messages and app-specific messages
 * @param locale - The locale to get messages for
 * @param appName - The app name to filter messages for
 * @returns Filtered messages for the app
 */
export function getMessages(locale: Locale, appName?: AppName): Messages {
  const messages = allMessages[locale] || allMessages.en;

  if (!appName) {
    return messages;
  }

  // Return only common and app-specific messages
  // For tenant app, also include merchant namespace for backward compatibility
  const result: Messages = {
    common: messages.common,
    [appName]: messages[appName],
  };

  // If requesting tenant messages, also include merchant alias
  // This allows both tenant.* and merchant.* keys to work
  if (appName === 'tenant' && messages.merchant) {
    result.merchant = messages.merchant;
  }

  return result;
}

/**
 * Get a specific namespace of messages
 * @param locale - The locale to get messages for
 * @param namespace - The namespace to get
 * @returns Messages for the namespace
 */
export function getNamespaceMessages(
  locale: Locale,
  namespace: keyof Messages
): Messages[keyof Messages] {
  const messages = allMessages[locale] || allMessages.en;
  return messages[namespace];
}

