import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { OFFICIAL_LAUNCH_EXTENSIONS } from 'shared/src/extensions/official-catalog';
import { BUILTIN_THEMES } from '@/lib/themes/registry';

/**
 * The bokmoo theme drifted silently (catalog 1.1.19 vs package 1.1.52) and
 * only surfaced as a red assertion inside a shared loop test. The esim theme
 * gets its own focused contract so its version alignment and packaged
 * runtime shape are enforced independently of other themes' drift.
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../../..');

function readJson(relativePath: string) {
  return JSON.parse(readFileSync(path.join(repoRoot, relativePath), 'utf8'));
}

describe('esim theme packaged runtime contract', () => {
  const catalogEntry = OFFICIAL_LAUNCH_EXTENSIONS.find((entry) => entry.kind === 'theme' && entry.slug === 'esim');
  const packageJson = readJson('packages/shop-themes/esim/package.json');
  const manifest = readJson('packages/shop-themes/esim/theme-pack/theme.json');

  it('keeps catalog, package.json, theme-pack manifest and registry versions aligned', () => {
    expect(catalogEntry, 'esim official catalog entry').toBeTruthy();
    expect(catalogEntry?.version).toBe(packageJson.version);
    expect(manifest.version).toBe(packageJson.version);
    expect(manifest.slug).toBe('esim');
    expect(BUILTIN_THEMES['esim']?.meta.version).toBe(packageJson.version);
    expect(catalogEntry?.packageUrl).toContain(`/esim/${packageJson.version}.jtheme`);
  });

  it('declares the embedded renderer and ships a versioned runtime bundle', () => {
    expect(manifest['x-jiffoo-renderer-mode']).toBe('embedded');
    expect(manifest['x-jiffoo-renderer-slug']).toBe('esim');
    expect(manifest.entry?.runtimeJS).toBe('runtime/theme-runtime.js');
    expect(existsSync(path.join(repoRoot, 'packages/shop-themes/esim/src/runtime.ts'))).toBe(true);
    expect(existsSync(path.join(repoRoot, 'packages/shop-themes/esim/theme-pack/runtime/theme-runtime.js'))).toBe(true);
  });

  it('scopes tokens under body[data-theme="esim"] with no bare global element rules', () => {
    const tokens = readFileSync(path.join(repoRoot, 'packages/shop-themes/esim/src/tokens.css'), 'utf8');
    expect(tokens).toContain("body[data-theme='esim']");
    const offenders = tokens
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^(body|html|h[1-6]|::selection|\*)\s*[,{]/.test(line));
    expect(offenders).toEqual([]);
  });
});
