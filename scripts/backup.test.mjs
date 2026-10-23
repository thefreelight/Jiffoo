import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { guardState, sealBackup, verifyBackup, fileHash, space } from '../deploy/release/backup.mjs';
import { deploymentFiles, roles, sha256 } from '../deploy/release/identity.mjs';
import { guardBackupDatabase } from './verify-backup.mjs';
import { businessRowsHash, paymentRuntimeFields } from '../deploy/compose/backup-snapshot.mjs';

test('payment snapshots allow lease renewal but still detect financial, identity and business timestamp changes', () => {
  const original = { id: 'payment', orderId: 'order', amount: '12.50', currency: 'USD', status: 'SUCCEEDED',
    createdAt: '2026-10-11T00:00:00Z', closedAt: null, reviewResolvedAt: null,
    updatedAt: '2026-10-11T00:00:00Z', claimToken: null, claimedBy: null, leaseUntil: null, nextReconcileAt: 'before', attempts: 0 };
  const expected = businessRowsHash('payment', [original]);
  const running = { ...original, claimToken: 'new-token', claimedBy: 'new-worker', leaseUntil: 'later', nextReconcileAt: 'later', attempts: 1, updatedAt: 'later' };
  assert.equal(businessRowsHash('payment', [running]), expected);
  for (const key of ['id', 'orderId', 'amount', 'currency', 'status', 'createdAt', 'closedAt', 'reviewResolvedAt']) assert.notEqual(businessRowsHash('payment', [{ ...running, [key]: 'changed' }]), expected);
  assert.deepEqual(paymentRuntimeFields, ['claimToken', 'claimedBy', 'leaseUntil', 'nextReconcileAt', 'attempts', 'updatedAt']);
  assert.notEqual(businessRowsHash('paymentLedger', [original]), businessRowsHash('paymentLedger', [running]));
});

test('acceptance rejects every noncanonical test database before container creation', () => {
  guardBackupDatabase('postgresql://postgres:postgres@localhost:5432/jiffoo_core_test');
  for (const url of [undefined, 'postgresql://postgres:postgres@localhost:5432/jiffoo_core', 'postgresql://postgres:postgres@localhost:5498/jiffoo_core_test']) assert.throws(() => guardBackupDatabase(url));
});
test('maintenance proofs include unknown, paused, restarting and foreign project containers', () => {
  const container = (service, active = false) => ({ Config: { Labels: { 'com.docker.compose.project': 'test-project', 'com.docker.compose.service': service } }, State: { Running: active } });
  guardState([], 'test-project', 'restore');
  for (const service of ['postgres', 'redis', 'silo', 'api-1', 'worker-2', 'admin', 'shop', 'edge', 'unknown']) {
    assert.throws(() => guardState([container(service, true)], 'test-project', 'restore'), /stopped/);
    if (service !== 'postgres') assert.throws(() => guardState([container(service, true)], 'test-project', 'backup'), /maintenance/);
  }
  for (const flag of ['Paused', 'Restarting']) {
    const value = container('unknown'); value.State[flag] = true;
    assert.throws(() => guardState([value], 'test-project', 'restore'));
  }
  assert.throws(() => guardState([container('api-1')], 'other-project', 'restore'), /foreign/);
  assert.throws(() => guardState([], 'test-project', 'backup'), /complete/);
});
function fixture(action) {
  const directory = mkdtempSync(join(tmpdir(), 'backup-integrity-'));
  try {
    const digest = 'sha256:' + 'b'.repeat(64), commit = 'a'.repeat(40);
    for (const path of deploymentFiles) { const file = resolve(directory, 'release', path); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, 'x'); }
    const release = { schemaVersion: 1, repository: 'thefreelight/Jiffoo', version: '1.0.154', sourceCommit: commit, mode: 'acceptance', platform: 'linux/amd64', verifierImage: digest, ci: null,
      images: Object.fromEntries(roles.map(role => [role, { reference: digest, digest, platformDigest: digest }])), deployment: deploymentFiles.map(path => ({ path, size: 1, sha256: sha256(Buffer.from('x')) })) };
    writeFileSync(join(directory, 'release/release.json'), JSON.stringify(release));
    for (const path of ['database.sql', 'silo.tar', 'config.json', '.env', 'tls/cert.pem', 'tls/key.pem']) {
      const file = join(directory, path); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, path === 'silo.tar' ? Buffer.alloc(1024) : 'fixture');
    }
    const result = sealBackup(directory, 'test-project', { 'postgres-data': 'old-postgres', 'silo-data': 'old-silo', 'redis-data': 'old-redis' }, 'acceptance');
    action(directory, result.hash);
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
test('confirmation anchors required inventory, release identity and all streamed file checksums', () => fixture((directory, hash) => {
  assert.equal(fileHash(join(directory, 'backup.json')), hash);
  verifyBackup(directory, hash, 'acceptance');
  assert.throws(() => verifyBackup(directory, '0'.repeat(64), 'acceptance'), /Confirmation/);
  assert.throws(() => verifyBackup(directory, hash, 'ghcr'), /manifest/);
  writeFileSync(join(directory, '.env'), 'changed-secret-value');
  assert.throws(() => verifyBackup(directory, hash, 'acceptance'), /checksum/);
}));

