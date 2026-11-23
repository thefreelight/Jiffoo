/**
 * Translations managed by the Store Localization (i18n) plugin.
 *
 * The theme's built-in copy is the default; rows the operator keeps in the
 * plugin win. The shop host registers a locale's `theme.*` namespaces on
 * `globalThis.__JIFFOO_THEME_I18N__` before it renders — on the server for
 * the embedded runtime, in the page before hydration for the remote runtime
 * bundle — so both instances of this module read one table without sharing
 * module state. Keys are the English source strings, the same keys the
 * built-in catalog uses.
 *
 * The host side of this contract lives in apps/shop/lib/theme-i18n.ts.
 */
export const THEME_I18N_NAMESPACE = 'theme.esim';

type MessageTable = Record<string, Record<string, string>>;

interface ThemeI18nRegistry {
  messages: Record<string, MessageTable>;
}

const REGISTRY_KEY = '__JIFFOO_THEME_I18N__';

function registry(): ThemeI18nRegistry | undefined {
  return (globalThis as unknown as Record<string, unknown>)[REGISTRY_KEY] as ThemeI18nRegistry | undefined;
}

/** Plugin-managed translation of an English source string, or null when the plugin has none. */
export function pluginMessage(locale: string | undefined, english: string): string | null {
  const value = registry()?.messages?.[locale || 'en']?.[THEME_I18N_NAMESPACE]?.[english];
  return typeof value === 'string' && value.trim() ? value : null;
}
