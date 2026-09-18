import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const themesRoot = path.resolve(__dirname, '../../../packages/shop-themes');

// The registry statically bundles every embedded theme's tokens.css, so a
// bare element selector there restyles ALL storefronts (observed live:
// bokmoo's dark body background flashed during easyeuicc.cc locale
// switches after the tokens embed landed). Theme-wide element rules must
// be scoped under body[data-theme='<slug>']; the root layout renders
// data-theme from the active store theme slug.
const BARE_GLOBAL_SELECTOR = /^(body|html|h[1-6]|::selection|\*)\s*[,{]/;

describe('theme tokens hygiene', () => {
  it.each(readdirSync(themesRoot).sort())(
    '%s tokens.css has no bare global element rules',
    (slug) => {
      const tokensPath = path.join(themesRoot, slug, 'src/tokens.css');
      if (!existsSync(tokensPath)) {
        return;
      }

      const offenders = readFileSync(tokensPath, 'utf8')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => BARE_GLOBAL_SELECTOR.test(line));

      expect(
        offenders,
        `${slug}/src/tokens.css must scope global element rules under body[data-theme='<slug>']`
      ).toEqual([]);
    }
  );
});
