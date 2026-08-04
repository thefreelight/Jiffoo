#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function parseArgs(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined) {
      throw new Error(`Invalid argument near ${key ?? '<end>'}`);
    }
    values.set(key.slice(2), value);
  }
  return values;
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

export function buildExpectedMigrationLine(coreMigrations, externalMigrations) {
  const expected = [...coreMigrations];
  for (const migration of externalMigrations) {
    const anchorIndex = expected.indexOf(migration.insertAfter);
    if (anchorIndex === -1) {
      throw new Error(
        `External migration ${migration.filename} references missing anchor ${migration.insertAfter}`,
      );
    }
    if (expected.includes(migration.filename)) {
      throw new Error(`Duplicate migration filename ${migration.filename}`);
    }
    expected.splice(anchorIndex + 1, 0, migration.filename);
  }
  return expected;
}

export function assertMigrationLine(expected, applied, mode = 'exact') {
  if (!['exact', 'prefix'].includes(mode)) {
    throw new Error(`Unsupported verification mode ${mode}`);
  }
  if (mode === 'exact' && expected.length !== applied.length) {
    throw new Error(
      `Migration count mismatch: expected ${expected.length}, received ${applied.length}`,
    );
  }
  if (applied.length > expected.length) {
    throw new Error(
      `Migration count mismatch: expected at most ${expected.length}, received ${applied.length}`,
    );
  }
  applied.forEach((appliedFilename, index) => {
    const filename = expected[index];
    if (appliedFilename !== filename) {
      throw new Error(
        `Migration mismatch at position ${index + 1}: expected ${filename ?? '<none>'}, received ${appliedFilename}`,
      );
    }
  });
}

function normalizeAppliedLedger(parsed) {
  if (Array.isArray(parsed) && parsed.every((entry) => typeof entry === 'string')) {
    return parsed;
  }
  if (Array.isArray(parsed) && parsed.every((entry) => typeof entry?.name === 'string')) {
    return parsed.map((entry) => entry.name);
  }
  const results = parsed?.[0]?.results;
  if (Array.isArray(results) && results.every((entry) => typeof entry?.name === 'string')) {
    return results.map((entry) => entry.name);
  }
  throw new Error('Applied ledger must contain migration names');
}

export async function verifyMigrationLine({ coreDir, lockPath, externalRoot, ledgerPath, mode = 'exact' }) {
  const coreMigrations = (await readdir(coreDir))
    .filter((filename) => /^\d+_.+\.sql$/.test(filename))
    .sort();
  const lock = JSON.parse(await readFile(lockPath, 'utf8'));
  if (lock.schemaVersion !== 1 || !Array.isArray(lock.externalMigrations)) {
    throw new Error('Unsupported external migration lock format');
  }

  for (const migration of lock.externalMigrations) {
    const sourcePath = resolve(externalRoot, migration.sourcePath);
    const actualSha256 = sha256(await readFile(sourcePath));
    if (actualSha256 !== migration.sha256) {
      throw new Error(
        `Checksum mismatch for ${migration.filename}: expected ${migration.sha256}, received ${actualSha256}`,
      );
    }
  }

  const expected = buildExpectedMigrationLine(coreMigrations, lock.externalMigrations);
  const applied = normalizeAppliedLedger(JSON.parse(await readFile(ledgerPath, 'utf8')));
  assertMigrationLine(expected, applied, mode);
  return expected;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const required = ['core-dir', 'lock', 'external-root', 'ledger'];
  for (const key of required) {
    if (!args.has(key)) throw new Error(`Missing required argument --${key}`);
  }
  const expected = await verifyMigrationLine({
    coreDir: resolve(args.get('core-dir')),
    lockPath: resolve(args.get('lock')),
    externalRoot: resolve(args.get('external-root')),
    ledgerPath: resolve(args.get('ledger')),
    mode: args.get('mode') ?? 'exact',
  });
  process.stdout.write(`Verified ${expected.length} D1 migrations\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
