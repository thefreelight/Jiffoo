import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  OFFICIAL_FULL_THEME_COMPONENTS,
  getMissingThemeComponents,
} from '@/lib/themes/contract';
import { BUILTIN_THEMES } from '@/lib/themes/registry';
import { OFFICIAL_LAUNCH_EXTENSIONS } from 'shared/src/extensions/official-catalog';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../../..');
const EMBEDDED_OFFICIAL_RUNTIME_SLUGS = ['esim-mall', 'imagic-studio', 'yevbi'] as const;
const PACKAGED_RUNTIME_THEME_SLUGS = ['bokmoo', 'imagic-studio', 'modelsfind', 'navtoai', 'yevbi'] as const;

function readJson(relativePath: string) {
  return JSON.parse(readFileSync(path.join(repoRoot, relativePath), 'utf8'));
}

describe('esim-mall embedded official runtime registry', () => {
  it('loads the generic esim-mall runtime from the shop theme registry', async () => {
    const themePackage = await BUILTIN_THEMES['esim-mall'].load();

    expect(themePackage.components.HomePage).toBeTruthy();
    expect(getMissingThemeComponents(themePackage, OFFICIAL_FULL_THEME_COMPONENTS)).toEqual([]);
  });

  it('keeps embedded official runtime versions aligned with catalog and theme-pack manifests', () => {
    for (const slug of EMBEDDED_OFFICIAL_RUNTIME_SLUGS) {
      const registryEntry = BUILTIN_THEMES[slug];
      const catalogEntry = OFFICIAL_LAUNCH_EXTENSIONS.find((entry) => (
        entry.kind === 'theme'
        && entry.slug === slug
      ));
      const packageJson = readJson(`packages/shop-themes/${slug}/package.json`);
      const themeManifest = readJson(`packages/shop-themes/${slug}/theme-pack/theme.json`);

      expect(catalogEntry, `${slug} official catalog entry`).toBeTruthy();
      expect(registryEntry?.meta.version, `${slug} registry version`).toBe(catalogEntry?.version);
      expect(packageJson.version, `${slug} package.json version`).toBe(catalogEntry?.version);
      expect(themeManifest.version, `${slug} theme-pack manifest version`).toBe(catalogEntry?.version);
      expect(themeManifest.slug, `${slug} theme-pack slug`).toBe(slug);
      expect(themeManifest['x-jiffoo-renderer-mode'], `${slug} renderer mode`).toBe('embedded');
      expect(themeManifest['x-jiffoo-renderer-slug'], `${slug} renderer slug`).toBe(slug);
      expect(catalogEntry?.packageUrl, `${slug} packageUrl`).toContain(`/${slug}/${catalogEntry?.version}.jtheme`);
    }
  });

  it('requires installed runtime-capable theme packs to ship a versioned runtime bundle', () => {
    for (const slug of PACKAGED_RUNTIME_THEME_SLUGS) {
      const packageJson = readJson(`packages/shop-themes/${slug}/package.json`);
      const themeManifest = readJson(`packages/shop-themes/${slug}/theme-pack/theme.json`);
      const runtimeSourcePath = path.join(repoRoot, `packages/shop-themes/${slug}/src/runtime.ts`);
      const catalogEntry = OFFICIAL_LAUNCH_EXTENSIONS.find((entry) => (
        entry.kind === 'theme'
        && entry.slug === slug
      ));

      expect(catalogEntry, `${slug} official catalog entry`).toBeTruthy();
      expect(existsSync(runtimeSourcePath), `${slug} runtime source`).toBe(true);
      expect(themeManifest.slug, `${slug} theme-pack slug`).toBe(slug);
      expect(themeManifest.version, `${slug} theme-pack manifest version`).toBe(packageJson.version);
      expect(catalogEntry?.version, `${slug} official catalog version`).toBe(packageJson.version);
      expect(catalogEntry?.packageUrl, `${slug} packageUrl`).toContain(`/${slug}/${packageJson.version}.jtheme`);
      expect(themeManifest.entry?.runtimeJS, `${slug} packaged runtime`).toBe('runtime/theme-runtime.js');
    }
  });

  it('keeps Bokmoo account pages on the Bokmoo theme instead of the default auth UI', async () => {
    const themePackage = await import('@shop-themes/bokmoo/src/runtime');
    const runtimeSource = readFileSync(
      path.join(repoRoot, 'packages/shop-themes/bokmoo/src/runtime.ts'),
      'utf8',
    );
    const indexSource = readFileSync(
      path.join(repoRoot, 'packages/shop-themes/bokmoo/src/index.ts'),
      'utf8',
    );

    expect(themePackage.theme.components.LoginPage).toBeTruthy();
    expect(existsSync(path.join(repoRoot, 'packages/shop-themes/bokmoo/src/components/LoginPage.tsx'))).toBe(true);
    expect(runtimeSource).toContain("import { LoginPage } from './components/LoginPage';");
    expect(indexSource).toContain("import { LoginPage } from './components/LoginPage';");
    expect(runtimeSource).not.toContain("@shop-themes/default/src/components/LoginPage");
    expect(indexSource).not.toContain("@shop-themes/default/src/components/LoginPage");
  });

  it('loads the explicit Bokmoo fallback renderer from the shop theme registry', async () => {
    const themePackage = await BUILTIN_THEMES['bokmoo'].load();

    expect(themePackage.components.LoginPage).toBeTruthy();
    expect(themePackage.components.RegisterPage).toBeTruthy();
    expect(getMissingThemeComponents(themePackage, OFFICIAL_FULL_THEME_COMPONENTS)).toEqual([]);
  });
});
