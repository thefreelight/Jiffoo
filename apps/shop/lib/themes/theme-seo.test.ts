/**
 * Page metadata declared by theme packs (lib/themes/theme-seo.ts) — uses the real modules.
 */
import { describe, expect, it } from 'vitest';
import esimRouteManifest from '@shop-themes/esim/theme-pack/theme.json';
import { getDeclaredThemeSeo } from '@/lib/themes/theme-seo';
import { getThemeMeta } from '@/lib/themes/registry';

describe('declared theme page metadata', () => {
  it('exposes exactly what the eSIM pack declares in its manifest', () => {
    expect(getDeclaredThemeSeo('esim')).toEqual(esimRouteManifest['x-jiffoo-seo'].pages);
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
