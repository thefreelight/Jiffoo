import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import {
  MINIMUM_REQUIRED_THEME_COMPONENTS,
  OFFICIAL_EMBEDDED_THEME_SLUGS,
  OFFICIAL_FULL_THEME_COMPONENTS,
  getMissingThemeComponents,
} from '@/lib/themes/contract';
import { BUILTIN_THEMES } from '@/lib/themes/registry';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../../..');

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

  it.each(OFFICIAL_EMBEDDED_THEME_SLUGS)(
    'ensures %s embeds its design tokens in the runtime bridge',
    (slug) => {
      // The registry imports each theme via src/runtime.ts. When that module
      // does not import tokens.css, the storefront renders the theme without
      // any --esim-* / design-token definitions (observed live on
      // easyeuicc.cc: the whole page fell back to unbranded black/white).
      const tokensPath = path.join(repoRoot, `packages/shop-themes/${slug}/src/tokens.css`);
      const runtimePath = path.join(repoRoot, `packages/shop-themes/${slug}/src/runtime.ts`);

      if (!existsSync(tokensPath)) {
        return;
      }

      expect(readFileSync(runtimePath, 'utf8')).toContain("import './tokens.css'");
    }
  );
});
