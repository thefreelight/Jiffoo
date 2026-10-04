import { expect, test } from './local-requests';
import { api, login, ownerEmail } from './helpers';
import { shippingProject } from './sdk-project';
import { createHmac, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import type { APIRequestContext, Page } from '@playwright/test';

const db = new PrismaClient();
const provider = 'e2e-callback-payment';
const providerName = 'E2E Callback Payment';
const secret = 'e2e-only-callback-secret-not-a-live-key';
const apiOrigin = 'http://127.0.0.1:3001/api/v1';
type Order = { id: string; status: string; paymentStatus: string; paymentSessionId: string; totalAmount: number; currency: string; shippingAmount: number; shippingMethod: { providerSlug: string; label: string; amountMinor: number } };
type Callback = { eventId: string; sessionId: string; status: 'succeeded'; amountMinor: number; currency: string };
let adminToken: string;
const ownedSlugs = new Set<string>();
const ownedOrders = new Set<string>();

test.beforeAll(async () => {
  expect(new URL(process.env.DATABASE_URL_TEST!).pathname).toBe('/jiffoo_core_test');
});
test.beforeEach(async ({ request }) => {
  adminToken = (await api<{ token: string }>(request, '/auth/login', { method: 'POST', data: { email: ownerEmail, password: 'FinalOwnerPassword123!' } })).token;
});
test.afterEach(async ({ request }) => {
  // Cleanup uses normal product transitions only; all Prisma operations in this spec are reads.
  for (const id of ownedOrders) {
    const order = await api<{ paymentStatus: string; status: string }>(request, `/admin/orders/${id}`, { token: adminToken });
    if (order.paymentStatus === 'PENDING' && order.status !== 'CANCELLED') {
      await api(request, `/admin/orders/${id}/cancel`, { method: 'POST', token: adminToken, data: { cancelReason: 'Extension E2E cleanup' } });
    }
  }
  ownedOrders.clear();
  for (const slug of ownedSlugs) {
    const headers = { authorization: `Bearer ${adminToken}` };
    const current = await request.get(`${apiOrigin}/extensions/plugin/${slug}`, { headers });
    if (current.status() === 404) continue;
    expect(current.ok()).toBe(true);
    expect((await request.delete(`${apiOrigin}/extensions/plugin/${slug}`, { headers })).ok()).toBe(true);
    const purged = await request.delete(`${apiOrigin}/extensions/plugin/${slug}/purge`, { headers, data: { confirmationSlug: slug } });
    expect(purged.ok(), await purged.text()).toBe(true);
    expect((await request.get(`${apiOrigin}/extensions/plugin/${slug}`, { headers })).status()).toBe(404);
  }
  ownedSlugs.clear();
});
test.afterAll(async () => { await db.$disconnect(); });

async function installPayment(page: Page) {
  ownedSlugs.add(provider);
  await login(page, ownerEmail, 'FinalOwnerPassword123!');
  await page.goto('/en/plugins');
  await page.getByRole('button', { name: 'Marketplace', exact: true }).click();
  const entry = page.getByRole('article', { name: providerName, exact: true });
  await entry.getByRole('button', { name: 'Details', exact: true }).click();
  await entry.getByRole('button', { name: 'Install', exact: true }).click();
  await expect(page.getByText('Plugin installed successfully.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Installed plugins', exact: true }).click();
  const installed = page.getByRole('article', { name: providerName, exact: true });
  await expect(installed.getByText('Test-signed', { exact: true })).toBeVisible();
  await expect(installed.getByRole('button', { name: 'Enable', exact: true })).toBeVisible();
  await installed.getByRole('link', { name: 'Manage', exact: true }).click();
  await page.getByLabel('Webhook secret *', { exact: true }).fill(secret);
  const saved = page.waitForResponse(response => response.request().method() === 'PATCH' && response.url().includes('/instances/'));
  await page.getByRole('button', { name: 'Save configuration', exact: true }).click();
  expect((await saved).ok()).toBe(true);
  await expect(page.getByLabel('Webhook secret *', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: 'Enable plugin', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Disable plugin', exact: true })).toBeVisible();
}

async function buyer(page: Page, request: APIRequestContext) {
  const id = randomUUID();
  const email = `extension-${id}@e2e.example`, password = 'ExtensionBuyerPassword123!';
  await page.goto('http://127.0.0.1:3003/en/register');
  await page.getByLabel('Name').fill(`Extension Buyer ${id}`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/account$/);
  const token = (await api<{ token: string }>(request, '/auth/login', { method: 'POST', data: { email, password } })).token;
  return token;
}

async function placeOrder(shop: Page, request: APIRequestContext, token: string, paymentName = providerName, shippingLabel?: string) {
  await shop.goto('http://127.0.0.1:3003/en/products');
  await shop.getByRole('searchbox', { name: 'Search products', exact: true }).fill('E2E Product');
  await shop.getByRole('button', { name: 'Search', exact: true }).click();
  await shop.getByRole('link', { name: /E2E Product/ }).click();
  await shop.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await shop.getByRole('link', { name: 'Checkout', exact: true }).click();
  await shop.getByLabel('First name').fill('Extension');
  await shop.getByLabel('Last name').fill('Buyer');
  await shop.getByLabel('Phone').fill('+1-555-0135');
  await shop.getByLabel('Address line 1').fill('35 Extension Street');
  await shop.getByRole('textbox', { name: 'City', exact: true }).fill('San Francisco');
  await shop.getByLabel('State / province').fill('CA');
  await shop.getByLabel('Postal code').fill('94105');
  await shop.getByRole('combobox', { name: 'Country', exact: true }).selectOption({ label: 'United States' });
  await shop.getByRole('button', { name: 'Get shipping options', exact: true }).click();
  if (shippingLabel) {
    const option = shop.getByRole('radio', { name: new RegExp(shippingLabel) });
    await expect(option).toHaveAccessibleName(new RegExp(`${shippingLabel}.*7[.,]25`));
    await option.check();
  } else await shop.getByRole('radio', { name: /Free shipping/i }).check();
  await shop.getByRole('radio', { name: paymentName, exact: true }).check();
  await shop.getByRole('button', { name: 'Place order', exact: true }).click();
  await expect(shop).toHaveURL(/\/en\/checkout\/complete\?order=/);
  const id = new URL(shop.url()).searchParams.get('order')!;
  ownedOrders.add(id);
  // Customer-owned order detail exposes the session id and shipping snapshot legitimately.
  return api<Order>(request, `/orders/${id}`, { token });
}

async function evidence(orderId: string) {
  const payment = await db.payment.findFirstOrThrow({ where: { orderId }, orderBy: { createdAt: 'desc' } });
  return {
    payment,
    ledger: await db.paymentLedger.findMany({ where: { orderId }, orderBy: { id: 'asc' } }),
    events: await db.eventRecord.findMany({ where: { OR: [{ aggregateId: orderId }, { aggregateId: payment.id }] }, orderBy: { id: 'asc' } }),
    history: await db.orderStatusHistory.findMany({ where: { orderId }, orderBy: { id: 'asc' } }),
  };
}

function callback(order: Order): Callback {
  expect(order.paymentSessionId).toBeTruthy();
  return { eventId: `psp-${randomUUID()}`, sessionId: order.paymentSessionId, status: 'succeeded', amountMinor: Math.round(order.totalAmount * 100), currency: order.currency };
}
function signature(event: Callback) {
  // Independently encode the documented fixture protocol; do not import its implementation.
  return createHmac('sha256', secret).update(JSON.stringify(['e2e-payment-v1', event.eventId, event.sessionId, event.status, event.amountMinor, event.currency]), 'utf8').digest('hex');
}
async function send(request: APIRequestContext, event: Callback, signed = signature(event)) {
  return request.post(`${apiOrigin}/payments/webhook/${provider}`, { headers: { 'x-e2e-signature': signed }, data: event });
}
async function pending(request: APIRequestContext, order: Order, token: string) {
  expect(await api<Order>(request, `/orders/${order.id}`, { token })).toMatchObject({ status: 'PENDING', paymentStatus: 'PENDING' });
  const state = await evidence(order.id);
  expect(state.payment.status).toBe('PENDING');
  expect(state.ledger.filter(row => row.eventType === 'SUCCEEDED')).toHaveLength(0);
  expect(state.events.filter(row => ['order.paid', 'payment.succeeded'].includes(row.type))).toHaveLength(0);
  return state;
}
async function paid(request: APIRequestContext, order: Order, token: string) {
  expect(await api<Order>(request, `/orders/${order.id}`, { token })).toMatchObject({ status: 'PROCESSING', paymentStatus: 'PAID' });
  const state = await evidence(order.id);
  expect(state.payment.status).toBe('SUCCEEDED');
  expect(state.ledger.filter(row => row.eventType === 'SUCCEEDED')).toHaveLength(1);
  expect(state.events.filter(row => row.type === 'order.paid')).toHaveLength(1);
  expect(state.events.filter(row => row.type === 'payment.succeeded')).toHaveLength(1);
  return state;
}

test('A SDK shipping scaffold runs dev, builds, signs, uploads, configures and works at checkout', async ({ page, request, newObservedContext }) => {
  test.setTimeout(180_000);
  const slug = `e2e-sdk-${randomUUID().slice(0, 10)}`;
  ownedSlugs.add(slug); ownedSlugs.add(`${slug}-dev`);
  const project = await shippingProject(slug);
  const context = await newObservedContext({ baseURL: 'http://127.0.0.1:3003' });
  const shop = await context.newPage();
  try {
    await project.devSmoke(adminToken);
    expect(await api(request, `/extensions/plugin/${slug}-dev`, { token: adminToken })).toMatchObject({ version: '1.0.1', signingRoot: 'test' });
    // Dev retains the source display name; finish its isolated smoke before the source UI flow.
    const headers = { authorization: `Bearer ${adminToken}` };
    expect((await request.delete(`${apiOrigin}/extensions/plugin/${slug}-dev`, { headers })).ok()).toBe(true);
    expect((await request.delete(`${apiOrigin}/extensions/plugin/${slug}-dev/purge`, { headers, data: { confirmationSlug: `${slug}-dev` } })).ok()).toBe(true);
    expect((await request.get(`${apiOrigin}/extensions/plugin/${slug}-dev`, { headers })).status()).toBe(404);
    await login(page, ownerEmail, 'FinalOwnerPassword123!');
    await page.goto('/en/plugins');
    await page.getByLabel('Plugin ZIP', { exact: true }).setInputFiles(await project.signedZip());
    await page.getByRole('button', { name: 'Preview package', exact: true }).click();
    await expect(page.getByLabel('Upload a local plugin', { exact: true }).getByRole('heading', { name: project.name, exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Install package', exact: true }).click();
    const entry = page.getByRole('article', { name: project.name, exact: true });
    await expect(entry.getByText('Test-signed', { exact: true })).toBeVisible();
    await expect(entry.getByRole('button', { name: 'Enable', exact: true })).toBeVisible();
    await entry.getByRole('link', { name: 'Manage', exact: true }).click();
    const label = `SDK rate ${slug}`;
    await page.getByLabel('Shipping label', { exact: true }).fill(label);
    await page.getByLabel('Shipping rate (minor units)', { exact: true }).fill('725');
    const saved = page.waitForResponse(response => response.request().method() === 'PATCH' && response.url().includes('/instances/'));
    await page.getByRole('button', { name: 'Save configuration', exact: true }).click();
    expect((await saved).ok()).toBe(true);
    await expect(page.getByLabel('Shipping label', { exact: true })).toHaveValue(label);
    await page.getByRole('button', { name: 'Enable plugin', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Disable plugin', exact: true })).toBeVisible();
    const token = await buyer(shop, request);
    const order = await placeOrder(shop, request, token, 'Manual payment', label);
    expect(order).toMatchObject({ shippingAmount: 7.25, shippingMethod: { providerSlug: slug, label, amountMinor: 725 } });
    await shop.goto(`/en/account/orders/${order.id}`);
    await expect(shop.getByText('$7.25', { exact: true })).toBeVisible();
    expect(await api<Order>(request, `/orders/${order.id}`, { token })).toMatchObject({ shippingAmount: 7.25, shippingMethod: { providerSlug: slug, label, amountMinor: 725 } });
  } finally { await context.close(); await project.cleanup(); }
});

for (const letter of ['B', 'C', 'D', 'E', 'F'] as const) {
  const titles = {
    B: 'B signed marketplace payment callback makes the same order persistently Paid in Admin and Shop',
    C: 'C replayed provider event adds no ledger, event or history rows',
    D: 'D invalid signatures and tampered fields reject without changing pending payment or order',
    E: 'E disabled callback returns 503 and the same callback succeeds after UI re-enable',
    F: 'F a valid callback for another provider session changes neither payment nor order',
  };
  test(titles[letter], async ({ page, request, newObservedContext }) => {
    test.setTimeout(150_000);
    await installPayment(page);
    const context = await newObservedContext({ baseURL: 'http://127.0.0.1:3003' });
    const shop = await context.newPage();
    try {
      const token = await buyer(shop, request);
      const order = await placeOrder(shop, request, token);
      const before = await pending(request, order, token);
      const event = callback(order);
      if (letter === 'D') {
        for (const [name, payload, signed] of [
          ['invalid signature', event, '0'.repeat(64)],
          ['tampered amount', { ...event, amountMinor: event.amountMinor + 1 }, signature(event)],
        ] as const) {
          const rejected = await send(request, payload, signed);
          console.log(`D callback ${name}: HTTP ${rejected.status()}`);
          expect(rejected.ok()).toBe(false);
          expect(await pending(request, order, token)).toEqual(before);
        }
        return;
      }
      if (letter === 'F') {
        const other = await placeOrder(shop, request, token, 'Manual payment');
        const otherBefore = await pending(request, other, token);
        const otherOrderBefore = await api<Order>(request, `/orders/${other.id}`, { token });
        expect((await send(request, callback(other))).ok()).toBe(true);
        expect(await pending(request, order, token)).toEqual(before);
        expect(await pending(request, other, token)).toEqual(otherBefore);
        expect(await api<Order>(request, `/orders/${other.id}`, { token })).toEqual(otherOrderBefore);
        expect(await api<Order>(request, `/orders/${order.id}`, { token })).toEqual(order);
        return;
      }
      if (letter === 'E') {
        await page.getByRole('button', { name: 'Disable plugin', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'Disable payment method?', exact: true });
        await dialog.getByRole('button', { name: 'Disable anyway', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Enable plugin', exact: true })).toBeVisible();
        expect((await send(request, event)).status()).toBe(503);
        expect(await pending(request, order, token)).toEqual(before);
        await page.getByRole('button', { name: 'Enable plugin', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Disable plugin', exact: true })).toBeVisible();
      }
      expect((await send(request, event)).ok()).toBe(true);
      const succeeded = await paid(request, order, token);
      if (letter === 'C') {
        expect((await send(request, event)).ok()).toBe(true);
        expect(await paid(request, order, token)).toEqual(succeeded);
      }
      if (letter === 'B') {
        for (const browser of [page, shop]) {
          await browser.goto(browser === page ? `/en/orders/${order.id}` : `/en/account/orders/${order.id}`);
          await expect(browser.getByText(browser === page ? 'PAID' : 'Paid', { exact: true }).first()).toBeVisible();
          await browser.reload();
          await expect(browser.getByText(browser === page ? 'PAID' : 'Paid', { exact: true }).first()).toBeVisible();
        }
        expect(await paid(request, order, token)).toEqual(succeeded);
      }
    } finally { await context.close(); }
  });
}
