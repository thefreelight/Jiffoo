import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import { resolve } from 'node:path';
import { AcceptanceChecks, scenarioPlans } from './checks.mjs';

const checks = new AcceptanceChecks();

const mode = process.argv[2];
const require = createRequire(resolve('package.json'));
const bases = ['http://api-1:3001', 'http://api-2:3001'];
async function http(base, path, method = 'GET', body, token, expected = 200) {
  const response = await fetch(base + path, {
    method, signal: AbortSignal.timeout(30000),
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body && !(body instanceof FormData) ? { 'content-type': 'application/json' } : {}) },
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
  const text = await response.text();
  assert.equal(response.status, expected, `${method} ${path}: ${text}`);
  return text ? JSON.parse(text) : undefined;
}
async function edge(path, headers = {}, host = new URL(process.env.STOREFRONT_URL).host) {
  const ca = await readFile('/tls/cert.pem');
  return new Promise((done, reject) => {
    const req = httpsRequest({ hostname: 'edge', port: 8443, servername: new URL('https://' + host).hostname, ca, path, headers: { host, ...headers } }, response => {
      const chunks = [];
      response.on('data', bytes => chunks.push(bytes));
      response.once('end', () => done({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks).toString() }));
    });
    req.setTimeout(30000, () => req.destroy(new Error('HTTPS request timed out')));
    req.once('error', reject); req.end();
  });
}
async function zip(entries, directory) {
  const archiver = require('archiver');
  const archive = archiver('zip'); const chunks = [];
  const done = new Promise((resolve, reject) => { archive.on('data', data => chunks.push(data)); archive.once('end', resolve); archive.once('error', reject); });
  if (directory) archive.glob('**/*', { cwd: directory, ignore: ['theme.json'], dot: true });
  for (const [name, data] of Object.entries(entries)) archive.append(data, { name });
  await archive.finalize(); await done; return Buffer.concat(chunks);
}
function form(bytes, filename, fields = {}) {
  const value = new FormData();
  for (const [name, data] of Object.entries(fields)) value.set(name, data);
  value.set('file', new Blob([bytes], { type: filename.endsWith('.png') ? 'image/png' : 'application/zip' }), filename); return value;
}
async function state() {
  assert.equal(process.env.DATABASE_URL_TEST, 'postgresql://postgres:postgres@localhost:5432/jiffoo_core_test');
  const { PrismaClient } = require('@prisma/client');
  const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL_TEST } } });
  try {
    await checks.run('Database identity', [], async () => {
      const actual = await db.$queryRaw`SELECT current_database() AS name`;
      assert.equal(actual[0].name, 'jiffoo_core_test');
    });
    await checks.run('Concurrent builtin initialization', ['Database identity'], async () => {
      assert.equal(await db.pluginInstall.count({ where: { source: 'builtin' } }), 5, 'Racing first starts must install each builtin once');
      assert.equal(await db.pluginInstallation.count(), 5);
      assert.equal(await db.theme.count(), 2);
    });
    const password = randomUUID() + 'Aa1!';
    const ownerEmail = 'compose-owner@example.test';
    const customerEmail = 'compose-customer@example.test';
    await checks.run('Owner installation and login', ['Database identity'], async () => {
      await http(bases[0], '/api/v1/install/complete', 'POST', { siteName: 'Compose acceptance', adminEmail: ownerEmail, adminPassword: password });
      const token = (await http(bases[1], '/api/v1/auth/login', 'POST', { email: ownerEmail, password, surface: 'admin' })).data.access_token;
      assert.equal(typeof token, 'string'); return token;
    });
    await checks.run('Customer registration and login', ['Database identity'], async () => {
      await http(bases[0], '/api/v1/auth/register', 'POST', { email: customerEmail, username: 'compose-customer', password }, undefined, 201);
      const token = (await http(bases[1], '/api/v1/auth/login', 'POST', { email: customerEmail, password })).data.access_token;
      assert.equal(typeof token, 'string'); return token;
    });
    const owner = checks.value('Owner installation and login');
    const customer = checks.value('Customer registration and login');
    await checks.run('Plugin disable and enable propagation', ['Owner installation and login'], async () => {
      const slug = 'compose-probe';
      const manifest = { schemaVersion: 1, slug, name: slug, version: '1.0.0', description: 'Compose propagation probe', category: 'shipping', runtimeType: 'internal-fastify', hostProtocol: 'internal-fastify-v1', entryModule: 'server/index.js', permissions: [], contracts: [{ name: 'shipping', version: 1 }], subscriptions: [] };
      manifest.ui = { bridgeVersion: 1, assetDirectory: 'ui', storefrontPages: [{ id: 'probe', path: '/probe', entry: 'index.html', title: { en: 'Probe', 'zh-Hans': 'Probe', 'zh-Hant': 'Probe' }, placements: ['header-nav'], requiresLogin: false }], adminPages: [] };
      const bytes = await zip({ 'manifest.json': JSON.stringify(manifest), 'ui/index.html': '<!doctype html><html><body>Compose page probe</body></html>', 'server/index.js': "module.exports = { register(ctx) { ctx.http.route({ method: 'GET', path: '/probe', handler: () => ({ serving: true }) }); ctx.contracts.implement('shipping', 1, { quote: () => ({ options: [{ id: 'standard', label: 'Compose shipping', amountMinor: 0 }] }) }); } };" });
      const preview = (await http(bases[0], '/api/v1/extensions/plugin/preview', 'POST', form(bytes, 'plugin.zip'), owner)).data;
      const operation = (await http(bases[0], '/api/v1/extensions/plugin/install', 'POST', form(bytes, 'plugin.zip', { previewToken: preview.previewToken, confirmUnsigned: 'true', confirmationSlug: slug,
        ...(preview.migrationPlan.changesDatabase ? { confirmMigrations: 'true' } : {}) }), owner, 202)).data;
      let terminal;
      const deadline = Date.now() + 60000;
      do {
        terminal = (await http(bases[1], `/api/v1/extensions/plugin/operations/${operation.operationId}?wait=true`, 'GET', undefined, owner)).data;
        if (Date.now() > deadline) throw new Error('Plugin installation timed out');
      } while (!terminal.terminal);
      assert.equal(terminal.phase, 'SUCCESS');
      const instance = await db.pluginInstallation.findUniqueOrThrow({ where: { pluginSlug_instanceKey: { pluginSlug: slug, instanceKey: 'default' } } });
      const toggle = async enabled => http(bases[0], `/api/v1/extensions/plugin/${slug}/instances/${instance.id}`, 'PATCH', { enabled }, owner);
      await toggle(true);
      for (const base of bases) assert.equal((await http(base, `/api/v1/extensions/plugin/${slug}/api/probe`)).serving, true);
      await toggle(false);
      for (const base of bases) assert.equal((await http(base, `/api/v1/extensions/plugin/${slug}/api/probe`, 'GET', undefined, undefined, 503)).error.code, 'PLUGIN_DISABLED');
      await toggle(true);
      for (const base of bases) assert.equal((await http(base, `/api/v1/extensions/plugin/${slug}/api/probe`)).serving, true);
      return `/api/v1/plugin-assets/${instance.id}/${createHash('sha256').update(bytes).digest('hex')}/index.html`;
    });
    await checks.run('Plugin HTML authority across both proxies', ['Plugin disable and enable propagation'], async () => {
      const path = checks.value('Plugin disable and enable propagation');
      const shop = new URL(process.env.STOREFRONT_URL), admin = new URL(process.env.ADMIN_URL);
      for (const origin of [shop, admin]) {
        const response = await edge(path, {}, origin.host);
        assert.equal(response.status, 200, response.body);
        assert.ok(response.body.includes('Compose page probe'));
        assert.ok(response.headers['content-security-policy'].includes(`script-src ${origin.origin};`));
        for (const base of bases) {
          // fetch() reserves Host; use the HTTP transport to exercise actual authority.
          const status = await new Promise((done, reject) => {
            const request = httpRequest(base + path, { headers: { host: origin.host }, signal: AbortSignal.timeout(30000) }, response => {
              response.resume(); response.once('end', () => done(response.statusCode));
            });
            request.once('error', reject); request.end();
          });
          assert.equal(status, 200, `${base} must serve the configured authority ${origin.host}`);
        }
      }
      for (const authority of [shop.hostname, shop.hostname + ':9443', 'evil.example', shop.host + '.evil.example']) {
        const response = await edge(path, { host: authority, 'x-forwarded-host': shop.host, 'x-forwarded-port': '8443', 'x-forwarded-proto': 'https', forwarded: `host=${shop.host};proto=https` });
        assert.equal(response.status, 404, response.body);
      }
      const spoofed = await edge(path, { 'x-forwarded-host': 'evil.example', 'x-forwarded-port': '9443', 'x-forwarded-proto': 'http' });
      assert.equal(spoofed.status, 200);
      assert.ok(spoofed.headers['content-security-policy'].includes(`script-src ${shop.origin};`));
    });
    await checks.run('Warm theme switch across APIs', ['Owner installation and login'], async () => {

      const themeDirectory = resolve('builtin-themes/default-shop');
      const theme = JSON.parse(await readFile(themeDirectory + '/theme.json', 'utf8'));
      theme.slug = 'compose-shop'; theme.name = 'Compose Shop';
      const themeZip = await zip({ 'theme.json': JSON.stringify(theme) }, themeDirectory);
      await http(bases[0], '/api/v1/extensions/theme/install', 'POST', form(themeZip, 'theme.zip', { confirmUnsigned: 'true' }), owner);
      for (const base of bases) assert.equal((await http(base, '/api/v1/store/theme?target=shop&locale=en')).data.slug, 'default-shop');
      await http(bases[0], '/api/v1/extensions/themes/shop/activate', 'POST', { slug: theme.slug }, owner);
      for (const base of bases) assert.equal((await http(base, '/api/v1/store/theme?target=shop&locale=en')).data.slug, theme.slug);
    });
    await checks.run('Shared S3 upload and read', ['Owner installation and login'], async () => {

      const sharp = require('sharp');
      const image = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#143a72' } }).png().toBuffer();
      const media = (await http(bases[0], '/api/v1/admin/products/upload-image', 'POST', form(image, 'image.png'), owner)).data;
      const fetched = await Promise.all(bases.map(async base => { const response = await fetch(base + media.url); assert.equal(response.status, 200); return Buffer.from(await response.arrayBuffer()); }));
      assert.deepEqual(fetched[0], fetched[1]);
    });
    await checks.run('Product cart and order creation', ['Owner installation and login', 'Customer registration and login'], async () => {

      const product = (await http(bases[0], '/api/v1/admin/products/', 'POST', { name: 'Compose product', requiresShipping: true, variants: [{ name: 'Default', salePrice: 12.5, stock: 10, isActive: true }] }, owner, 201)).data;
      const items = [{ productId: product.id, variantId: product.variants[0].id, quantity: 1 }];
      await http(bases[1], '/api/v1/cart/items', 'POST', items[0], customer);
      const address = { firstName: 'Compose', lastName: 'Customer', phone: '+1-555-0101', addressLine1: '123 Test St', city: 'Test City', state: 'CA', postalCode: '94016', country: 'US' };
      const quote = (await http(bases[1], '/api/v1/checkout/quote', 'POST', { shippingAddress: address, shippingOptionId: 'free-shipping:free' }, customer)).data;
      const order = (await http(bases[0], '/api/v1/orders/', 'POST', { items, shippingAddress: address, shippingOptionId: 'free-shipping:free', paymentMethod: 'manual-payment', expectedTotal: quote.total, idempotencyKey: randomUUID() }, customer, 201)).data;
      return order;
    });
    const order = checks.value('Product cart and order creation');
    await checks.run('Manual payment across APIs', ['Product cart and order creation'], async () => {
      await http(bases[1], '/api/v1/payments/create-session', 'POST', { orderId: order.id, paymentMethod: 'manual-payment', idempotencyKey: randomUUID() }, customer);
      const reference = randomUUID();
      // Repeat the same receipt through the other API and retain the one-capture assertion.
      for (const base of bases) await http(base, `/api/v1/admin/orders/${order.id}/record-manual-payment`, 'POST', { reference }, owner);
      for (const base of bases) assert.equal((await http(base, `/api/v1/admin/orders/${order.id}`, 'GET', undefined, owner)).data.paymentStatus, 'PAID');
    });
    if (checks.rows.find(row => row.name === 'Manual payment across APIs')?.status === 'PASS') {
      const { orderNumber } = await db.order.findUniqueOrThrow({ where: { id: order.id }, select: { orderNumber: true } });
      console.info('COMPOSE_NOTIFICATION_PROOF ' + JSON.stringify({ orderId: order.id, orderNumber, to: customerEmail }));
    }
    await checks.run('Payment notification persisted exactly once', ['Manual payment across APIs'], async () => {
      const sentDeadline = Date.now() + 90000;
      let notification;
      for (;;) {
        const rows = await db.notification.findMany({ where: { type: 'payment_received', relatedId: order.id } });
        assert.ok(rows.length <= 1, 'Payment notification must never be duplicated');
        notification = rows[0];
        if (notification?.status === 'SENT') { assert.equal(rows.length, 1); break; }
        if (Date.now() > sentDeadline) throw new Error(`Notification was not sent: ${JSON.stringify({ count: rows.length, status: notification?.status, attempts: notification?.attempts })}`);
        await new Promise(done => setTimeout(done, 100));
      }
      assert.equal(notification.status, 'SENT');
      assert.equal(notification.attempts, 0);
      assert.equal(notification.providerSlug, 'console-email');
      assert.equal(typeof notification.providerMessageId, 'string');
      assert.ok(notification.providerMessageId.length > 0);
      assert.equal(notification.providerMessageId, `console_${notification.id}`);
    });
    await checks.run('Shipping and delivery across APIs', ['Manual payment across APIs'], async () => {
      await http(bases[0], `/api/v1/admin/orders/${order.id}/ship`, 'POST', { trackingNumber: 'compose-tracking', carrier: 'Compose carrier' }, owner);
      await http(bases[1], `/api/v1/admin/orders/${order.id}/deliver`, 'POST', {}, owner);
    });
  } finally { await db.$disconnect(); }
}

