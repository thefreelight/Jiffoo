import { fork, type ChildProcess } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { chromium, expect as browserExpect, type Browser, type Page } from '@playwright/test';

let core: Server;
let child: ChildProcess;
let shop: string;
let status = 503;
let refreshOnly = false;
let healthy = false;
let browser: Browser;
let deniedPath = '';
let sessionFailure = false;
const users = new Map([
  ['alice@example.test', { token: 'ALICE_PRIVATE_TOKEN', username: 'Alice private profile', email: 'alice@example.test', locale: 'en', emailVerified: false, count: 3 }],
  ['bob@example.test', { token: 'BOB_PRIVATE_TOKEN', username: 'Bob private profile', email: 'bob@example.test', locale: 'en', emailVerified: false, count: 7 }],
]);
const orderId = 'cm9abcdefghijklmnopqrstuv';
const address = { firstName: 'Retained', lastName: 'Buyer', phone: '+1-555-0100', addressLine1: '1 Real HTTP Road', addressLine2: '', city: 'Boston', state: 'MA', postalCode: '02101', country: 'US' };
const orders: Array<{ id: string; owner: string }> = [];
const sessionOrders: string[] = [];
let arrivals = new Set<string>();
let releaseProfiles: (() => void) | undefined;
let profileLatch: Promise<void> | undefined;
const product = { id: 'cm8abcdefghijklmnopqrstuv', slug: 'fixture-product', name: 'Fixture product', description: null, categoryName: null, categorySlug: null, price: 10, stock: 20, images: [], variants: [{ id: 'cm7abcdefghijklmnopqrstuv', name: 'Standard', skuCode: 'SKU', salePrice: 10, stock: 20, attributes: null }] };
function cartFor(name: string, count: number) { return { items: [{ id: 'cm6abcdefghijklmnopqrstuv', productId: product.id, variantId: product.variants[0].id, productName: `${name} private cart`, variantName: 'Standard', price: 10, quantity: count, maxQuantity: 20, subtotal: count * 10 }], itemCount: count, subtotal: count * 10 }; }
function orderFor(id: string) { return { id, createdAt: '2026-10-05T00:00:00Z', status: 'PENDING', paymentStatus: 'PENDING', paymentInstructions: null, paymentSessionId: null, items: [], shippingAddress: address, currency: 'USD', subtotalAmount: 30, shippingAmount: 0, taxAmount: 0, totalAmount: 30, taxInclusive: false, shippingMethod: { label: 'Free shipping' }, shipments: [], cancelReason: null, cancelledAt: null, unpaidExpiresAt: null }; }
const calls: Array<{ path: string; authorization?: string }> = [];

