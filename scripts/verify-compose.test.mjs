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

test('upload application policy grants only the three store actions on its configured bucket', () => {
  const init = readFileSync(new URL('../deploy/compose/silo-init.sh', import.meta.url), 'utf8');
  const json = init.split('<<EOF\n')[1].split('\nEOF')[0].replaceAll('$bucket', 'example-uploads');
  const policy = JSON.parse(json);
  assert.deepEqual(policy.Statement.flatMap(statement => statement.Action).sort(), ['s3:GetObject', 's3:ListBucket', 's3:PutObject']);
  assert.deepEqual(policy.Statement.map(statement => statement.Resource), [['arn:aws:s3:::example-uploads'], ['arn:aws:s3:::example-uploads/*']]);
  const compose = readFileSync(new URL('../deploy/compose/compose.yml', import.meta.url), 'utf8');
  const backend = compose.slice(0, compose.indexOf('x-nginx:'));
  assert.ok(!backend.includes('MINIO_ROOT_'));
  assert.match(backend, /UPLOAD_S3_ACCESS_KEY_ID: \$\{SILO_APP_ACCESS_KEY_ID/);
  assert.match(backend, /UPLOAD_S3_SECRET_ACCESS_KEY: \$\{SILO_APP_SECRET_ACCESS_KEY/);
});

test('edge renders only derived hostname variables and preserves nginx request variables', () => {
  const template = readFileSync(new URL('../deploy/compose/edge.conf.template', import.meta.url), 'utf8');
  assert.ok(!template.includes('shop.local') && !template.includes('admin.local'));
  assert.ok(template.includes('server_name ${EDGE_SHOP_HOST};'));
  assert.ok(template.includes('server_name ${EDGE_ADMIN_HOST};'));
  assert.ok(template.includes('$host') && template.includes('$remote_addr'));
  const compose = readFileSync(new URL('../deploy/compose/compose.yml', import.meta.url), 'utf8');
  assert.match(compose, /NGINX_ENVSUBST_FILTER: 'EDGE_\(SHOP\|ADMIN\)_HOST'/);
  assert.match(compose, /edge\.conf\.template:\/etc\/nginx\/templates\/nginx\.conf\.template:ro/);
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
