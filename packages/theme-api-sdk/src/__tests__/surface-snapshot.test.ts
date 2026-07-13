/**
 * Theme SDK API Surface Snapshot Test (Task 6.1.2)
 *
 * This test verifies that the committed API surface snapshot matches
 * the actual code-generated surface. If this test fails in CI, it means
 * someone changed the public API without updating the snapshot.
 *
 * To fix:
 *   pnpm --filter @jiffoo/theme-api-sdk surface:generate
 *   # Then commit the updated snapshot with a changeset
 */

import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const PKG_ROOT = join(__dirname, '..', '..');
const SNAPSHOT_FILE = join(PKG_ROOT, 'snapshots', 'api-surface.d.ts');

describe('Theme SDK API Surface Snapshot', () => {
  it('snapshot file should exist', () => {
    expect(existsSync(SNAPSHOT_FILE)).toBe(true);
  });

  it('snapshot should match actual API surface', () => {
    // Run the check command — exits 0 if match, 1 if mismatch
    let exitCode = 0;
    let stderr = '';
    try {
      execSync('node scripts/generate-theme-surface.cjs --check', {
        cwd: PKG_ROOT,
        stdio: 'pipe',
        encoding: 'utf-8',
      });
    } catch (err: any) {
      exitCode = err.status ?? 1;
      stderr = err.stderr?.toString() || err.stdout?.toString() || '';
    }

    if (exitCode !== 0) {
      console.error('API surface mismatch detected!');
      console.error(stderr);
    }

    expect(exitCode).toBe(0);
  });

  it('snapshot should contain theme-api-sdk exports', () => {
    const content = readFileSync(SNAPSHOT_FILE, 'utf-8');
    // Verify key exports are present
    expect(content).toContain('createThemeApiClient');
    expect(content).toContain('ThemeApiClient');
    expect(content).toContain('ThemeApiClientOptions');
    expect(content).toContain('PageResult');
  });

  it('snapshot should contain theme type definitions', () => {
    const content = readFileSync(SNAPSHOT_FILE, 'utf-8');
    // Verify key theme types are present
    expect(content).toContain('ThemePackage');
    expect(content).toContain('ThemeConfig');
    expect(content).toContain('HomePageProps');
    expect(content).toContain('ProductsPageProps');
    expect(content).toContain('CartPageProps');
    expect(content).toContain('CheckoutPageProps');
    expect(content).toContain('HeaderProps');
    expect(content).toContain('FooterProps');
  });

  it('snapshot should have DO NOT EDIT header', () => {
    const content = readFileSync(SNAPSHOT_FILE, 'utf-8');
    expect(content).toContain('DO NOT EDIT MANUALLY');
  });
});
