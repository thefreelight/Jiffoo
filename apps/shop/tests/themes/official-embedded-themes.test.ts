import { describe, expect, it } from 'vitest';
import {
  MINIMUM_REQUIRED_THEME_COMPONENTS,
  OFFICIAL_EMBEDDED_THEME_SLUGS,
  OFFICIAL_FULL_THEME_COMPONENTS,
  getMissingThemeComponents,
} from '@/lib/themes/contract';
import { BUILTIN_THEMES } from '@/lib/themes/registry';

describe('embedded theme contract', () => {
  it.each(['builtin-default', ...OFFICIAL_EMBEDDED_THEME_SLUGS])(
    'ensures %s satisfies the minimum storefront theme contract',
    async (slug) => {
      const themePackage = await BUILTIN_THEMES[slug].load();

      expect(getMissingThemeComponents(themePackage, MINIMUM_REQUIRED_THEME_COMPONENTS)).toEqual([]);
    }
  );

  it.each(OFFICIAL_EMBEDDED_THEME_SLUGS)(
    'ensures %s satisfies the official full-theme launch contract',
    async (slug) => {
      const themePackage = await BUILTIN_THEMES[slug].load();

      expect(getMissingThemeComponents(themePackage, OFFICIAL_FULL_THEME_COMPONENTS)).toEqual([]);
    }
  );
});
