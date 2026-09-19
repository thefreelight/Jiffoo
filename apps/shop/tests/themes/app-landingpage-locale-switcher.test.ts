import { describe, expect, it } from 'vitest';
import { THEME_LOCALE_CODES, stripLocalePrefix } from '@shop-themes/app-landingpage/src/lib/locales';

describe('app-landingpage language switcher helpers', () => {
  it('covers the seven storefront locales', () => {
    expect(THEME_LOCALE_CODES).toEqual(['en', 'zh-Hans', 'zh-Hant', 'es', 'fr', 'de', 'ja']);
  });

  it('strips every supported locale prefix from storefront paths', () => {
    for (const code of THEME_LOCALE_CODES) {
      expect(stripLocalePrefix(`/${code}`)).toBe('/');
      expect(stripLocalePrefix(`/${code}/privacy`)).toBe('/privacy');
    }
  });

  it('keeps paths that only start with a locale-like prefix', () => {
    expect(stripLocalePrefix('/esoteric')).toBe('/esoteric');
    expect(stripLocalePrefix('/framing')).toBe('/framing');
    expect(stripLocalePrefix('/downloads')).toBe('/downloads');
  });
});