beforeAll(async () => {
  core = createServer(async (req, res) => {
    const path = new URL(req.url!, 'http://core.local').pathname;
    calls.push({ path, authorization: req.headers.authorization });
    if (healthy) {
      const send = (data: unknown, responseStatus = 200) => { res.writeHead(responseStatus, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: true, data })); };
      const user = [...users.values()].find((value) => req.headers.authorization === `Bearer ${value.token}`);
      if (path === '/api/v1/auth/login') {
        let raw = ''; for await (const chunk of req) raw += chunk;
        const credentials = JSON.parse(raw);
        const found = users.get(credentials.identifier);
        if (!found || credentials.password !== 'FixturePassword123!') { send(null, 401); return; }
        send({ access_token: found.token, refresh_token: 'FIXTURE_REFRESH', expires_in: 3600 }); return;
      }
      if ((deniedPath === path && (req.method !== 'GET' || path === '/api/v1/auth/verify-email')) || (sessionFailure && path === '/api/v1/payments/create-session')) {
        if (path === '/api/v1/payments/create-session') { let raw = ''; for await (const chunk of req) raw += chunk; sessionOrders.push(JSON.parse(raw).orderId); sessionFailure = false; }
        res.writeHead(status, { 'Content-Type': 'application/json', 'Retry-After': path.includes('create-session') ? '1' : '30' });
        res.end(JSON.stringify({ success: false, error: { code: status === 429 ? 'RATE_LIMITED' : 'SHARED_PROTECTION_UNAVAILABLE' } })); return;
      }
      if (path === '/api/v1/store/context') { send({ storeName: 'HTTP fixture shop', logo: null, currency: 'USD', defaultLocale: 'en', supportedLocales: ['en', 'zh-Hans', 'zh-Hant'] }); return; }
      if (path === '/api/v1/store/theme') { send(null); return; }
      if (path === '/api/v1/store/storefront-code') { send({ headCode: '', bodyStartCode: '', bodyEndCode: '', ga4MeasurementId: null, metaPixelId: null, baiduSiteKey: null }); return; }
      if (path === '/api/v1/products/categories') { send({ items: user ? [{ id: 'category', slug: 'private', name: `${user.username} category`, description: null, productCount: 1 }] : [], page: 1, totalPages: 1, total: 1 }); return; }
      if (path === '/api/v1/products') { send({ items: [product], page: 1, totalPages: 1, total: 1 }); return; }
      if (path === '/api/v1/products/by-slug/fixture-product') { send(product); return; }
      if (path === '/api/v1/account/profile') {
        if (!user) { send(null, 401); return; }
        if (profileLatch) { arrivals.add(user.token); if (arrivals.size === 2) releaseProfiles!(); await profileLatch; }
        send({ username: user.username, email: user.email, locale: user.locale, emailVerified: user.emailVerified }); return;
      }
      if (path === '/api/v1/cart') { send(user ? cartFor(user.username, user.count) : null, user ? 200 : 401); return; }
      if (path === '/api/v1/orders' && req.method === 'POST') { orders.push({ id: orderId, owner: user!.token }); send(orderFor(orderId)); return; }
      if (path === '/api/v1/orders') { send({ items: orders.filter((order) => order.owner === user?.token).map((order) => orderFor(order.id)), page: 1, totalPages: 1, total: orders.length }); return; }
      if (path === `/api/v1/orders/${orderId}`) { send(orderFor(orderId)); return; }
      if (path === '/api/v1/checkout/quote') { send({ currency: 'USD', subtotal: '30.00', shippingOptions: [{ id: 'free', label: 'Free shipping', amount: '0.00' }], paymentMethods: [{ providerSlug: 'manual', displayName: 'Manual payment' }], tax: '0.00', total: '30.00' }); return; }
      if (path === '/api/v1/payments/create-session') { let raw = ''; for await (const chunk of req) raw += chunk; sessionOrders.push(JSON.parse(raw).orderId); send({ action: { type: 'instructions' } }); return; }
      send(null, 404); return;
    }
    if (refreshOnly && path !== '/api/v1/auth/refresh') {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED' } }));
      return;
    }
    const retry = path.includes('storefront-code') ? 19 : path.includes('theme') ? 13 : 7;
    res.writeHead(status, { 'Content-Type': 'application/json', 'Retry-After': String(retry) });
    res.end(JSON.stringify({ success: false, error: { code: status === 503 ? 'SHARED_PROTECTION_UNAVAILABLE' : 'RATE_LIMITED', message: 'PRIVATE_CORE_DETAIL' } }));
  });
  await new Promise<void>((resolve) => core.listen(0, '127.0.0.1', resolve));
  const address = core.address();
  if (!address || typeof address === 'string') throw new Error('Missing Core fixture listener');
  child = fork(fileURLToPath(new URL('./helpers/availability-shop-child.mjs', import.meta.url)), [], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...process.env, NODE_ENV: 'production', API_SERVICE_URL: `http://127.0.0.1:${address.port}`, STOREFRONT_URL: 'http://127.0.0.1:3003' },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  child.stdout!.on('data', (data) => process.stdout.write(data));
  child.stderr!.on('data', (data) => process.stderr.write(data));
  const ready = await Promise.race([once(child, 'message'), once(child, 'exit').then(([code]) => { throw new Error(`Shop fixture exited ${code}`); })]);
  shop = `http://127.0.0.1:${(ready[0] as { port: number }).port}`;
  browser = await chromium.launch({ channel: 'msedge' });
}, 180000);

afterAll(async () => {
  if (browser) await browser.close();
  if (child?.connected) { const exited = once(child, 'exit'); child.send('stop'); await exited; }
  if (core) { core.closeAllConnections(); await new Promise<void>((resolve, reject) => core.close((error) => error ? reject(error) : resolve())); }
}, 60000);

