import { captureReview, expect, test } from './review-capture';
import { randomUUID } from 'node:crypto';
import archiver from 'archiver';
import type { APIRequestContext, BrowserContext, Page } from '@playwright/test';
import { login, ownerEmail } from './helpers';

const api = 'http://127.0.0.1:3001/api/v1';

async function fixtureZip(slug: string): Promise<Buffer> {
  const manifest = {
    schemaVersion: 1, slug, name: 'Fixture payment', version: '1.0.0',
    description: 'Local payment isolation fixture', category: 'payment',
    runtimeType: 'internal-fastify', hostProtocol: 'internal-fastify-v1',
    entryModule: 'server/index.js', permissions: [],
    contracts: [{ name: 'payment', version: 1 }],
  };
  const source = `module.exports = { register(ctx) {
    ctx.contracts.implement('payment', 1, {
      describe: (input) => ({ displayName: 'Fixture payment', requiresManualConfirmation: false, unpaidTimeoutMinutes: 30, supportedCurrencies: [input.storeCurrency] }),
      createSession: (input) => ({ sessionId: 'fixture_' + input.orderId, action: { type: 'instructions', text: 'Fixture payment pending.' } }),
      getSessionStatus: () => ({ status: 'pending' }),
      handleWebhook: () => ({ events: [] }),
    });
  } };`;
  const archive = archiver('zip', { zlib: { level: 9 } });
  const chunks: Buffer[] = [];
  archive.on('data', (chunk: Buffer) => chunks.push(chunk));
  const finished = new Promise<void>((done, fail) => { archive.on('end', done); archive.on('error', fail); });
  archive.append(JSON.stringify(manifest), { name: 'manifest.json' });
  archive.append(source, { name: 'server/index.js' });
  await archive.finalize();
  await finished;
  return Buffer.concat(chunks);
}

type Fixture = {
  slug: string;
  authorization: string;
  page: Page;
  shop: Page;
  context: BrowserContext;
  request: APIRequestContext;
  installed: boolean;
  orderId: string | null;
};

async function removeFixture(fixture: Fixture) {
  if (!fixture.installed) return;
  const endpoint = `${api}/extensions/plugin/${fixture.slug}`;
  const headers = { authorization: fixture.authorization };
  const uninstalled = await fixture.request.delete(endpoint, { headers });
  expect(uninstalled.status(), await uninstalled.text()).toBe(200);
  const purged = await fixture.request.delete(`${endpoint}/purge`, { headers, data: { confirmationSlug: fixture.slug } });
  expect(purged.status(), await purged.text()).toBe(200);
  fixture.installed = false;
}

async function setupFixture(
  page: Page,
  request: APIRequestContext,
  newObservedContext: (options: { baseURL: string; viewport: { width: number; height: number } }) => Promise<BrowserContext>,
): Promise<Fixture> {
  const slug = `isolation-${randomUUID().replaceAll('-', '').slice(0, 16)}`;
  await page.setViewportSize({ width: 1440, height: 900 });
  const bearer = new Promise<string>((resolveToken) => {
    page.on('request', (observed) => {
      const header = observed.headers().authorization;
      if (header?.startsWith('Bearer ')) resolveToken(header);
    });
  });
  await login(page, ownerEmail, 'FinalOwnerPassword123!');
  await page.goto('/en/plugins');
  const authorization = await bearer;
  const context = await newObservedContext({ baseURL: 'http://127.0.0.1:3003', viewport: { width: 1440, height: 900 } });
  const fixture: Fixture = { slug, authorization, page, shop: await context.newPage(), context, request, installed: false, orderId: null };
  try {
    await removeFixture(fixture);
    const packageBytes = await fixtureZip(slug);
    const preview = await request.post(`${api}/extensions/plugin/preview`, { headers: { authorization }, multipart: { file: { name: 'plugin.zip', mimeType: 'application/zip', buffer: packageBytes } } });
    expect(preview.ok()).toBe(true);
    const previewToken = (await preview.json()).data.previewToken;
    const uploaded = await request.post(`${api}/extensions/plugin/install`, {
      headers: { authorization },
      multipart: {
        confirmUnsigned: 'true',
        previewToken, confirmationSlug: slug,
        file: { name: `${slug}.zip`, mimeType: 'application/zip', buffer: packageBytes },
      },
    });
    expect(uploaded.status(), await uploaded.text()).toBe(200);
    fixture.installed = true;
    await page.goto(`/en/plugins/${slug}`);
    await page.getByRole('button', { name: 'Enable plugin' }).click();
    await expect(page.getByRole('button', { name: 'Disable plugin' })).toBeVisible();
    return fixture;
  } catch (error) {
    await removeFixture(fixture);
    await context.close();
    throw error;
  }
}

async function openCheckout(shop: Page) {
  await shop.goto('/en/products');
  await shop.getByRole('searchbox', { name: 'Search products' }).fill('E2E Product');
  await shop.getByRole('button', { name: 'Search', exact: true }).click();
  await shop.getByRole('link', { name: /E2E Product/ }).click();
  await shop.getByRole('button', { name: 'Add to cart' }).click();
  await shop.getByRole('link', { name: 'Checkout', exact: true }).click();
  await shop.getByLabel('First name').fill('Isolation');
  await shop.getByLabel('Last name').fill('Buyer');
  await shop.getByLabel('Phone').fill('+1-555-0128');
  await shop.getByLabel('Address line 1').fill('28 Test Street');
  await shop.getByRole('textbox', { name: 'City', exact: true }).fill('San Francisco');
  await shop.getByLabel('State / province').fill('CA');
  await shop.getByLabel('Postal code').fill('94105');
  await shop.getByRole('combobox', { name: 'Country', exact: true }).selectOption({ label: 'United States' });
  await shop.getByRole('button', { name: 'Get shipping options' }).click();
  await shop.getByRole('radio', { name: /Free shipping/i }).check();
  await shop.getByRole('radio', { name: 'Fixture payment' }).check();
}

