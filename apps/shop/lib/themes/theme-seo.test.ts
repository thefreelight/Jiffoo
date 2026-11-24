/**
 * Page metadata declared by theme packs (lib/themes/theme-seo.ts) — uses the real modules.
 */
import { describe, expect, it } from 'vitest';
import esimRouteManifest from '@shop-themes/esim/theme-pack/theme.json';
import { DEFAULT_THEME_SEO_ROUTE, getDeclaredThemeSeo } from '@/lib/themes/theme-seo';
import { getThemeMeta } from '@/lib/themes/registry';

const declared = esimRouteManifest['x-jiffoo-seo'];

describe('declared theme page metadata', () => {
  it('exposes the default under its own key, next to exactly what the eSIM pack declares per route', () => {
    expect(getDeclaredThemeSeo('esim')).toEqual({ [DEFAULT_THEME_SEO_ROUTE]: declared.default, ...declared.pages });
    expect(DEFAULT_THEME_SEO_ROUTE).toBe('default');
  });

  it('exposes only complete locale entries', () => {
    for (const [target, locales] of Object.entries(getDeclaredThemeSeo('esim') ?? {})) {
      expect(locales.en, target).toBeDefined();
      for (const [locale, entry] of Object.entries(locales)) {
        expect(typeof entry?.title, `${target} ${locale} title`).toBe('string');
        expect(typeof entry?.description, `${target} ${locale} description`).toBe('string');
      }
    }
  });

  it('answers undefined for a pack without declarations and for anything that is not a theme', () => {
    expect(getDeclaredThemeSeo('bokmoo')).toBeUndefined();
    expect(getDeclaredThemeSeo('not-a-theme')).toBeUndefined();
    // Inherited object keys must not leak a value.
    expect(getDeclaredThemeSeo('constructor')).toBeUndefined();
    expect(getDeclaredThemeSeo('__proto__')).toBeUndefined();
  });

  it('is the same table the registry exposes as ThemeMeta.seo', () => {
    expect(getThemeMeta('esim')?.seo).toBe(getDeclaredThemeSeo('esim'));
    expect(getThemeMeta('bokmoo')?.seo).toBeUndefined();
  });
});
