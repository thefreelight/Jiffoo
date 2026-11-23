import { describe, expect, it } from 'vitest';

import { LOCALES } from 'shared/src/i18n';
import { resolveRequestLocale } from '@/lib/request-locale';
import { PWA_BANNER_COPY } from '@/components/pwa-install-banner';

describe('resolveRequestLocale', () => {
  it.each([
    ['/en', 'en'],
    ['/zh-Hans/products', 'zh-Hans'],
    ['/zh-Hant', 'zh-Hant'],
    ['/ja/auth/login', 'ja'],
    ['/ko/orders/ord_1', 'ko'],
    ['/fr', 'fr'],
    ['/de/terms', 'de'],
  ])('takes the locale from the URL: %s -> %s', (pathname, expected) => {
    expect(resolveRequestLocale(pathname, ['en-US', 'en'])).toBe(expected);
  });

  it.each([
    [['fr-FR', 'fr', 'en'], 'fr'],
    [['de-DE', 'de'], 'de'],
    [['ja-JP'], 'ja'],
    [['ko-KR'], 'ko'],
    [['zh-TW'], 'zh-Hant'],
    [['zh-HK'], 'zh-Hant'],
    [['zh-MO'], 'zh-Hant'],
    [['zh-CN'], 'zh-Hans'],
    [['zh'], 'zh-Hans'],
    [['zh-Hans-CN'], 'zh-Hans'],
    [['en-US', 'en'], 'en'],
  ])('falls back to the first supported browser language: %j', (languages, expected) => {
    expect(resolveRequestLocale('/no-such-page', languages)).toBe(expected);
  });

  it('answers English when nothing indicates a language', () => {
    expect(resolveRequestLocale('/no-such-page', [])).toBe('en');
    expect(resolveRequestLocale('/no-such-page', ['es-ES', 'es'])).toBe('en');
    expect(resolveRequestLocale(null, undefined)).toBe('en');
    expect(resolveRequestLocale(undefined, [''])).toBe('en');
  });
});

describe('install banner copy', () => {
  it('speaks every storefront locale with the same set of strings', () => {
    for (const locale of LOCALES) {
      const copy = PWA_BANNER_COPY[locale];
      for (const value of Object.values(copy)) expect(value.trim(), `${locale}`).not.toBe('');
    }
    // One language per locale: no CJK in the Latin-script locales, no Latin sentence in the others.
    expect(PWA_BANNER_COPY.fr.message).not.toMatch(/[\u3400-\u9fff\u3040-\u30ff]/);
    expect(PWA_BANNER_COPY.de.message).not.toMatch(/[\u3400-\u9fff\u3040-\u30ff]/);
    expect(PWA_BANNER_COPY.ja.message).toMatch(/[\u3040-\u30ff]/);
    expect(PWA_BANNER_COPY.ko.message).toMatch(/[\uac00-\ud7af]/);
    expect(PWA_BANNER_COPY.ko.message).not.toMatch(/[\u3400-\u9fff]/);
  });
});
