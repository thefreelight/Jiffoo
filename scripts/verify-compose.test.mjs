import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { guardComposeDatabase, validateWorkerLogs } from './verify-compose.mjs';
import { uploadTestImage, uploadTestImageDigest, uploadTestImageIndexDigest } from './upload-test-storage.mjs';
import { verifyUploadImageIdentity } from './upload-test-image-identity.mjs';
import { AcceptanceChecks } from '../deploy/compose/checks.mjs';

test('Compose cannot target a development or alternative database', () => {
  guardComposeDatabase('postgresql://postgres:postgres@localhost:5432/jiffoo_core_test');
  for (const value of [undefined, 'postgresql://postgres:postgres@localhost:5432/jiffoo_core', 'postgresql://postgres:postgres@postgres:5432/jiffoo_core_test']) assert.throws(() => guardComposeDatabase(value));
});
test('Compose and upload verification use the same pinned Silo index and verify its actual platform', () => {
  const compose = readFileSync(new URL('../deploy/compose/compose.yml', import.meta.url), 'utf8');
  assert.ok(compose.includes(uploadTestImage));
  const inspect = JSON.parse(readFileSync(new URL('./fixtures/upload-test-image-containerd.json', import.meta.url), 'utf8'));
  assert.equal(verifyUploadImageIdentity(inspect, undefined, uploadTestImageDigest, uploadTestImageIndexDigest), 'Descriptor');
  const classic = structuredClone(inspect); delete classic[0].Descriptor;
  assert.equal(verifyUploadImageIdentity(undefined, classic, uploadTestImageDigest, uploadTestImageIndexDigest), 'RepoDigests');
  classic[0].Architecture = 'arm64';
  assert.throws(() => verifyUploadImageIdentity(undefined, classic, uploadTestImageDigest, uploadTestImageIndexDigest));
  inspect[0].Descriptor.digest = uploadTestImageIndexDigest;
  assert.throws(() => verifyUploadImageIdentity(inspect, undefined, uploadTestImageDigest, uploadTestImageIndexDigest));
});
test('worker delivery evidence rejects duplicate sends and malformed production stdout', () => {
  const proof = { orderId: 'order-one', to: 'customer@example.test' };
  const line = JSON.stringify({ timestamp: '2026-10-11T00:00:00.000Z', level: 'info', message: '[plugin:console-email] Console email customer@example.test Payment received order-one' }) + '\n';
  validateWorkerLogs([line, ''], proof);
  assert.throws(() => validateWorkerLogs([line, line], proof));
  assert.throws(() => validateWorkerLogs(['plain text\n'], proof));
  assert.throws(() => validateWorkerLogs(['', ''], proof));
});

test('independent checks continue after failures while dependent checks explain why they were skipped', async () => {
  const checks = new AcceptanceChecks();
  const executed = [];
  await checks.run('notification', [], () => { throw new Error('First real notification error'); });
  await checks.run('shipping', [], () => { executed.push('shipping'); });
  await checks.run('rate limit', [], () => { throw new Error('First real rate error'); });
  await checks.run('client IP', [], () => { executed.push('client IP'); });
  await checks.run('notification-dependent', ['notification'], () => { executed.push('must not run'); });
  assert.deepEqual(executed, ['shipping', 'client IP']);
  assert.deepEqual(checks.counts(), { PASS: 2, FAIL: 2, SKIPPED: 1 });
  assert.equal(checks.passed, false);
  assert.match(checks.table(), /First real notification error/);
  assert.match(checks.table(), /First real rate error/);
  assert.match(checks.table(), /Requires successful checks: notification/);
  const imported = new AcceptanceChecks();
  imported.importRows(checks.rows);
  assert.equal(imported.passed, false);
  assert.throws(() => imported.importRows(checks.rows), /duplicate/);
});