it('N real HTTP Shop rendering propagates 503 and 429 with the latest deadline and isolates availability HTML and assets', async () => {
  for (const failure of [503, 429]) {
    status = failure;
    calls.length = 0;
    const started = Date.now();
    const response = await fetch(`${shop}/en/products`, { headers: { Cookie: 'shop_access=SSR_PRIVATE_TOKEN' } });
    expect(response.status).toBe(failure);
    expect(new URL(response.url).pathname).toBe('/availability');
    expect(Number(new URL(response.url).searchParams.get('retryAt'))).toBeGreaterThanOrEqual(started + 19000);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(Number(response.headers.get('Retry-After'))).toBeGreaterThan(0);
    const html = await response.text();
    expect(html).not.toMatch(/SSR_PRIVATE_TOKEN|PRIVATE_CORE_DETAIL|StorefrontProviders|google|facebook/);
    expect(calls.some((call) => call.path === '/api/v1/store/theme')).toBe(true);
    expect(calls.some((call) => call.path === '/api/v1/store/storefront-code')).toBe(true);
    expect(calls.every((call) => call.authorization === 'Bearer SSR_PRIVATE_TOKEN')).toBe(true);
    const count = calls.length;
    for (const path of [new URL(response.url).pathname + new URL(response.url).search, '/availability.js', '/availability.css']) {
      const standalone = await fetch(`${shop}${path}`, { headers: { Cookie: 'shop_access=SSR_PRIVATE_TOKEN' } });
      expect(await standalone.text()).not.toContain('SSR_PRIVATE_TOKEN');
    }
    expect(calls).toHaveLength(count);
  }
}, 180000);

it('P real HTTP BFF preserves availability and refresh cookies without exposing tokens or upstream details', async () => {
  for (const failure of [429, 503]) {
    status = failure;
    refreshOnly = false;
    const direct = await fetch(`${shop}/bff/auth/forgot-password`, { method: 'POST', headers: { Origin: shop, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'retained@example.test' }) });
    expect(direct.status).toBe(failure);
    expect(direct.headers.get('Retry-After')).toBe('7');
    expect(direct.headers.get('Cache-Control')).toBe('no-store');
    expect(await direct.text()).not.toContain('PRIVATE_CORE_DETAIL');
    refreshOnly = true;
    calls.length = 0;
    const refresh = await fetch(`${shop}/bff/account/profile`, { headers: { Cookie: 'shop_access=EXPIRED_PRIVATE_TOKEN; shop_refresh=REFRESH_PRIVATE_TOKEN' } });
    expect(refresh.status).toBe(failure);
    expect(refresh.headers.get('set-cookie')).toBeNull();
    const body = await refresh.json();
    expect(body.error.code).toBe(failure === 429 ? 'RATE_LIMITED' : 'SHARED_PROTECTION_UNAVAILABLE');
    expect(body.error.details.retryAt).toBeGreaterThan(Date.now());
    expect(JSON.stringify(body)).not.toMatch(/PRIVATE_TOKEN|PRIVATE_CORE_DETAIL/);
    expect(calls.map((call) => call.path)).toEqual(['/api/v1/account/profile', '/api/v1/auth/refresh']);
    expect(calls[0].authorization).toBe('Bearer EXPIRED_PRIVATE_TOKEN');
    expect(calls[1].authorization).toBeUndefined();
  }
}, 180000);

it('G1 concurrent real SSR requests isolate authenticated profiles and carts from other users and anonymous requests', async () => {
  healthy = true; refreshOnly = false; calls.length = 0;
  const cookies = await Promise.all([...users.keys()].map(async (email) => {
    const response = await fetch(`${shop}/bff/auth/login`, { method: 'POST', headers: { Origin: shop, 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: email, password: 'FixturePassword123!' }) });
    expect(response.status).toBe(200);
    return response.headers.getSetCookie().map((cookie) => cookie.split(';')[0]).join('; ');
  }));
  arrivals = new Set(); profileLatch = new Promise<void>((resolve) => { releaseProfiles = resolve; });
  const pages = await Promise.all(cookies.map(async (cookie) => (await fetch(`${shop}/en/account`, { headers: { Cookie: cookie } })).text()));
  profileLatch = undefined;
  for (const [index, user] of [...users.values()].entries()) {
    const other = [...users.values()][1 - index];
    expect(pages[index]).toContain(user.username);
    expect(pages[index]).toContain(user.email);
    expect(pages[index]).toContain(`Cart (${user.count})`);
    expect(pages[index]).not.toContain(other.username);
    expect(pages[index]).not.toContain(other.email);
    expect(pages[index]).not.toMatch(/ALICE_PRIVATE_TOKEN|BOB_PRIVATE_TOKEN/);
    const cartPage = await (await fetch(`${shop}/en/cart`, { headers: { Cookie: cookies[index] } })).text();
    expect(cartPage).toContain(`${user.username} private cart`);
    expect(cartPage).not.toContain(`${other.username} private cart`);
  }
  const anonymous = await (await fetch(`${shop}/en/account`)).text();
  for (const user of users.values()) expect(anonymous).not.toContain(user.username);
  expect(anonymous).not.toMatch(/Cart \((3|7)\)/);
  expect(arrivals.size).toBe(2);
}, 180000);

