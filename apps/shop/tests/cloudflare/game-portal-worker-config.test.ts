import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { legacyRedirectTarget, parseLegacyRedirectRules } from '@/lib/legacy-redirects';

/**
 * The game portal's storefront workers. The theme is served as a packaged
 * runtime from the official extensions repository and is not part of this
 * build, so the worker config is where the deployment says which theme it
 * pins, what it indexes and what it lets the browser load. These checks keep
 * the two workers in step with each other; the pinned version and the SEO
 * declaration are copied here from the theme's manifest when it is published.
 */
const SLUG = 'game-portal';
const shopRoot = process.cwd();
const read = (file: string) => readFileSync(resolve(shopRoot, file), 'utf8');

/** The flat `[vars]` block of a wrangler file: name → literal value. */
function varsOf(file: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const line of read(file).split('\n')) {
    const match = line.match(/^([A-Z0-9_]+) = (".*"|'[^']*')\s*$/);
    if (match) vars[match[1]] = match[2].slice(1, -1);
  }
  return vars;
}

const PRODUCTION = 'wrangler.game-portal.toml';
const STAGING = 'wrangler.game-portal-staging.toml';
describe('game portal storefront workers', () => {
  const production = varsOf(PRODUCTION);
  const staging = varsOf(STAGING);

  it('pin the game portal theme, at one version, on the game portal’s own core API', () => {
    for (const vars of [production, staging]) {
      expect(vars.THEME_SLUG_PIN).toBe(SLUG);
      expect(vars.NEXT_PUBLIC_FALLBACK_THEME_SLUG).toBe(SLUG);
      // A published version of the theme: three numbers, no range.
      expect(vars.THEME_VERSION_PIN).toMatch(/^\d+\.\d+\.\d+$/);
      expect(vars.NEXT_PUBLIC_FALLBACK_THEME_VERSION).toBe(vars.THEME_VERSION_PIN);
      expect(vars.API_SERVICE_URL).toBe('https://game-api.jiffoo.com');
    }
    // The preview runs the version production will get.
    expect(staging.THEME_VERSION_PIN).toBe(production.THEME_VERSION_PIN);
  });

  it('carry the theme’s SEO declaration for every page the storefront routes', () => {
    // Copied by hand from the theme manifest's `x-jiffoo-seo` when the theme is published.
    const declaration = JSON.parse(production.SHOP_THEME_SEO) as Record<string, unknown>;
    expect(declaration.slug).toBe(SLUG);
    for (const locale of ['en', 'zh-Hans']) {
      expect((declaration.default as Record<string, { title: string }>)[locale]?.title).toBeTruthy();
    }
    const pages = Object.keys(declaration.pages as object);
    for (const page of ['home', 'games', 'credits', 'help', 'contact', 'privacy', 'terms']) expect(pages, page).toContain(page);
    expect(declaration.dynamicPages).toEqual([expect.objectContaining({ path: '/games/:id', idField: 'id', items: 'games' })]);
    expect(staging.SHOP_THEME_SEO).toBe(production.SHOP_THEME_SEO);
    // A worker variable is capped at 5 KB.
    expect(production.SHOP_THEME_SEO.length).toBeLessThan(4096);
  });

  it('are a Chinese-only storefront that answers the old addresses with one redirect', () => {
    expect(production.NEXT_PUBLIC_FALLBACK_SUPPORTED_LOCALES).toBe('zh-Hans');
    const rules = parseLegacyRedirectRules(production.SHOP_LEGACY_REDIRECTS);
    expect(legacyRedirectTarget(rules, '/game/2048', 'zh-Hans')).toBe('/zh-Hans/games/2048');
    expect(legacyRedirectTarget(rules, '/category/puzzle', 'zh-Hans')).toBe('/zh-Hans/games?category=puzzle');
    expect(legacyRedirectTarget(rules, '/picks', 'zh-Hans')).toBe('/zh-Hans/games');
  });

  it('keep the preview out of search indexes and give each worker its own domain', () => {
    expect(staging.SHOP_NOINDEX).toBe('1');
    expect(production.SHOP_NOINDEX).toBeUndefined();
    expect(read(PRODUCTION)).toMatch(/^pattern = "game\.jiffoo\.com"$/m);
    expect(read(STAGING)).toMatch(/^pattern = "game-staging\.jiffoo\.com"$/m);
    expect(read(STAGING)).not.toContain('pattern = "game.jiffoo.com"');
    for (const file of [PRODUCTION, STAGING]) {
      expect(read(file)).toMatch(/bucket_name = "jiffoo-game-assets"/);
      expect(varsOf(file).NEXT_PUBLIC_FALLBACK_POWERED_BY_JIFFOO).toBe('0');
    }
  });

  it('are built with the session kept off the family cookie and the third-party origins allowed', () => {
    // Both are compiled into the worker, so they belong to the build command, not the config.
    const scripts = JSON.parse(read('package.json')).scripts as Record<string, string>;
    const build = scripts['workers:build:game-portal'];
    expect(build).toContain('NEXT_PUBLIC_AUTH_PARENT_DOMAIN_COOKIE=0');
    expect(build).toContain('SHOP_CSP_EXTRA_SCRIPT_SRC=https://pagead2.googlesyndication.com');
    expect(build).toContain('https://html5.gamemonetize.co');
    expect(build).toContain('https://game-assets.jiffoo.com');
    expect(build).toContain('next build --webpack');
    expect(scripts['workers:deploy:game-portal-staging']).toContain('wrangler.game-portal-staging.toml');
  });
});
