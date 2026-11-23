import { LOCALES, normalizeLocale, type Locale } from 'shared/src/i18n';

/**
 * Locale of the current visit for surfaces that render outside the
 * `[locale]` segment — the root not-found page and the root-layout install
 * banner — where no I18nProvider is available. The URL wins: a `/ja/...`
 * path is Japanese whatever the browser says. Otherwise the browser's
 * accepted languages decide, and English is the last resort.
 */
export function resolveRequestLocale(pathname?: string | null, languages: readonly string[] = []): Locale {
  const firstSegment = (pathname || '').split('/').filter(Boolean)[0];
  if (firstSegment && (LOCALES as readonly string[]).includes(firstSegment)) return firstSegment as Locale;

  for (const tag of languages) {
    if (!tag) continue;
    // zh-TW / zh-HK / zh-MO are Traditional; every other Chinese tag is Simplified.
    const base = tag.toLowerCase().split(',')[0].trim();
    if (base.startsWith('zh')) return /^zh-(tw|hk|mo)\b/i.test(base) ? 'zh-Hant' : 'zh-Hans';
    const primary = base.split('-')[0];
    const matched = (LOCALES as readonly string[]).find((locale) => locale === primary);
    if (matched) return matched as Locale;
  }
  return normalizeLocale(null);
}
