#!/usr/bin/env node
/**
 * Dormant Model Guard (Task 3.4)
 *
 * Scans apps/api/src for `prisma.<dormantModel>` references and fails
 * if any are found. This prevents new code from accidentally using
 * frozen models that have been moved to _dormant.prisma.
 *
 * The dormant model list is parsed from _dormant.prisma automatically.
 *
 * Usage:
 *   node scripts/check-dormant-models.cjs
 *
 * Exit codes:
 *   0 — No dormant model references found (pass)
 *   1 — Dormant model references found (fail)
 */

const { readFileSync, readdirSync, statSync } = require('fs');
const { join, extname } = require('path');

const SCHEMA_DIR = join(__dirname, '..', 'prisma', 'schema');
const DORMANT_FILE = join(SCHEMA_DIR, '_dormant.prisma');
const SRC_DIR = join(__dirname, '..', 'src');
const SCAN_EXTENSIONS = ['.ts', '.tsx'];

// ============================================================
// 1. Parse dormant model names from _dormant.prisma
// ============================================================

function parseDormantModels(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const models = [];
  const regex = /^model\s+(\w+)\s+\{/gm;
  let match;
  while ((match = regex.exec(content)) !== null) {
    models.push(match[1]);
  }
  return models;
}

// ============================================================
// 2. Scan source files for prisma.<dormantModel> references
// ============================================================

function getAllTsFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...getAllTsFiles(fullPath));
    } else if (SCAN_EXTENSIONS.includes(extname(fullPath))) {
      results.push(fullPath);
    }
  }
  return results;
}

function scanDormantReferences(dormantModels, srcDir) {
  const violations = [];
  const files = getAllTsFiles(srcDir);

  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    for (const model of dormantModels) {
      // Prisma client property names are camelCase (first letter lowercase)
      const camelModel = model.charAt(0).toLowerCase() + model.slice(1);
      const pattern = 'prisma.' + camelModel;
      const count = content.split(pattern).length - 1;
      if (count > 0) {
        // Get relative path for cleaner output
        const relPath = file.replace(srcDir + '/', '');
        violations.push({
          model,
          pattern,
          count,
          file: relPath,
        });
      }
    }
  }

  return violations;
}

// ============================================================
// 3. Main
// ============================================================

function main() {
  console.log('Checking for dormant model references...');

  const dormantModels = parseDormantModels(DORMANT_FILE);
  console.log(`Found ${dormantModels.length} dormant models: ${dormantModels.join(', ')}`);

  const violations = scanDormantReferences(dormantModels, SRC_DIR);

  if (violations.length === 0) {
    console.log('\n✅ No dormant model references found. Codebase is clean.');
    process.exit(0);
  }

  console.error('\n❌ Dormant model references found!');
  console.error('\nViolations:');
  for (const v of violations) {
    console.error(`  • ${v.file}: ${v.count}x ${v.pattern} (model: ${v.model})`);
  }
  console.error(`\nTotal violations: ${violations.length}`);
  console.error('\nThese models are frozen in _dormant.prisma and should not be used.');
  console.error('If you need to reactivate a model, move it from _dormant.prisma to the');
  console.error('appropriate domain file and remove it from this check.');

  process.exit(1);
}

main();
