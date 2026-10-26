import { fork, type ChildProcess } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, expect, it } from 'vitest';

let core: Server;
let child: ChildProcess;
let shop: string;
let paid = false;
const reads: string[] = [];
const orderId = 'cm9abcdefghijklmnopqrstuv';

beforeAll(async () => {
  core = createServer((request, response) => {
    const path = new URL(request.url!, 'http://core.local').pathname;
    const send = (data: unknown, status = 200) => {
      response.writeHead(status, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ success: status === 200, data }));
    };
    if (path === '/api/v1/store/context') return send({ storeName: 'Payment return fixture', currency: 'USD', timezone: 'UTC', defaultLocale: 'en', supportedLocales: ['en'], logo: null });
    if (path === '/api/v1/store/theme') return send(null);
    if (path === '/api/v1/store/storefront-code') return send({ headCode: '', bodyStartCode: '', bodyEndCode: '', ga4MeasurementId: null, metaPixelId: null, baiduSiteKey: null });
    if (path === '/api/v1/products/categories') return send({ items: [], page: 1, totalPages: 1, total: 0 });
    if (path === '/api/v1/plugin-pages') return send([]);
    if (path === '/api/v1/account/profile') return send({ id: 'buyer', username: 'Buyer', email: 'buyer@example.test', locale: 'en', emailVerified: true });
    if (path === '/api/v1/cart') return send({ items: [], itemCount: 0, subtotal: 0 });
    if (path === '/api/v1/payments/verify/payment-reference') {
      reads.push('verify'); paid = true;
      return send({ status: 'paid', orderId });
    }
    if (path === `/api/v1/orders/${orderId}`) {
      reads.push(paid ? 'paid' : 'pending');
      return send({ id: orderId, orderNumber: 'JF-20261022-0001', status: paid ? 'PROCESSING' : 'PENDING',
        paymentStatus: paid ? 'PAID' : 'PENDING', paymentAttemptState: paid ? 'SUCCEEDED' : 'PENDING', paymentId: 'payment-reference',
        currency: 'USD', totalAmount: 10, shippingAmount: 0, taxAmount: 0, items: [],
        pluginReturnTarget: { path: '/apps/return-proof/studio', title: { en: 'Studio', 'zh-Hans': 'Studio', 'zh-Hant': 'Studio' } } });
    }
    send(null, 404);
  });
  await new Promise<void>(resolve => core.listen(0, '127.0.0.1', resolve));
  const address = core.address();
  if (!address || typeof address === 'string') throw new Error('Missing Core listener');
  child = fork(fileURLToPath(new URL('./helpers/availability-shop-child.mjs', import.meta.url)), [], {
    cwd: fileURLToPath(new URL('..', import.meta.url)), stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    env: { ...process.env, NODE_ENV: 'production', API_SERVICE_URL: `http://127.0.0.1:${address.port}`, STOREFRONT_URL: 'http://127.0.0.1:3003' },
  });
  child.stdout!.on('data', data => process.stdout.write(data)); child.stderr!.on('data', data => process.stderr.write(data));
  const ready = await Promise.race([once(child, 'message'), once(child, 'exit').then(([code]) => { throw new Error(`Shop exited ${code}`); })]);
  shop = `http://127.0.0.1:${(ready[0] as { port: number }).port}`;
}, 120000);

afterAll(async () => {
  if (child?.connected) { const exited = once(child, 'exit'); child.send('stop'); await exited; }
  if (core) { core.closeAllConnections(); await new Promise<void>(resolve => core.close(() => resolve())); }
}, 60000);

it('renders the newly verified paid order and plugin return link in the first HTTP response without client polling', async () => {
  const response = await fetch(`${shop}/en/checkout/return?order=${orderId}`, { headers: { Cookie: 'shop_access=fixture-customer' } });
  expect(response.status).toBe(200);
  const html = await response.text();
  expect(reads).toEqual(['pending', 'verify', 'paid']);
  expect(html).toMatch(/<h1[^>]*>Order placed, payment successful<\/h1>/);
  expect(html).toContain('href="/en/apps/return-proof/studio"');
  expect(html).not.toMatch(/<h1[^>]*>Confirming payment<\/h1>/);
  // The budget covers the real HTTP round trip against the real Shop and the real API,
  // matching the neighbouring real HTTP suites.
}, 180000);