async function s3Privileges() {
  const { S3Client, HeadBucketCommand, PutObjectCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, CreateBucketCommand } = require('@aws-sdk/client-s3');
  const client = new S3Client({ endpoint: process.env.UPLOAD_S3_ENDPOINT, region: process.env.UPLOAD_S3_REGION,
    credentials: { accessKeyId: process.env.UPLOAD_S3_ACCESS_KEY_ID, secretAccessKey: process.env.UPLOAD_S3_SECRET_ACCESS_KEY },
    forcePathStyle: true, maxAttempts: 1, requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED',
    requestHandler: { connectionTimeout: 3000, requestTimeout: 10000 } });
  const Bucket = process.env.UPLOAD_S3_BUCKET;
  const denied = command => assert.rejects(client.send(command), error => error.name === 'AccessDenied' && error.$metadata?.httpStatusCode === 403, 'Application identity must receive AccessDenied (403)');
  try {
    await checks.run('Configured bucket S3 operations', [], async () => {
      const Key = 'privilege-probe.txt';
      await client.send(new HeadBucketCommand({ Bucket }));
      await client.send(new PutObjectCommand({ Bucket, Key, Body: 'application-scope-probe' }));
      const object = await client.send(new GetObjectCommand({ Bucket, Key }));
      assert.equal(await object.Body.transformToString(), 'application-scope-probe');
      assert.equal((await client.send(new HeadObjectCommand({ Bucket, Key }))).ContentLength, 23);
      assert.ok((await client.send(new ListObjectsV2Command({ Bucket, Prefix: Key }))).Contents.some(object => object.Key === Key));
    });
    await checks.run('Application S3 cannot create buckets', [], () => denied(new CreateBucketCommand({ Bucket: `${Bucket}-forbidden` })));
    await checks.run('Application S3 cannot read outside bucket', [], () => denied(new GetObjectCommand({ Bucket: `${Bucket}-outside`, Key: 'probe.txt' })));
    await checks.run('Application S3 cannot write outside bucket', [], () => denied(new PutObjectCommand({ Bucket: `${Bucket}-outside`, Key: 'forbidden.txt', Body: 'must-be-denied' })));
    await checks.run('Application S3 cannot list outside bucket', [], () => denied(new ListObjectsV2Command({ Bucket: `${Bucket}-outside` })));
  } finally { client.destroy(); }
}

