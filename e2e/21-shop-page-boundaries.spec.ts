import { expect, test } from './local-requests';
import type { Page, Request } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { login, ownerEmail } from './helpers';

const shopOrigin = 'http://127.0.0.1:3003';

async function buyerWithCart(page: Page, label: string) {
  const id = randomUUID();
  const productName = `Boundary ${label} ${id.slice(0, 8)}`;
  await login(page, ownerEmail, 'FinalOwnerPassword123!');
  await page.goto('/en/products/create');
  await page.getByPlaceholder('Enter product title...').fill(productName);
  await page.getByPlaceholder('e.g. Red / XL').fill('Standard');
  await page.getByPlaceholder('SKU-REF').fill(`BOUNDARY-${id}`);
  await page.getByPlaceholder('0.00').fill('12.00');
  await page.getByPlaceholder('0', { exact: true }).fill('3');
  await page.getByRole('button', { name: 'Save Product', exact: true }).click();
  await expect(page).toHaveURL('http://127.0.0.1:3002/en/products');
  await page.goto(`${shopOrigin}/en/register`);
  await page.getByLabel('Name').fill(`Boundary ${label} Buyer`);
  await page.getByLabel('Email').fill(`boundary-${label.toLowerCase()}-${id}@e2e.example`);
  await page.getByLabel('Password', { exact: true }).fill('BoundaryPassword123!');
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

async function enterCheckout(page: Page) {
  await page.getByRole('link', { name: 'Checkout', exact: true }).click();
  await expect(page).toHaveURL(`${shopOrigin}/en/checkout`);
  await expect(page.getByRole('heading', { level: 1, name: 'Checkout', exact: true })).toBeVisible();
  await expect(page.getByLabel('First name')).toBeVisible();
}

async function documentRequestsDuring(page: Page, action: () => Promise<unknown>, target: string, heading: string) {
  const documents: string[] = [];
  const observe = (request: Request) => {
    if (request.resourceType() === 'document' && request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      documents.push(request.url());
    }
  };
  page.on('request', observe);
  try {
    await action();
    await expect(page).toHaveURL(target);
    await expect(page.getByRole('heading', { level: heading === 'Browse categories' ? 2 : 1, name: heading, exact: true })).toBeVisible();
    return documents;
  } finally {
    page.off('request', observe);
  }
}

test('C cart to checkout performs a main-frame document navigation', async ({ page }) => {
  await buyerWithCart(page, 'C');
  const target = `${shopOrigin}/en/checkout`;
  const documents = await documentRequestsDuring(page,
    () => page.getByRole('link', { name: 'Checkout', exact: true }).click(), target, 'Checkout');
  expect(documents).toEqual([target]);
  await expect(page.getByLabel('First name')).toBeVisible();
});

test('D checkout to Header home performs a main-frame document navigation', async ({ page }) => {
  await buyerWithCart(page, 'D');
  await enterCheckout(page);
  const target = `${shopOrigin}/en`;
  const documents = await documentRequestsDuring(page,
    () => page.getByRole('banner').getByRole('link', { name: 'E2E Updated Store', exact: true }).click(),
    target, 'Browse categories');
  expect(documents).toEqual([target]);
});

test('E Header home to category stays within the storefront document', async ({ page }) => {
  await page.goto(`${shopOrigin}/en`);
  await expect(page.getByRole('heading', { level: 2, name: 'Browse categories', exact: true })).toBeVisible();
  const documents = await documentRequestsDuring(page,
    () => page.getByRole('banner').getByRole('link', { name: 'E2E Translated Category', exact: true }).click(),
    `${shopOrigin}/en/categories/e2e-translated-category`, 'E2E Translated Category');
  expect(documents).toEqual([]);
});

test('F confirmation to order detail stays within the storefront document', async ({ page }) => {
  await buyerWithCart(page, 'F');
  await enterCheckout(page);
  await page.getByLabel('First name').fill('Boundary');
  await page.getByLabel('Last name').fill('Buyer');
  await page.getByLabel('Phone').fill('+1-555-0121');
  await page.getByLabel('Address line 1').fill('21 Boundary Street');
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
  const documents = await documentRequestsDuring(page,
    () => page.getByRole('link', { name: 'View order', exact: true }).click(),
    `${shopOrigin}/en/account/orders/${id}`, 'Order details');
  expect(documents).toEqual([]);
});

const notFoundCases = [
  { title: 'G preserves missing storefront path status and heading', path: '/en/scenario-14-missing-page', status: 404, heading: '404' },
  { title: 'G preserves missing product slug status and heading', path: '/en/products/scenario-14-missing-product', status: 404, heading: 'Page not found' },
  { title: 'G preserves missing top-level path status and heading', path: '/scenario-14-missing-top-level', status: 404, heading: '404' },
  { title: 'G preserves payment cancel notFound status and heading', path: '/en/checkout/cancel', status: 404, heading: 'Page not found' },
] as const;

for (const entry of notFoundCases) {
  test(entry.title, async ({ page }, testInfo) => {
    const response = await page.goto(`${shopOrigin}${entry.path}`);
    expect(response).not.toBeNull();
    const heading = page.getByRole('heading', { level: 1 }).first();
    await expect(heading).toBeVisible();
    const observation = { path: entry.path, status: response!.status(), heading: await heading.innerText() };
    testInfo.annotations.push({ type: 'not-found-baseline', description: JSON.stringify(observation) });
    console.log('Not-found baseline:', JSON.stringify(observation));
    expect(observation).toEqual({ path: entry.path, status: entry.status, heading: entry.heading });
  });
}
