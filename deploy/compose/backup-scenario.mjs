import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { businessRowsHash } from './backup-snapshot.mjs';

const require = createRequire(resolve('package.json'));
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const base = 'http://api-1:3001';
async function http(path, method = 'GET', body, token, expected = 200) {
  const response = await fetch(base + path, { method, signal: AbortSignal.timeout(30000),
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body && !(body instanceof FormData) ? { 'content-type': 'application/json' } : {}) },
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body) });
  assert.equal(response.status, expected, `${method} ${path} failed with HTTP ${response.status}`);
  return response.json();
}
function form(bytes, name, fields = {}) {
  const value = new FormData(); for (const [key, text] of Object.entries(fields)) value.set(key, text);
  value.set('file', new Blob([bytes], { type: name.endsWith('.png') ? 'image/png' : 'application/zip' }), name); return value;
}
function objectClient() {
  const { S3Client } = require('@aws-sdk/client-s3');
  return new S3Client({ endpoint: process.env.UPLOAD_S3_ENDPOINT, region: process.env.UPLOAD_S3_REGION, forcePathStyle: true,
    credentials: { accessKeyId: process.env.UPLOAD_S3_ACCESS_KEY_ID, secretAccessKey: process.env.UPLOAD_S3_SECRET_ACCESS_KEY },
    requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED', maxAttempts: 1 });
}
async function archive(entries) {
  const zip = require('archiver')('zip'), chunks = [];
  const done = new Promise((resolve, reject) => { zip.on('data', bytes => chunks.push(bytes)); zip.once('end', resolve); zip.once('error', reject); });
  for (const [name, bytes] of Object.entries(entries)) zip.append(bytes, { name });
  await zip.finalize(); await done; return Buffer.concat(chunks);
}
async function seed() {
  const password = randomUUID() + 'Aa1!';
  await http('/api/v1/install/complete', 'POST', { siteName: 'Backup acceptance', adminEmail: 'backup-owner@example.test', adminPassword: password });
  const owner = (await http('/api/v1/auth/login', 'POST', { email: 'backup-owner@example.test', password, surface: 'admin' })).data.access_token;
  await http('/api/v1/auth/register', 'POST', { email: 'backup-customer@example.test', username: 'backup-customer', password }, undefined, 201);
  const customer = (await http('/api/v1/auth/login', 'POST', { email: 'backup-customer@example.test', password })).data.access_token;
  const sql = 'CREATE TABLE records (id TEXT PRIMARY KEY, value TEXT NOT NULL);';
  const manifest = { schemaVersion: 1, slug: 'backup-probe', name: 'Backup probe', version: '1.0.0', description: 'Backup data fixture', category: 'integration',
    runtimeType: 'internal-fastify', hostProtocol: 'internal-fastify-v1', entryModule: 'index.js', permissions: [], contracts: [],
    database: { apiVersion: 1, migrations: [{ id: 'records', order: 1, path: 'migrations/001.sql', sha256: digest(sql) }] } };
  const bytes = await archive({ 'manifest.json': JSON.stringify(manifest), 'migrations/001.sql': sql,
    'index.js': "module.exports = { register(ctx) { ctx.http.route({ method: 'GET', path: '/records', handler: () => ctx.database.query('SELECT * FROM records ORDER BY id', []) }); ctx.http.route({ method: 'POST', path: '/records', handler: async () => { await ctx.database.query('INSERT INTO records VALUES ($1,$2)', ['before', 'backup-point']); return { ok: true }; } }); } };" });
  const preview = (await http('/api/v1/extensions/plugin/preview', 'POST', form(bytes, 'plugin.zip'), owner)).data;
  const operation = (await http('/api/v1/extensions/plugin/install', 'POST', form(bytes, 'plugin.zip', { previewToken: preview.previewToken, confirmUnsigned: 'true', confirmationSlug: 'backup-probe', confirmMigrations: 'true' }), owner, 202)).data;
  const deadline = Date.now() + 60000;
  for (;;) {
    const state = (await http(`/api/v1/extensions/plugin/operations/${operation.operationId}?wait=true`, 'GET', undefined, owner)).data;
    if (state.terminal) { assert.equal(state.phase, 'SUCCESS'); break; }
    assert.ok(Date.now() < deadline, 'Plugin installation timed out');
  }
  const instance = await db.pluginInstallation.findUniqueOrThrow({ where: { pluginSlug_instanceKey: { pluginSlug: 'backup-probe', instanceKey: 'default' } } });
  await http(`/api/v1/extensions/plugin/backup-probe/instances/${instance.id}`, 'PATCH', { enabled: true }, owner);
  await http('/api/v1/extensions/plugin/backup-probe/api/records', 'POST', {}, owner);
  const namespace = await db.pluginNamespace.findUniqueOrThrow({ where: { slug: 'backup-probe' } });
  assert.match(namespace.schemaName, /^plugin_[a-z0-9_]+$/);
  const { Client } = require('pg'), grants = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await grants.connect();
    await grants.query('CREATE ROLE backup_reader NOLOGIN');
    await grants.query(`GRANT USAGE ON SCHEMA "${namespace.schemaName}" TO backup_reader`);
    await grants.query(`GRANT SELECT ON "${namespace.schemaName}".records TO backup_reader`);
  } finally { await grants.end(); }
  const png = await require('sharp')({ create: { width: 20, height: 20, channels: 3, background: '#143a72' } }).png().toBuffer();
  const media = (await http('/api/v1/admin/products/upload-image', 'POST', form(png, 'backup.png'), owner)).data;
  const uploaded = await fetch(base + media.url); assert.equal(uploaded.status, 200);
  const mediaSha256 = digest(Buffer.from(await uploaded.arrayBuffer()));
  const product = (await http('/api/v1/admin/products/', 'POST', { name: 'Backup product', requiresShipping: true, variants: [{ name: 'Default', salePrice: 12.5, stock: 10, isActive: true }] }, owner, 201)).data;
  const items = [{ productId: product.id, variantId: product.variants[0].id, quantity: 1 }];
  await http('/api/v1/cart/items', 'POST', items[0], customer);
  const address = { firstName: 'Backup', lastName: 'Customer', phone: '+1-555-0101', addressLine1: '123 Test St', city: 'Test City', state: 'CA', postalCode: '94016', country: 'US' };
  const quote = (await http('/api/v1/checkout/quote', 'POST', { shippingAddress: address, shippingOptionId: 'free-shipping:free' }, customer)).data;
  const order = (await http('/api/v1/orders/', 'POST', { items, shippingAddress: address, shippingOptionId: 'free-shipping:free', paymentMethod: 'manual-payment', expectedTotal: quote.total }, customer, 201)).data;
  await http('/api/v1/payments/create-session', 'POST', { orderId: order.id, paymentMethod: 'manual-payment', idempotencyKey: randomUUID() }, customer);
  await http(`/api/v1/admin/orders/${order.id}/record-manual-payment`, 'POST', { reference: 'backup-receipt' }, owner);
  assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus, 'PAID');
  return { productId: product.id, orderId: order.id, mediaUrl: media.url, mediaSha256 };
}
async function snapshot(proof) {
  const models = ['user', 'product', 'productVariant', 'order', 'orderItem', 'payment', 'paymentLedger', 'pluginNamespace', 'pluginMigrationSuccess', 'pluginPackageBlob'];
  const hashes = {};
  for (const model of models) {
    const rows = await db[model].findMany();
    hashes[model] = businessRowsHash(model, rows);
  }
  const namespace = await db.pluginNamespace.findUniqueOrThrow({ where: { slug: 'backup-probe' } });
  assert.match(namespace.schemaName, /^plugin_[a-z0-9_]+$/);
  const records = await db.$queryRawUnsafe(`SELECT * FROM "${namespace.schemaName}".records ORDER BY id`);
  hashes.pluginRecords = digest(JSON.stringify(records));
  const enabled = await db.pluginInstallation.findMany({ where: { pluginSlug: 'backup-probe' }, select: { id: true, enabled: true } });
  assert.equal(enabled.length, 1); assert.equal(enabled[0].enabled, true);
  hashes.pluginEnabled = digest(JSON.stringify(enabled));
  const objects = objectClient();
  try {
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const image = await objects.send(new GetObjectCommand({ Bucket: process.env.UPLOAD_S3_BUCKET, Key: proof.mediaUrl.replace(/^\/uploads\//, '') }));
    hashes.objectBytes = digest(Buffer.from(await image.Body.transformToByteArray()));
  } finally { objects.destroy(); }
  const { Client } = require('pg'), client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    hashes.rolesAndPrivileges = digest(JSON.stringify((await client.query("SELECT rolname, rolsuper, rolcreaterole, rolcreatedb, rolcanlogin FROM pg_roles WHERE rolname NOT LIKE 'pg_%' ORDER BY rolname")).rows));
    hashes.schemaPrivileges = digest(JSON.stringify((await client.query('SELECT has_schema_privilege($1,$2,$3) AS schema_read, has_table_privilege($1,$4,$5) AS table_read', ['backup_reader', namespace.schemaName, 'USAGE', namespace.schemaName + '.records', 'SELECT'])).rows));
  } finally { await client.end(); }
  return hashes;
}
async function mutate(proof) {
  await db.product.update({ where: { id: proof.productId }, data: { name: 'Post-backup mutation' } });
  const namespace = await db.pluginNamespace.findUniqueOrThrow({ where: { slug: 'backup-probe' } });
  assert.match(namespace.schemaName, /^plugin_[a-z0-9_]+$/);
  await db.$executeRawUnsafe(`INSERT INTO "${namespace.schemaName}".records VALUES ('after', 'post-backup')`);
  const { ListObjectsV2Command, PutObjectCommand } = require('@aws-sdk/client-s3');
  const client = objectClient();
  try {
    const objects = await client.send(new ListObjectsV2Command({ Bucket: process.env.UPLOAD_S3_BUCKET }));
    const object = objects.Contents.find(entry => proof.mediaUrl.includes(entry.Key)); assert.ok(object);
    await client.send(new PutObjectCommand({ Bucket: process.env.UPLOAD_S3_BUCKET, Key: object.Key, Body: 'post-backup-mutated-object' }));
  } finally { client.destroy(); }
}
try {
  assert.equal(process.env.DATABASE_URL_TEST, 'postgresql://postgres:postgres@localhost:5432/jiffoo_core_test');
  assert.equal((await db.$queryRaw`SELECT current_database() AS name`)[0].name, 'jiffoo_core_test');
  const [mode, encoded] = process.argv.slice(2), proof = encoded ? JSON.parse(encoded) : undefined;
  if (mode === 'seed') console.log('BACKUP_PROOF ' + JSON.stringify(await seed()));
  else if (mode === 'snapshot') console.log('BACKUP_SNAPSHOT ' + JSON.stringify(await snapshot(proof)));
  else if (mode === 'mutate') { await mutate(proof); console.log('BACKUP_MUTATED'); }
  else if (mode === 'plugin-health') {
    for (const api of ['api-1', 'api-2']) {
      const response = await fetch(`http://${api}:3001/api/v1/extensions/plugin/backup-probe/api/records`);
      assert.equal(response.status, 200); assert.deepEqual((await response.json()).rows, [{ id: 'before', value: 'backup-point' }]);
      const image = await fetch(`http://${api}:3001` + proof.mediaUrl); assert.equal(image.status, 200);
      assert.equal(digest(Buffer.from(await image.arrayBuffer())), proof.mediaSha256);
    }
    console.log('BACKUP_PLUGIN_HEALTH passed');
  } else throw new Error('Unknown fixture mode');
} finally { await db.$disconnect(); }