if (mode === 'state') {
  await checks.run('State checker runtime', [], state);
  await checks.run('Shop HTTPS frontend', [], async () => {
    const frontend = await edge('/en'); assert.equal(frontend.status, 200);
  });
  await checks.run('Admin HTTPS frontend', [], async () => {
    const frontend = await edge('/en/auth/login', {}, new URL(process.env.ADMIN_URL).hostname); assert.equal(frontend.status, 200);
  });
  await s3Privileges();
  for (const name of scenarioPlans.acceptance) {
    if (!checks.rows.some(row => row.name === name)) await checks.run(name, ['State checker runtime'], () => { throw new Error('Expected check was not executed'); });
  }
} else if (mode === 'rate-a') {
  await checks.run('Shared anonymous API budget', [], async () => {
    const responses = [];
    for (let offset = 0; offset < 1000; offset += 20) {
      responses.push(...await Promise.all(Array.from({ length: 20 }, (_, index) => fetch(bases[(offset + index) % 2] + '/api/v1/install/status').then(response => { response.body?.cancel(); return response.status; }))));
    }
    assert.equal(responses.filter(status => status === 200).length, 1000);
    for (const base of bases) await http(base, '/api/v1/install/status', 'GET', undefined, undefined, 429);
  });
  await checks.run('HTTPS API rejects spoofed forwarding headers', ['Shared anonymous API budget'], async () => {
    assert.equal((await edge('/api/v1/install/status', { 'x-forwarded-for': '203.0.113.99', forwarded: 'for=203.0.113.98', 'x-real-ip': '203.0.113.97' })).status, 429);
  });
  await checks.run('Shop BFF preserves IP and rejects spoofed headers', ['Shared anonymous API budget'], async () => {
    assert.equal((await edge('/bff/auth/verify-email?token=compose-invalid-token', { 'x-forwarded-for': '203.0.113.99' })).status, 429);
  });
} else if (mode === 'rate-b') {
  await checks.run('Second client HTTPS API budget', [], async () => {
    assert.equal((await edge('/api/v1/install/status')).status, 200);
  });
  await checks.run('Second client Shop BFF budget', [], async () => {
    assert.equal((await edge('/bff/auth/verify-email?token=compose-invalid-token')).status, 400);
  });
} else throw new Error('Unknown acceptance mode');
console.info('COMPOSE_CHECK_RESULTS ' + JSON.stringify(checks.rows));
process.exitCode = checks.passed ? 0 : 1;
