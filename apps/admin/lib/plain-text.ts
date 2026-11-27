import { getMessages } from 'shared/src/i18n';
import { isSupportedLocale } from 'shared/src/i18n/config';

/**
 * A line of copy for code that runs outside React — a store action, the page that replaces everything after a
 * crash. There is no context to ask, so the dictionary is read directly and the language is taken from the address.
 * The English given with the key is what comes back when neither is at hand.
 */
export function plainText(key: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const asked = window.location.pathname.split('/')[1] ?? 'en';
  const messages = getMessages(isSupportedLocale(asked) ? asked : 'en');
  for (const namespace of Object.values(messages)) {
    let value: unknown = namespace;
    for (const part of key.split('.')) {
      if (value === null || typeof value !== 'object') {
        value = undefined;
        break;
      }
      value = (value as Record<string, unknown>)[part];
    }
    if (typeof value === 'string') return value;
  }
  return fallback;
}