test('update verifies a different source inventory without weakening default backup checks', () => fixture(directory => {
  const path = 'deploy/release/source-only.json', bytes = Buffer.from('source version');
  writeFileSync(join(directory, 'release', path), bytes);
  const releasePath = join(directory, 'release/release.json');
  const release = JSON.parse(readFileSync(releasePath));
  release.deployment.push({ path, size: bytes.length, sha256: sha256(bytes) });
  writeFileSync(releasePath, JSON.stringify(release));
  const backupPath = join(directory, 'backup.json'), backup = JSON.parse(readFileSync(backupPath));
  for (const member of backup.files) if (member.path === 'release/release.json') { member.size = readFileSync(releasePath).length; member.sha256 = fileHash(releasePath); }
  backup.files.push({ path: 'release/' + path, size: bytes.length, sha256: sha256(bytes) });
  writeFileSync(backupPath, JSON.stringify(backup));
  const hash = fileHash(backupPath); writeFileSync(join(directory, 'backup.sha256'), hash);
  assert.throws(() => verifyBackup(directory, hash, 'acceptance'), /inventory/);
  const policy = [...deploymentFiles, path];
  verifyBackup(directory, hash, 'acceptance', policy);
  writeFileSync(join(directory, 'release', path), 'tampered');
  assert.throws(() => verifyBackup(directory, hash, 'acceptance', policy), /checksum/);
}));
test('missing data, missing TLS, altered manifest and a rehashed incomplete inventory cannot restore', () => {
  for (const path of ['database.sql', 'silo.tar', 'tls/key.pem', 'release/release.json']) fixture((directory, hash) => {
    rmSync(join(directory, path)); assert.throws(() => verifyBackup(directory, hash, 'acceptance'));
  });
  fixture((directory, hash) => {
    writeFileSync(join(directory, 'backup.json'), '{}'); assert.throws(() => verifyBackup(directory, hash, 'acceptance'), /checksum/);
  });
  fixture(directory => {
    const manifest = JSON.parse(readFileSync(join(directory, 'backup.json'))); manifest.files.pop();
    writeFileSync(join(directory, 'backup.json'), JSON.stringify(manifest)); const hash = fileHash(join(directory, 'backup.json'));
    writeFileSync(join(directory, 'backup.sha256'), hash); assert.throws(() => verifyBackup(directory, hash, 'acceptance'), /inventory/);
  });
});
test('unsafe paths and insufficient disk space fail before restoration', () => fixture(directory => {
  const manifest = JSON.parse(readFileSync(join(directory, 'backup.json'))); manifest.files[0].path = '../outside';
  writeFileSync(join(directory, 'backup.json'), JSON.stringify(manifest)); const hash = fileHash(join(directory, 'backup.json'));
  writeFileSync(join(directory, 'backup.sha256'), hash); assert.throws(() => verifyBackup(directory, hash, 'acceptance'), /inventory/);
  assert.throws(() => space(directory, Number.MAX_SAFE_INTEGER), /space/);
}));
test('unlisted files cannot introduce a restore configuration or overwrite symlink target', () => fixture((directory, hash) => {
  writeFileSync(join(directory, 'compose.restore.json'), '{}');
  assert.throws(() => verifyBackup(directory, hash, 'acceptance'), /Unexpected backup file/);
}));
test('symlink replacement cannot redirect checksum reads outside the backup', { skip: process.platform === 'win32' }, () => fixture((directory, hash) => {
  rmSync(join(directory, 'database.sql')); symlinkSync('/etc/passwd', join(directory, 'database.sql'));
  assert.throws(() => verifyBackup(directory, hash, 'acceptance'), /symlinks/);
}));
