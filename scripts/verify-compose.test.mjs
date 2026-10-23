import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { archiveComposeStartup, withComposeStartupDiagnostics } from './compose-startup.mjs';
import { guardComposeDatabase, validateWorkerLogs } from './verify-compose.mjs';
import { uploadTestImage, uploadTestImageDigest, uploadTestImageIndexDigest } from './upload-test-storage.mjs';
import { verifyUploadImageIdentity } from './upload-test-image-identity.mjs';
import { AcceptanceChecks } from '../deploy/compose/checks.mjs';

test('startup failure archives all bootstrap and exited services and reports their last 50 redacted lines', async () => {
  const project = 'jiffoo-compose-11111111-1111-4111-8111-111111111111', saved = new Map(), queried = [];
  const containers = [
    { Id: 'bootstrap', Name: '/bootstrap', Labels: { 'com.docker.compose.project': project, 'com.docker.compose.service': 'silo-init' }, State: { Status: 'exited', Running: false, ExitCode: 1 } },
    { Id: 'edge', Name: '/edge', Labels: { 'com.docker.compose.project': project, 'com.docker.compose.service': 'edge' }, State: { Status: 'exited', Running: false, ExitCode: 2 } },
  ];
  const output = Array.from({ length: 60 }, (_, index) => `line ${index}`).join('\n') + '\nPRIVATE_BOOTSTRAP_SECRET\n';
  const options = { project, secrets: ['PRIVATE_BOOTSTRAP_SECRET'],
    query: async args => { queried.push(args); return args[0] === 'ps' ? 'bootstrap\nedge\n' : containers.map(container => JSON.stringify(container)).join('\n'); },
    logs: async service => service === 'silo-init' ? output : `log ${service ?? 'all services'}`,
    save: async (name, text) => saved.set(name, text) };
  await assert.rejects(withComposeStartupDiagnostics(async () => { throw new Error('Stack startup failed'); }, options), error => {
    assert.match(error.message, /silo-init: state=exited, exit=1/); assert.match(error.message, /line 11/); assert.ok(!error.message.includes('line 10\n'));
    assert.match(error.message, /edge: state=exited, exit=2/); assert.ok(!error.message.includes('PRIVATE_BOOTSTRAP_SECRET')); return true;
  });
  for (const name of ['silo-init', 'db-init', 'silo-volume-init', 'silo', 'postgres', 'edge']) assert.ok(saved.has(`startup-${name}.log`));
  assert.ok(saved.has('stack.log')); assert.ok(saved.has('startup-state.json'));
  assert.ok([...saved.values()].every(text => !text.includes('PRIVATE_BOOTSTRAP_SECRET')));
  assert.ok(queried[0].includes('label=com.docker.compose.project=' + project));
  const checks = new AcceptanceChecks();
  await checks.run('Stack startup', [], () => { throw new Error('Bootstrap exited'); });
  await checks.run('Read api-1 logs', ['Stack startup'], () => { throw new Error('must not run'); });
  await checks.run('api-1 stdout JSON format', ['Read api-1 logs'], () => { throw new Error('must not run'); });
  assert.deepEqual(checks.rows.map(row => row.status), ['FAIL', 'SKIPPED', 'SKIPPED']);
});
test('diagnostics reject foreign containers and successful startup does not collect failure logs', async () => {
  const project = 'jiffoo-compose-11111111-1111-4111-8111-111111111111';
  await assert.rejects(archiveComposeStartup({ project,
    query: async args => args[0] === 'ps' ? 'foreign' : JSON.stringify({ Labels: { 'com.docker.compose.project': 'developer' } }),
    logs: async () => { throw new Error('must not read foreign logs'); }, save: async () => { throw new Error('must not save foreign state'); } }), /foreign/);
  assert.equal(await withComposeStartupDiagnostics(async () => 'ready', {}), 'ready');
});

test('startup diagnostics reject malformed UUIDs and foreign prefixes before querying Docker or logs', async () => {
  const uuid = '11111111-1111-4111-8111-111111111111';
  for (const project of ['jiffoo-update-' + 'a'.repeat(36), 'jiffoo-update-' + '-'.repeat(36),
    'jiffoo-update-' + uuid + '\n', 'jiffoo-update-' + uuid + '-extra', 'developer-' + uuid,
    'jiffoo-update-11111111-1111-1111-8111-111111111111', 'jiffoo-update-11111111-1111-4111-1111-111111111111']) {
    await assert.rejects(archiveComposeStartup({ project,
      query: async () => { assert.fail('Invalid project must not query Docker'); },
      logs: async () => { assert.fail('Invalid project must not read logs'); },
      save: async () => { assert.fail('Invalid project must not save logs'); } }), /regular expression/);
  }
  for (const kind of ['compose', 'backup', 'update']) {
    const project = `jiffoo-${kind}-${uuid}`, queries = [];
    await archiveComposeStartup({ project, query: async args => { queries.push(args); return ''; }, logs: async () => '', save: async () => {} });
    assert.deepEqual(queries, [['ps', '-aq', '--filter', `label=com.docker.compose.project=${project}`]]);
    let readForeignLogs = false;
    await assert.rejects(archiveComposeStartup({ project,
      query: async args => args[0] === 'ps' ? 'foreign' : JSON.stringify({ Labels: { 'com.docker.compose.project': `jiffoo-${kind}-22222222-2222-4222-8222-222222222222` } }),
      logs: async () => { readForeignLogs = true; return ''; }, save: async () => {} }), /foreign/);
    assert.equal(readForeignLogs, false);
  }
});

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
  assert.ok(template.includes('$http_host') && template.includes('$remote_addr'));
  assert.equal((template.match(/proxy_set_header Host \$http_host;/g) ?? []).length, 2);
  assert.equal((template.match(/proxy_set_header X-Forwarded-Host "";/g) ?? []).length, 2);
  const balancer = readFileSync(new URL('../deploy/compose/api-lb.conf', import.meta.url), 'utf8');
  assert.match(balancer, /proxy_set_header Host \$http_host;/);
  assert.ok(!/proxy_set_header Host \$host;/.test(template + balancer));
  const compose = readFileSync(new URL('../deploy/compose/compose.yml', import.meta.url), 'utf8');
  assert.match(compose, /NGINX_ENVSUBST_FILTER: 'EDGE_\(SHOP\|ADMIN\)_HOST'/);
  assert.match(compose, /edge\.conf\.template:\/etc\/nginx\/templates\/nginx\.conf\.template:ro/);
});
test('worker delivery evidence rejects duplicate sends and malformed production stdout', () => {
  const proof = { orderId: 'order-one', orderNumber: 'JF-20261011-0001', to: 'customer@example.test' };
  const line = JSON.stringify({ timestamp: '2026-10-11T00:00:00.000Z', level: 'info', message: '[plugin:console-email] Console email customer@example.test Payment received JF-20261011-0001' }) + '\n';
  validateWorkerLogs([line, ''], proof);
  validateWorkerLogs(['', line], proof);
  assert.throws(() => validateWorkerLogs([line.replace(proof.orderNumber, proof.orderId), ''], proof));
  for (const required of ['[plugin:console-email] Console email', proof.to, 'Payment received']) {
    assert.throws(() => validateWorkerLogs([line.replace(required, 'unrelated'), ''], proof));
  }
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
