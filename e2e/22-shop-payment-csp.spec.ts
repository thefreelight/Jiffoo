import { expect, test } from './local-requests';
import type { ConsoleMessage, Page, Response } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { login, ownerEmail } from './helpers';

const shopOrigin = 'http://127.0.0.1:3003';
const privateCacheControl = 'private, no-cache, no-store, max-age=0, must-revalidate';

async function buyerWithCart(page: Page, label: string) {
  const id = randomUUID();
  const productName = `Payment CSP ${label} ${id.slice(0, 8)}`;
  await login(page, ownerEmail, 'FinalOwnerPassword123!');
  await page.goto('/en/products/create');
  await page.getByPlaceholder('Enter product title...').fill(productName);
  await page.getByPlaceholder('e.g. Red / XL').fill('Standard');
  await page.getByPlaceholder('SKU-REF').fill(`PAYMENT-CSP-${id}`);
  await page.getByPlaceholder('0.00').fill('12.00');
  await page.getByPlaceholder('0', { exact: true }).fill('3');
  await page.getByRole('button', { name: 'Save Product', exact: true }).click();
  await expect(page).toHaveURL('http://127.0.0.1:3002/en/products');
  await page.goto(`${shopOrigin}/en/register`);
  await page.getByLabel('Name').fill(`Payment CSP ${label} Buyer`);
  await page.getByLabel('Email').fill(`payment-csp-${label.toLowerCase()}-${id}@e2e.example`);
  await page.getByLabel('Password', { exact: true }).fill('PaymentCspPassword123!');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page).toHaveURL(`${shopOrigin}/en/account`);
  await page.goto(`${shopOrigin}/en/products`);
  await page.getByRole('searchbox', { name: 'Search products', exact: true }).fill(productName);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('link', { name: new RegExp(productName) }).click();
  await expect(page.getByRole('heading', { level: 1, name: productName, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await expect(page).toHaveURL(`${shopOrigin}/en/cart`);
  await expect(page.getByRole('link', { name: productName, exact: true })).toBeVisible();
}

function observeErrors(page: Page) {
  const consoleMessages: Array<{ type: string; text: string }> = [];
  const pageErrors: string[] = [];
  const onConsole = (message: ConsoleMessage) => {
    if (['error', 'warning'].includes(message.type())) {
      consoleMessages.push({ type: message.type(), text: message.text() });
    }
  };
  const onPageError = (error: Error) => pageErrors.push(error.message);
  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  return {
    consoleMessages, pageErrors,
    stop() {
      page.off('console', onConsole);
      page.off('pageerror', onPageError);
    },
  };
}

function documentHeaders(response: Response | null) {
  expect(response).not.toBeNull();
  const headers = response!.headers();
  return { csp: headers['content-security-policy'] ?? null, cacheControl: headers['cache-control'] ?? null };
}

function assertPaymentHeaders(headers: ReturnType<typeof documentHeaders>) {
  expect(headers.cacheControl).toBe(privateCacheControl);
  expect(headers.csp).toMatch(/^script-src 'self' 'nonce-[A-Za-z0-9+/]{22}==' 'strict-dynamic'; object-src 'none'; base-uri 'none'$/);
  const nonce = headers.csp!.match(/'nonce-([^']+)'/)![1];
  expect(Buffer.from(nonce, 'base64')).toHaveLength(16);
  return nonce;
}

function assertConsoleBaseline(observation: ReturnType<typeof observeErrors>) {
  expect(observation.consoleMessages.filter((message) => /content security policy/i.test(message.text))).toEqual([]);
  expect(observation.consoleMessages).toEqual([]);
  expect(observation.pageErrors).toEqual([]);
}

async function placeOrder(page: Page) {
  await expect(page.getByLabel('First name')).toBeVisible();
  await page.getByLabel('First name').fill('Payment');
  await page.getByLabel('Last name').fill('CSP Buyer');
  await page.getByLabel('Phone').fill('+1-555-0122');
  await page.getByLabel('Address line 1').fill('22 Payment Street');
  await page.getByRole('textbox', { name: 'City', exact: true }).fill('San Francisco');
  await page.getByLabel('State / province').fill('CA');
  await page.getByLabel('Postal code').fill('94105');
  await page.getByRole('combobox', { name: 'Country', exact: true }).selectOption({ label: 'United States' });
  await page.getByRole('button', { name: 'Get shipping options', exact: true }).click();
  await page.getByRole('radio', { name: /Free shipping/i }).check();
  await page.getByRole('radio', { name: 'Manual payment', exact: true }).check();
  await page.getByRole('button', { name: 'Place order', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/checkout\/complete\?order=/);
  await expect(page.getByRole('heading', { level: 1, name: 'Order confirmation', exact: true })).toBeVisible();
  const id = new URL(page.url()).searchParams.get('order');
  expect(id).toBeTruthy();
  return id!;
}

test('C checkout uses fresh strict script CSP without changing console output or order placement', async ({ page }, testInfo) => {
  await buyerWithCart(page, 'C');
  const observation = observeErrors(page);
  try {
    const first = documentHeaders(await page.goto(`${shopOrigin}/en/checkout`));
    await expect(page.getByLabel('First name')).toBeVisible();
    await page.getByLabel('First name').fill('First load');
    await expect(page.getByLabel('First name')).toHaveValue('First load');
    const firstNonce = assertPaymentHeaders(first);
    assertConsoleBaseline(observation);
    const firstPageErrors = [...observation.pageErrors];
    observation.pageErrors.length = 0;
    const second = documentHeaders(await page.reload());
    await expect(page.getByLabel('First name')).toBeVisible();
    await placeOrder(page);
    expect(assertPaymentHeaders(second)).not.toBe(firstNonce);
    assertConsoleBaseline(observation);
    const result = { first, second, consoleMessages: observation.consoleMessages, pageErrorsPerLoad: [firstPageErrors, observation.pageErrors] };
    testInfo.annotations.push({ type: 'payment-csp-observation', description: JSON.stringify(result) });
    console.log('Payment CSP checkout:', JSON.stringify(result));
  } finally {
    observation.stop();
  }
});

test('D own-order cancel uses fresh strict script CSP without changing console output', async ({ page }, testInfo) => {
  await buyerWithCart(page, 'D');
  await page.goto(`${shopOrigin}/en/checkout`);
  const id = await placeOrder(page);
  const observation = observeErrors(page);
  try {
    const first = documentHeaders(await page.goto(`${shopOrigin}/en/checkout/cancel?order=${id}`));
    await expect(page.getByRole('heading', { level: 1, name: 'Payment pending', exact: true })).toBeVisible();
    const firstNonce = assertPaymentHeaders(first);
    assertConsoleBaseline(observation);
    const second = documentHeaders(await page.reload());
    await expect(page.getByRole('heading', { level: 1, name: 'Payment pending', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'View order', exact: true })).toBeVisible();
    expect(assertPaymentHeaders(second)).not.toBe(firstNonce);
    assertConsoleBaseline(observation);
    const result = { first, second, consoleMessages: observation.consoleMessages, pageErrors: observation.pageErrors };
    testInfo.annotations.push({ type: 'payment-csp-observation', description: JSON.stringify(result) });
    console.log('Payment CSP cancel:', JSON.stringify(result));
  } finally {
    observation.stop();
  }
});

test('B checkout country options hydrate without errors in every supported locale', async ({ page }) => {
  const id = randomUUID();
  await page.goto(`${shopOrigin}/en/register`);
  await page.getByLabel('Name').fill('Country Options Buyer');
  await page.getByLabel('Email').fill(`country-options-${id}@e2e.example`);
  await page.getByLabel('Password', { exact: true }).fill('CountryOptionsPassword123!');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page).toHaveURL(`${shopOrigin}/en/account`);
  await page.goto(`${shopOrigin}/en/products`);
  await page.getByRole('searchbox', { name: 'Search products', exact: true }).fill('E2E Localized Product');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('heading', { name: 'E2E Localized Product', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'E2E Localized Product', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await expect(page).toHaveURL(`${shopOrigin}/en/cart`);
  for (const [locale, label] of [['en', 'Country'], ['zh-Hans', '国家或地区'], ['zh-Hant', '國家或地區']] as const) {
    const observation = observeErrors(page);
    try {
      await page.goto(`${shopOrigin}/${locale}/checkout`);
      const combo = page.getByRole('combobox', { name: label, exact: true });
      await expect(combo).toBeVisible();
      await expect(combo.getByRole('option')).toHaveCount(250);
      await combo.selectOption('US');
      await expect(combo).toHaveValue('US');
      assertConsoleBaseline(observation);
    } finally {
      observation.stop();
    }
  }
});

test('E storefront and confirmation documents have no Content-Security-Policy header', async ({ page }) => {
  await buyerWithCart(page, 'E');
  for (const entry of [
    { path: '/en', heading: 'Browse categories', level: 2 },
    { path: '/en/categories/e2e-translated-category', heading: 'E2E Translated Category', level: 1 },
    { path: '/en/cart', heading: 'Cart', level: 1 },
  ]) {
    const headers = documentHeaders(await page.goto(`${shopOrigin}${entry.path}`));
    await expect(page.getByRole('heading', { name: entry.heading, level: entry.level, exact: true })).toBeVisible();
    expect(headers.csp, entry.path).toBeNull();
  }
  await page.goto(`${shopOrigin}/en/checkout`);
  const id = await placeOrder(page);
  const headers = documentHeaders(await page.goto(`${shopOrigin}/en/checkout/complete?order=${id}`));
  await expect(page.getByRole('heading', { level: 1, name: 'Order confirmation', exact: true })).toBeVisible();
  expect(headers.csp).toBeNull();
});
