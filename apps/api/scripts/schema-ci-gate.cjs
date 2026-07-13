#!/usr/bin/env node
/**
 * Schema CI Gate (Task 3.5)
 *
 * Combines all schema-related CI checks into a single script:
 *   1. prisma validate — ensures schema is syntactically valid
 *   2. prisma format --check — ensures schema is properly formatted
 *   3. check-dormant-models — ensures no code references dormant models
 *
 * Usage:
 *   node scripts/schema-ci-gate.cjs
 *
 * Exit codes:
 *   0 — All checks passed
 *   1 — One or more checks failed
 */

const { execSync } = require('child_process');
const { join } = require('path');

const APP_DIR = join(__dirname, '..');
const SCHEMA_DIR = 'prisma/schema';

let failures = 0;

function runCheck(name, command) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`▶ ${name}`);
  console.log(`${'═'.repeat(60)}`);

  try {
    const output = execSync(command, {
      cwd: APP_DIR,
      encoding: 'utf-8',
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL || 'postgresql://dummy:dummy@localhost:5432/dummy' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    // Print last few lines of output
    const lines = output.trim().split('\n').slice(-5);
    for (const line of lines) console.log(line);
    console.log(`✅ ${name} — PASSED`);
    return true;
  } catch (err) {
    const stderr = err.stderr || err.stdout || err.message;
    console.error(stderr.trim());
    console.error(`❌ ${name} — FAILED`);
    failures++;
    return false;
  }
}

console.log('Schema CI Gate');
console.log('═══════════════════════════════════════════════════════════');

// 1. Validate schema
runCheck('Prisma Validate', `npx prisma validate --schema ${SCHEMA_DIR}`);

// 2. Check formatting
runCheck('Prisma Format Check', `npx prisma format --schema ${SCHEMA_DIR} --check`);

// 3. Dormant model guard
runCheck('Dormant Model Guard', `node scripts/check-dormant-models.cjs`);

// Summary
console.log('\n' + '═'.repeat(60));
if (failures === 0) {
  console.log('✅ All schema CI checks passed!');
  process.exit(0);
} else {
  console.error(`❌ ${failures} check(s) failed. Fix the issues above before merging.`);
  process.exit(1);
}