async function signedInPage(): Promise<Page> {
  deniedPath = ''; sessionFailure = false; healthy = true;
  const page = await browser.newPage();
  await page.goto(`${shop}/en/login?next=%2Fen%2Faccount`);
  await page.getByLabel('Email', { exact: true }).fill('alice@example.test');
  await page.getByLabel('Password', { exact: true }).fill('FixturePassword123!');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await browserExpect(page).toHaveURL(`${shop}/en/account`);
  return page;
}
async function quotePage(page: Page) {
  await page.goto(`${shop}/en/checkout`);
  for (const [label, value] of [['First name', address.firstName], ['Last name', address.lastName], ['Phone', address.phone], ['Address line 1', address.addressLine1], ['City', address.city], ['State / province', address.state], ['Postal code', address.postalCode]]) await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByRole('combobox', { name: 'Country', exact: true }).selectOption('US');
}

it('G2 real checkout retries a 429 or 503 payment session with exactly one HTTP-created order and the same order id', async () => {
  for (const failure of [429, 503]) {
    orders.length = 0; sessionOrders.length = 0;
    const page = await signedInPage();
    try {
      await quotePage(page);
      await page.getByRole('button', { name: 'Get shipping options' }).click();
      await page.getByRole('radio', { name: /Free shipping/ }).check();
      await page.getByRole('radio', { name: 'Manual payment' }).check();
      status = failure; sessionFailure = true;
      await page.getByRole('button', { name: 'Place order' }).click();
      await browserExpect(page.getByRole('main').getByRole('alert')).toContainText(failure === 429 ? 'Too many requests' : 'Shop temporarily unavailable');
      expect(orders).toHaveLength(1);
      expect(sessionOrders).toEqual([orderId]);
      await browserExpect(page.getByLabel('First name')).toHaveValue(address.firstName);
      await browserExpect(page.getByRole('button', { name: 'Place order' })).toBeEnabled({ timeout: 10000 });
      expect(sessionOrders).toEqual([orderId]);
      await page.getByRole('button', { name: 'Place order' }).click();
      await browserExpect(page).toHaveURL(new RegExp(`/en/checkout/complete\\?order=${orderId}$`));
      const response = await page.request.get(`${shop}/bff/orders`);
      expect((await response.json()).data.items).toHaveLength(1);
      expect(orders).toHaveLength(1);
      expect(sessionOrders).toEqual([orderId, orderId]);
    } finally { await page.close(); }
  }
}, 180000);

