import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import {
  assertMigrationLine,
  buildExpectedMigrationLine,
  verifyMigrationLine,
} from './verify-native-d1-migration-line.mjs';

const external = {
  filename: '1001_extension.sql',
  insertAfter: '0001_core.sql',
};

assert.deepEqual(
  buildExpectedMigrationLine(['0001_core.sql', '0002_core.sql'], [external]),
  ['0001_core.sql', '1001_extension.sql', '0002_core.sql'],
);
assert.deepEqual(
  buildExpectedMigrationLine(
    ['0001_core.sql', '0002_core.sql'],
    [],
    [{ canonicalFilename: '0002_core.sql', appliedFilename: '0026_legacy.sql' }],
  ),
  ['0001_core.sql', '0026_legacy.sql'],
);
assert.throws(
  () =>
    buildExpectedMigrationLine(
      ['0001_core.sql', '0002_core.sql'],
      [],
      [
        { canonicalFilename: '0001_core.sql', appliedFilename: '0026_legacy.sql' },
        { canonicalFilename: '0002_core.sql', appliedFilename: '0026_legacy.sql' },
      ],
    ),
  /Duplicate applied migration alias/,
);
assert.throws(
  () => assertMigrationLine(['0001_core.sql'], ['0002_core.sql']),
  /Migration mismatch at position 1/,
);
assert.doesNotThrow(() =>
  assertMigrationLine(
    ['0001_core.sql', '1001_extension.sql', '0002_core.sql'],
    ['0001_core.sql', '1001_extension.sql'],
    'prefix',
  ),
);

const root = await mkdtemp(join(tmpdir(), 'jiffoo-d1-line-'));
const coreDir = join(root, 'core');
const externalRoot = join(root, 'external');
await mkdir(coreDir);
await mkdir(externalRoot);
await writeFile(join(coreDir, '0001_core.sql'), 'SELECT 1;');
await writeFile(join(coreDir, '0002_core.sql'), 'SELECT 2;');
const externalSql = 'SELECT 1001;';
await writeFile(join(externalRoot, '1001_extension.sql'), externalSql);
const digest = createHash('sha256').update(externalSql).digest('hex');
const lockPath = join(root, 'lock.json');
await writeFile(
  lockPath,
  JSON.stringify({
    schemaVersion: 1,
    externalMigrations: [
      {
        ...external,
        sourcePath: '1001_extension.sql',
        sha256: digest,
      },
    ],
  }),
);
const ledgerPath = join(root, 'ledger.json');
await writeFile(
  ledgerPath,
  JSON.stringify([
    { name: '0001_core.sql' },
    { name: '1001_extension.sql' },
    { name: '0002_core.sql' },
  ]),
);

assert.deepEqual(
  await verifyMigrationLine({ coreDir, lockPath, externalRoot, ledgerPath }),
  ['0001_core.sql', '1001_extension.sql', '0002_core.sql'],
);

const coreTwoDigest = createHash('sha256').update('SELECT 2;').digest('hex');
await writeFile(
  lockPath,
  JSON.stringify({
    schemaVersion: 1,
    externalMigrations: [],
    migrationAliases: [
      {
        canonicalFilename: '0002_core.sql',
        appliedFilename: '0002_legacy.sql',
        sha256: coreTwoDigest,
      },
    ],
  }),
);
await writeFile(ledgerPath, JSON.stringify(['0001_core.sql', '0002_legacy.sql']));
assert.deepEqual(
  await verifyMigrationLine({ coreDir, lockPath, externalRoot, ledgerPath }),
  ['0001_core.sql', '0002_legacy.sql'],
);

await writeFile(
  lockPath,
  JSON.stringify({
    schemaVersion: 1,
    externalMigrations: [],
    migrationAliases: [
      {
        canonicalFilename: '0002_core.sql',
        appliedFilename: '0002_legacy.sql',
        sha256: 'invalid',
      },
    ],
  }),
);
await assert.rejects(
  verifyMigrationLine({ coreDir, lockPath, externalRoot, ledgerPath }),
  /Checksum mismatch for migration alias/,
);

await writeFile(
  lockPath,
  JSON.stringify({
    schemaVersion: 1,
    externalMigrations: [
      {
        ...external,
        sourcePath: '1001_extension.sql',
        sha256: digest,
      },
    ],
  }),
);
await writeFile(
  ledgerPath,
  JSON.stringify(['0001_core.sql', '1001_extension.sql', '0002_core.sql']),
);
await writeFile(join(externalRoot, '1001_extension.sql'), 'SELECT 9;');
await assert.rejects(
  verifyMigrationLine({ coreDir, lockPath, externalRoot, ledgerPath }),
  /Checksum mismatch/,
);

process.stdout.write('Native D1 migration line verifier tests passed\n');
