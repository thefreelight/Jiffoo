import de from './de.json';
import fr from './fr.json';
import ja from './ja.json';
import ko from './ko.json';

/**
 * Theme message catalog for the storefront locales that carry no inline copy.
 *
 * Components keep their copy inline as `pickCopy(locale, { en, hans, hant })`.
 * This catalog extends that to Japanese, Korean, French and German without
 * touching every call site: it maps the English source string to its
 * translation, the way a gettext catalog keys messages by their source. An
 * explicit `ja` / `ko` / `fr` / `de` entry at the call site still wins.
 *
 * One flat key/value table per locale is also the shape the Store
 * Localization (i18n) plugin imports and exports, so these entries can be
 * lifted into the plugin unchanged.
 */
export type CatalogLocale = 'ja' | 'ko' | 'fr' | 'de';

export const CATALOG_LOCALES: readonly CatalogLocale[] = ['ja', 'ko', 'fr', 'de'];

export const THEME_MESSAGES: Record<CatalogLocale, Record<string, string>> = { ja, ko, fr, de };

function isCatalogLocale(locale: string | undefined): locale is CatalogLocale {
  return locale === 'ja' || locale === 'ko' || locale === 'fr' || locale === 'de';
}

/** Translation of an English source string, or null when the catalog has none. */
export function themeMessage(locale: string | undefined, english: string): string | null {
  if (!isCatalogLocale(locale)) return null;
  const hit = THEME_MESSAGES[locale][english];
  return typeof hit === 'string' && hit ? hit : null;
}