it.each(['account-management', 'auth-form', 'auth-links', 'cart-view', 'checkout-view', 'order-detail', 'variant-picker', 'verify-email-action'])('G3 %s executes its real availability branch and retains input without replay', async (component) => {
  for (const failure of [429, 503]) {
    const page = await signedInPage();
    try {
      status = failure;
      if (component === 'account-management') {
        deniedPath = '/api/v1/account/profile';
        await page.getByLabel('Name', { exact: true }).fill('Retained account input');
        await page.getByRole('region', { name: 'Account', exact: true }).getByRole('button', { name: 'Save', exact: true }).click();
        await browserExpect(page.getByRole('main').getByRole('alert')).toContainText(failure === 429 ? 'Too many requests' : 'Shop temporarily unavailable');
        await browserExpect(page.getByLabel('Name', { exact: true })).toHaveValue('Retained account input');
        deniedPath = ''; await page.reload(); deniedPath = '/api/v1/auth/resend-verification';
        await page.getByRole('button', { name: 'Resend verification', exact: true }).click();
        await browserExpect(page.getByText('Request received. Please check your inbox.', { exact: true })).toHaveCount(0);
      } else if (component === 'auth-form') {
        await page.goto(`${shop}/en/forgot-password`); deniedPath = '/api/v1/auth/forgot-password';
        await page.getByLabel('Email', { exact: true }).fill('retained@example.test');
        await page.getByRole('button', { name: 'Request reset link' }).click();
        await browserExpect(page.getByLabel('Email', { exact: true })).toHaveValue('retained@example.test');
      } else if (component === 'auth-links') {
        deniedPath = '/api/v1/auth/logout';
        await page.getByRole('button', { name: 'Logout', exact: true }).click();
        await browserExpect(page).toHaveURL(`${shop}/en/account`);
      } else if (component === 'cart-view') {
        await page.goto(`${shop}/en/cart`); deniedPath = '/api/v1/cart/items/cm6abcdefghijklmnopqrstuv';
        await page.getByLabel('Quantity', { exact: true }).fill('4');
        await browserExpect(page.getByLabel('Quantity', { exact: true })).toHaveValue('4');
      } else if (component === 'checkout-view') {
        await quotePage(page); deniedPath = '/api/v1/checkout/quote';
        await page.getByRole('button', { name: 'Get shipping options' }).click();
        await browserExpect(page.getByRole('main').getByRole('alert')).toContainText(failure === 429 ? 'Too many requests' : 'Shop temporarily unavailable');
        await browserExpect(page.getByLabel('First name', { exact: true })).toHaveValue(address.firstName);
        deniedPath = ''; await page.reload();
        await page.getByRole('button', { name: 'Get shipping options' }).click();
        await browserExpect(page.getByRole('radio', { name: /Free shipping/ })).toBeVisible();
        deniedPath = '/api/v1/checkout/quote';
        await page.getByRole('radio', { name: /Free shipping/ }).check();
        await browserExpect(page.getByRole('radio', { name: /Free shipping/ })).toBeChecked();
      } else if (component === 'order-detail') {
        await page.goto(`${shop}/en/account/orders/${orderId}`); deniedPath = `/api/v1/orders/${orderId}/cancel`;
        await page.getByRole('button', { name: 'Cancel order', exact: true }).click();
        await page.getByRole('combobox', { name: 'Reason', exact: true }).selectOption('other');
        await page.getByLabel('Other reason', { exact: true }).fill('Retained cancellation input');
        await page.getByRole('button', { name: 'Confirm cancellation' }).click();
        await browserExpect(page.getByLabel('Other reason', { exact: true })).toHaveValue('Retained cancellation input');
      } else if (component === 'variant-picker') {
        await page.goto(`${shop}/en/products/fixture-product`); deniedPath = '/api/v1/cart/items';
        await page.getByLabel('Quantity', { exact: true }).fill('4');
        await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
        await browserExpect(page.getByLabel('Quantity', { exact: true })).toHaveValue('4');
      } else {
        await page.goto(`${shop}/en/verify-email?token=retained-verification-token`); deniedPath = '/api/v1/auth/verify-email';
        await page.getByRole('button', { name: 'Verify my email' }).click();
        await browserExpect(page).toHaveURL(`${shop}/en/verify-email?token=retained-verification-token`);
      }
      await browserExpect(page.getByText(new RegExp(`${failure === 429 ? 'Too many requests' : 'Shop temporarily unavailable'}.*seconds`))).toBeVisible();
      const count = calls.filter((call) => call.path === deniedPath).length;
      await browserExpect(page.getByRole('button', { name: component === 'account-management' ? 'Save' : component === 'auth-form' ? 'Request reset link' : component === 'auth-links' ? 'Logout' : component === 'checkout-view' ? 'Get shipping options' : component === 'order-detail' ? 'Confirm cancellation' : component === 'variant-picker' ? 'Add to cart' : component === 'verify-email-action' ? 'Verify my email' : /Remove/ }).first()).toBeDisabled();
      expect(calls.filter((call) => call.path === deniedPath)).toHaveLength(count);
    } finally { deniedPath = ''; await page.close(); }
  }
}, 180000);
