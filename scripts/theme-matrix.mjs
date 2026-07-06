#!/usr/bin/env node
/**
 * Theme Matrix Runner (Task 6.3.1)
 *
 * Runs type-check + build validation across all theme packages:
 * 1. Type-checks @shop-themes/default (React component theme)
 * 2. Validates all theme.json manifests (engines, schema, entry paths)
 * 3. Verifies API surface snapshot integrity
 *
 * Usage:
 *   node scripts/theme-matrix.mjs                  # Full matrix
 *   node scripts/theme-matrix.mjs --type-check     # Type-check only
 *   node scripts/theme-matrix.mjs --validate       # Manifest validation only
 */

import { execSync } from 'child_process';
import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const args = process.argv.slice(2);
const typeCheckOnly = args.includes('--type-check');
const validateOnly = args.includes('--validate');
const fullMatrix = !typeCheckOnly && !validateOnly;

let failures = 0;
let checks = 0;

function check(name, fn) {
  checks++;
  try {
    fn();
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failures++;
    console.error(`  ❌ ${name}`);
    console.error(`     ${err.message}`);
  }
}

// ============================================================
// 1. Type-check default theme package
// ============================================================

function typeCheckDefaultTheme() {
  const defaultThemeDir = join(ROOT, 'packages', 'shop-themes', 'default');
  if (!existsSync(join(defaultThemeDir, 'tsconfig.json'))) {
    console.log('  ⏭️  Default theme: no tsconfig.json, skipping type-check');
    return;
  }

  console.log('\n📦 Type-checking @shop-themes/default...');
  try {
    execSync('npx tsc --noEmit', {
      cwd: defaultThemeDir,
      stdio: 'pipe',
    });
    console.log('  ✅ @shop-themes/default type-check passed');
    checks++;
  } catch (err) {
    console.error('  ❌ @shop-themes/default type-check failed');
    console.error(err.stderr?.toString() || err.message);
    failures++;
  }
}

// ============================================================
// 2. Validate all theme.json manifests
// ============================================================

function validateThemeManifests() {
  const themesDir = join(ROOT, 'packages', 'shop-themes');
  const themes = readdirSync(themesDir).filter(d => {
    const themePackDir = join(themesDir, d, 'theme-pack');
    return existsSync(themePackDir) && statSync(themePackDir).isDirectory();
  });

  console.log(`\n📋 Validating ${themes.length} theme.json manifests...`);

  for (const themeSlug of themes) {
    const themeJsonPath = join(themesDir, themeSlug, 'theme-pack', 'theme.json');
    if (!existsSync(themeJsonPath)) continue;

    const content = readFileSync(themeJsonPath, 'utf-8');
    let manifest;
    try {
      manifest = JSON.parse(content);
    } catch {
      console.error(`  ❌ ${themeSlug}: Invalid JSON`);
      failures++;
      checks++;
      continue;
    }

    check(`${themeSlug}: schemaVersion`, () => {
      if (manifest.schemaVersion !== 1) throw new Error('schemaVersion must be 1');
    });

    check(`${themeSlug}: slug`, () => {
      if (!manifest.slug || typeof manifest.slug !== 'string') throw new Error('missing slug');
      if (!/^[a-z0-9-]+$/.test(manifest.slug)) throw new Error('slug must be lowercase letters, numbers, hyphens');
    });

    check(`${themeSlug}: version`, () => {
      if (!manifest.version || !/^\d+\.\d+\.\d+$/.test(manifest.version)) {
        throw new Error('version must be MAJOR.MINOR.PATCH');
      }
    });

    check(`${themeSlug}: target`, () => {
      if (!manifest.target || !['shop', 'admin'].includes(manifest.target)) {
        throw new Error('target must be "shop" or "admin"');
      }
    });

    check(`${themeSlug}: engines`, () => {
      if (manifest.engines) {
        const sdk = manifest.engines['jiffoo-theme-sdk'];
        if (sdk !== undefined && typeof sdk !== 'string') {
          throw new Error('engines["jiffoo-theme-sdk"] must be a string');
        }
        // Validate range syntax
        if (sdk && !/^[\^~<>]?=?\d+\.\d+\.\d+($|\s|\|\|)/.test(sdk.trim())) {
          throw new Error(`invalid version range: ${sdk}`);
        }
      }
    });

    check(`${themeSlug}: compatibility`, () => {
      if (manifest.compatibility?.minCoreVersion) {
        if (!/^\d+\.\d+\.\d+$/.test(manifest.compatibility.minCoreVersion)) {
          throw new Error('minCoreVersion must be MAJOR.MINOR.PATCH');
        }
      }
    });
  }
}

// ============================================================
// 3. API surface snapshot check
// ============================================================

function checkSurfaceSnapshot() {
  console.log('\n🔍 Checking API surface snapshot...');
  try {
    execSync('node packages/theme-api-sdk/scripts/generate-theme-surface.cjs --check', {
      cwd: ROOT,
      stdio: 'pipe',
    });
    console.log('  ✅ API surface snapshot matches');
    checks++;
  } catch (err) {
    console.error('  ❌ API surface snapshot mismatch');
    console.error(err.stderr?.toString() || err.message);
    failures++;
  }
}

// ============================================================
// 4. Verify theme-api-sdk builds
// ============================================================

function buildThemeApiSdk() {
  console.log('\n🔨 Building @jiffoo/theme-api-sdk...');
  try {
    execSync('pnpm run build', {
      cwd: join(ROOT, 'packages', 'theme-api-sdk'),
      stdio: 'pipe',
    });
    console.log('  ✅ @jiffoo/theme-api-sdk build passed');
    checks++;
  } catch (err) {
    console.error('  ❌ @jiffoo/theme-api-sdk build failed');
    console.error(err.stderr?.toString() || err.message);
    failures++;
  }
}

// ============================================================
// Main
// ============================================================

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║              Theme Matrix Validation                     ║');
console.log('╚═══════════════════════════════════════════════════════════╝');

if (fullMatrix || typeCheckOnly) {
  typeCheckDefaultTheme();
  buildThemeApiSdk();
}

if (fullMatrix || validateOnly) {
  validateThemeManifests();
  checkSurfaceSnapshot();
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log(`Results: ${checks - failures}/${checks} checks passed, ${failures} failures`);
console.log('═══════════════════════════════════════════════════════════\n');

process.exit(failures > 0 ? 1 : 0);