async function register(fixture: Fixture) {
  const { shop, slug } = fixture;
  await shop.goto('/en/register');
  await shop.getByLabel('Name').fill(`Isolation Buyer ${slug}`);
  await shop.getByLabel('Email').fill(`${slug}@e2e.example`);
  await shop.getByLabel('Password', { exact: true }).fill('IsolationBuyerPassword123!');
  await shop.getByRole('button', { name: 'Create account' }).click();
  await expect(shop).toHaveURL(/\/en\/account$/);
  await openCheckout(shop);
}

async function cleanup(fixture: Fixture) {
  try {
    if (fixture.orderId) {
      await fixture.shop.goto(`/en/account/orders/${fixture.orderId}`);
      if (await fixture.shop.getByRole('button', { name: 'Cancel order' }).count()) {
        await fixture.shop.getByRole('button', { name: 'Cancel order' }).click();
        await fixture.shop.getByRole('combobox', { name: 'Reason' }).selectOption('other');
        await fixture.shop.getByRole('textbox', { name: 'Other reason' }).fill('Fixture cleanup');
        await fixture.shop.getByRole('button', { name: 'Confirm cancellation' }).click();
      }
    }
    await removeFixture(fixture);
  } finally {
    await fixture.context.close();
  }
}

test('B warns for a pending payment, Cancel preserves enablement and Disable anyway removes the method from new checkout', async ({ page, request, newObservedContext }) => {
  test.setTimeout(120_000);
  const fixture = await setupFixture(page, request, newObservedContext);
  try {
    await register(fixture);
    await fixture.shop.getByRole('button', { name: 'Place order' }).click();
    await expect(fixture.shop).toHaveURL(/\/en\/checkout\/complete\?order=/);
    fixture.orderId = new URL(fixture.shop.url()).searchParams.get('order');
    expect(fixture.orderId).toBeTruthy();
    await page.getByRole('button', { name: 'Disable plugin' }).click();
    const dialog = page.getByRole('dialog', { name: 'Disable payment method?' });
    await expect(dialog).toContainText('1 orders awaiting payment use this payment method.');
    await captureReview(page, 'disabled-plugin-review', 'disabled-plugin-dialog');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('button', { name: 'Disable plugin' })).toBeVisible();
    await page.getByRole('button', { name: 'Disable plugin' }).click();
    await dialog.getByRole('button', { name: 'Disable anyway' }).click();
    await expect(page.getByRole('button', { name: 'Enable plugin' })).toBeVisible();
    await fixture.shop.goto('/en/products');
    await fixture.shop.getByRole('searchbox', { name: 'Search products' }).fill('E2E Product');
    await fixture.shop.getByRole('button', { name: 'Search', exact: true }).click();
    await fixture.shop.getByRole('link', { name: /E2E Product/ }).click();
    await fixture.shop.getByRole('button', { name: 'Add to cart' }).click();
    await fixture.shop.getByRole('link', { name: 'Checkout', exact: true }).click();
    await fixture.shop.getByLabel('First name').fill('Isolation');
    await fixture.shop.getByLabel('Last name').fill('Buyer');
    await fixture.shop.getByLabel('Phone').fill('+1-555-0128');
    await fixture.shop.getByLabel('Address line 1').fill('28 Test Street');
    await fixture.shop.getByRole('textbox', { name: 'City', exact: true }).fill('San Francisco');
    await fixture.shop.getByRole('combobox', { name: 'Country', exact: true }).selectOption({ label: 'United States' });
    await fixture.shop.getByRole('button', { name: 'Get shipping options' }).click();
    await fixture.shop.getByRole('radio', { name: /Free shipping/i }).check();
    await expect(fixture.shop.getByRole('radio', { name: 'Fixture payment' })).toHaveCount(0);
  } finally {
    await cleanup(fixture);
  }
});

test('C stale checkout shows the unavailable payment message, refreshes methods and creates no order', async ({ page, request, newObservedContext }) => {
  test.setTimeout(120_000);
  const fixture = await setupFixture(page, request, newObservedContext);
  try {
    await register(fixture);
    await page.getByRole('button', { name: 'Disable plugin' }).click();
    await expect(page.getByRole('dialog', { name: 'Disable payment method?' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Enable plugin' })).toBeVisible();
    await fixture.shop.getByRole('button', { name: 'Place order' }).click();
    await expect(fixture.shop.getByText('This payment method is no longer available. Please choose another.', { exact: true })).toBeVisible();
    await expect(fixture.shop.getByRole('radio', { name: 'Fixture payment' })).toHaveCount(0);
    await captureReview(fixture.shop, 'disabled-plugin-review', 'disabled-plugin-checkout-message');
    await fixture.shop.goto('/en/account/orders');
    await expect(fixture.shop.getByRole('link', { name: 'View details' })).toHaveCount(0);
  } finally {
    await cleanup(fixture);
  }
});

test('D disabling a payment plugin with zero pending orders shows no dialog', async ({ page, request, newObservedContext }) => {
  test.setTimeout(120_000);
  const fixture = await setupFixture(page, request, newObservedContext);
  try {
    await page.getByRole('button', { name: 'Disable plugin' }).click();
    await expect(page.getByRole('dialog', { name: 'Disable payment method?' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Enable plugin' })).toBeVisible();
  } finally {
    await cleanup(fixture);
  }
});
