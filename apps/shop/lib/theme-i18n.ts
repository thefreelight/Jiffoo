/**
 * Store Localization (i18n) plugin -> theme copy.
 *
 * Themes ship built-in copy; the plugin's `i18n_translations` rows are the
 * operator's overrides. Namespaces named `theme.<slug>` hold them, keyed by
 * the theme's English source strings. The host registers a locale's table on
 * `globalThis.__JIFFOO_THEME_I18N__` before anything renders, so the theme's
 * embedded runtime (server) and its remote runtime bundle (browser) read one
 * table without sharing module state. The theme side of this contract is
 * packages/shop-themes/esim/src/i18n/overlay.ts.
 *
 * This module is client-safe (the registrar component imports it); the
 * server-side fetch lives in lib/theme-i18n-server.ts.
 */

/** namespace -> (English source string -> translation) */
export type ThemeMessageTable = Record<string, Record<string, string>>;

interface ThemeI18nRegistry {
  messages: Record<string, ThemeMessageTable>;
}

const REGISTRY_KEY = '__JIFFOO_THEME_I18N__';
const THEME_NAMESPACE_PREFIX = 'theme.';

/** Publishes one locale's table. Replaces the locale's previous table as a whole. */
export function registerThemeMessages(locale: string, table: ThemeMessageTable): void {
  const root = globalThis as unknown as Record<string, unknown>;
  const registry = (root[REGISTRY_KEY] as ThemeI18nRegistry | undefined) ?? { messages: {} };
  registry.messages[locale] = table;
  root[REGISTRY_KEY] = registry;
}

/** The `theme.*` namespaces of the plugin's merged messages for a locale, or null when there are none. */
export function pickThemeNamespaces(
  messages: Record<string, Record<string, string>> | null | undefined,
): ThemeMessageTable | null {
  if (!messages || typeof messages !== 'object') return null;
  const table: ThemeMessageTable = {};
  for (const [namespace, entries] of Object.entries(messages)) {
    if (namespace.startsWith(THEME_NAMESPACE_PREFIX) && entries && typeof entries === 'object') {
      table[namespace] = Object.fromEntries(Object.entries(entries).filter(([, value]) => typeof value === 'string'));
    }
  }
  return Object.keys(table).length > 0 ? table : null;
}
