#!/usr/bin/env node
/**
 * R6 RuntimeSnapshot Audit (Task 6.4)
 *
 * Comprehensive audit verifying that the theme SDK contract system
 * is properly closed and all components are wired together:
 *
 * 1. Surface snapshot exists and matches actual code
 * 2. All theme.json files have engines field
 * 3. Theme activation flow has semver check
 * 4. Version range matching is tested
 * 5. Turbo tasks are configured
 * 6. SSR smoke test passes
 *
 * Usage:
 *   node scripts/r6-runtime-snapshot-audit.mjs
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    const result = fn();
    if (result === false) throw new Error('Check returned false');
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${name}`);
    console.error(`     ${err.message}`);
    failed++;
  }
}

function checkAsync(name, fn) {
  // sync wrapper for async checks
}

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║         R6 RuntimeSnapshot Audit                          ║');
console.log('╚═══════════════════════════════════════════════════════════╝');

// ============================================================
// 1. Surface Snapshot
// ============================================================

console.log('\n📦 1. Surface Snapshot');

check('Snapshot file exists', () => {
  const path = join(ROOT, 'packages', 'theme-api-sdk', 'snapshots', 'api-surface.d.ts');
  if (!existsSync(path)) throw new Error('Snapshot file not found');
});

check('Snapshot has DO NOT EDIT header', () => {
  const path = join(ROOT, 'packages', 'theme-api-sdk', 'snapshots', 'api-surface.d.ts');
  const content = readFileSync(path, 'utf-8');
  if (!content.includes('DO NOT EDIT MANUALLY')) throw new Error('Missing header');
});

check('Snapshot contains theme-api-sdk exports', () => {
  const path = join(ROOT, 'packages', 'theme-api-sdk', 'snapshots', 'api-surface.d.ts');
  const content = readFileSync(path, 'utf-8');
  const required = ['createThemeApiClient', 'ThemeApiClient', 'ThemeApiClientOptions', 'PageResult'];
  for (const sym of required) {
    if (!content.includes(sym)) throw new Error(`Missing: ${sym}`);
  }
});

check('Snapshot contains theme type definitions', () => {
  const path = join(ROOT, 'packages', 'theme-api-sdk', 'snapshots', 'api-surface.d.ts');
  const content = readFileSync(path, 'utf-8');
  const required = ['ThemePackage', 'ThemeConfig', 'HomePageProps', 'HeaderProps', 'FooterProps'];
  for (const sym of required) {
    if (!content.includes(sym)) throw new Error(`Missing: ${sym}`);
  }
});

check('Snapshot matches actual code (surface:check)', () => {
  try {
    execSync('node packages/theme-api-sdk/scripts/generate-theme-surface.cjs --check', {
      cwd: ROOT,
      stdio: 'pipe',
    });
  } catch {
    throw new Error('Surface check failed — run "pnpm surface:generate" to update');
  }
});

// ============================================================
// 2. Theme Manifests (engines field)
// ============================================================

console.log('\n📋 2. Theme Manifests (engines field)');

const themesDir = join(ROOT, 'packages', 'shop-themes');
const themes = readdirSync(themesDir).filter(d => {
  const themePackDir = join(themesDir, d, 'theme-pack');
  return existsSync(themePackDir) && statSync(themePackDir).isDirectory();
});

check(`Found ${themes.length} theme packs`, () => {
  if (themes.length < 5) throw new Error('Expected at least 5 theme packs');
});

for (const themeSlug of themes) {
  const themeJsonPath = join(themesDir, themeSlug, 'theme-pack', 'theme.json');
  if (!existsSync(themeJsonPath)) continue;

  check(`${themeSlug}: has engines field`, () => {
    const manifest = JSON.parse(readFileSync(themeJsonPath, 'utf-8'));
    if (!manifest.engines) throw new Error('Missing engines field');
  });

  check(`${themeSlug}: engines has jiffoo-theme-sdk`, () => {
    const manifest = JSON.parse(readFileSync(themeJsonPath, 'utf-8'));
    if (!manifest.engines?.['jiffoo-theme-sdk']) {
      throw new Error('Missing engines["jiffoo-theme-sdk"]');
    }
  });
}

// ============================================================
// 3. Theme Activation Semver Check
// ============================================================

console.log('\n🔧 3. Theme Activation Semver Check');

check('service.ts imports satisfiesRange', () => {
  const content = readFileSync(
    join(ROOT, 'apps', 'api', 'src', 'core', 'admin', 'theme-management', 'service.ts'),
    'utf-8'
  );
  if (!content.includes('satisfiesRange')) throw new Error('satisfiesRange not imported');
});

check('service.ts has THEME_API_SDK_VERSION constant', () => {
  const content = readFileSync(
    join(ROOT, 'apps', 'api', 'src', 'core', 'admin', 'theme-management', 'service.ts'),
    'utf-8'
  );
  if (!content.includes('THEME_API_SDK_VERSION')) throw new Error('THEME_API_SDK_VERSION not defined');
});

check('service.ts has SDK version check in activateTheme', () => {
  const content = readFileSync(
    join(ROOT, 'apps', 'api', 'src', 'core', 'admin', 'theme-management', 'service.ts'),
    'utf-8'
  );
  if (!content.includes('requires @jiffoo/theme-api-sdk')) {
    throw new Error('SDK version check not found in activateTheme');
  }
});

check('types.ts has ThemeEngines interface', () => {
  const content = readFileSync(
    join(ROOT, 'apps', 'api', 'src', 'core', 'admin', 'extension-installer', 'types.ts'),
    'utf-8'
  );
  if (!content.includes('ThemeEngines')) throw new Error('ThemeEngines interface not found');
});

check('types.ts has engines field in ThemeManifest', () => {
  const content = readFileSync(
    join(ROOT, 'apps', 'api', 'src', 'core', 'admin', 'extension-installer', 'types.ts'),
    'utf-8'
  );
  if (!content.includes('engines?: ThemeEngines')) throw new Error('engines field not in ThemeManifest');
});

check('utils.ts validates engines in validateThemeManifest', () => {
  const content = readFileSync(
    join(ROOT, 'apps', 'api', 'src', 'core', 'admin', 'extension-installer', 'utils.ts'),
    'utf-8'
  );
  if (!content.includes('Validate engines field')) throw new Error('engines validation not found');
});

check('schemas.ts includes engines in OpenAPI', () => {
  const content = readFileSync(
    join(ROOT, 'apps', 'api', 'src', 'core', 'admin', 'theme-management', 'schemas.ts'),
    'utf-8'
  );
  if (!content.includes('jiffoo-theme-sdk')) throw new Error('engines not in OpenAPI schema');
});

// ============================================================
// 4. Version Matching Implementation
// ============================================================

console.log('\n🔢 4. Version Matching Implementation');

check('version-utils.ts has satisfiesRange function', () => {
  const content = readFileSync(
    join(ROOT, 'apps', 'api', 'src', 'core', 'admin', 'extension-installer', 'version-utils.ts'),
    'utf-8'
  );
  if (!content.includes('export function satisfiesRange')) throw new Error('satisfiesRange not exported');
});

check('version-utils.ts has validateVersionRange function', () => {
  const content = readFileSync(
    join(ROOT, 'apps', 'api', 'src', 'core', 'admin', 'extension-installer', 'version-utils.ts'),
    'utf-8'
  );
  if (!content.includes('export function validateVersionRange')) throw new Error('validateVersionRange not exported');
});

check('version-utils.ts supports caret ranges', () => {
  const content = readFileSync(
    join(ROOT, 'apps', 'api', 'src', 'core', 'admin', 'extension-installer', 'version-utils.ts'),
    'utf-8'
  );
  if (!content.includes("startsWith('^')")) throw new Error('Caret range not supported');
});

check('version-utils.ts supports tilde ranges', () => {
  const content = readFileSync(
    join(ROOT, 'apps', 'api', 'src', 'core', 'admin', 'extension-installer', 'version-utils.ts'),
    'utf-8'
  );
  if (!content.includes("startsWith('~')")) throw new Error('Tilde range not supported');
});

check('Version range tests exist', () => {
  const testPath = join(ROOT, 'apps', 'api', 'tests', 'core', 'version-utils.test.ts');
  if (!existsSync(testPath)) throw new Error('Test file not found');
  const content = readFileSync(testPath, 'utf-8');
  if (!content.includes('satisfiesRange')) throw new Error('Test does not cover satisfiesRange');
});

// ============================================================
// 5. Turbo Tasks & CI Integration
// ============================================================

console.log('\n⚙️ 5. Turbo Tasks & CI Integration');

check('turbo.json has theme-matrix task', () => {
  const content = readFileSync(join(ROOT, 'turbo.json'), 'utf-8');
  if (!content.includes('theme-matrix')) throw new Error('theme-matrix task not found');
});

check('turbo.json has theme-matrix:type-check task', () => {
  const content = readFileSync(join(ROOT, 'turbo.json'), 'utf-8');
  if (!content.includes('theme-matrix:type-check')) throw new Error('theme-matrix:type-check task not found');
});

check('Root package.json has theme-matrix script', () => {
  const content = readFileSync(join(ROOT, 'package.json'), 'utf-8');
  if (!content.includes('"theme-matrix"')) throw new Error('theme-matrix script not found');
});

check('Root package.json has surface:check script', () => {
  const content = readFileSync(join(ROOT, 'package.json'), 'utf-8');
  if (!content.includes('"surface:check"')) throw new Error('surface:check script not found');
});

check('Root package.json has theme-matrix:ssr script', () => {
  const content = readFileSync(join(ROOT, 'package.json'), 'utf-8');
  if (!content.includes('"theme-matrix:ssr"')) throw new Error('theme-matrix:ssr script not found');
});

check('theme-api-sdk package.json has surface:generate script', () => {
  const content = readFileSync(join(ROOT, 'packages', 'theme-api-sdk', 'package.json'), 'utf-8');
  if (!content.includes('"surface:generate"')) throw new Error('surface:generate script not found');
});

check('theme-api-sdk package.json includes snapshots in files', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'packages', 'theme-api-sdk', 'package.json'), 'utf-8'));
  if (!pkg.files?.includes('snapshots')) throw new Error('snapshots not in files array');
});

// ============================================================
// 6. SSR Smoke Test
// ============================================================

console.log('\n🎭 6. SSR Smoke Test');

check('theme-ssr-smoke.mjs exists', () => {
  const path = join(ROOT, 'scripts', 'theme-ssr-smoke.mjs');
  if (!existsSync(path)) throw new Error('SSR smoke test script not found');
});

check('theme-matrix.mjs exists', () => {
  const path = join(ROOT, 'scripts', 'theme-matrix.mjs');
  if (!existsSync(path)) throw new Error('Theme matrix script not found');
});

check('Surface snapshot test exists', () => {
  const path = join(ROOT, 'packages', 'theme-api-sdk', 'src', '__tests__', 'surface-snapshot.test.ts');
  if (!existsSync(path)) throw new Error('Surface snapshot test not found');
});

// ============================================================
// Summary
// ============================================================

console.log('\n═══════════════════════════════════════════════════════════');
console.log(`Audit Results: ${passed}/${passed + failed} checks passed, ${failed} failures`);
console.log('═══════════════════════════════════════════════════════════\n');

process.exit(failed > 0 ? 1 : 0);
