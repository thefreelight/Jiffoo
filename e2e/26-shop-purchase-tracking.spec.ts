import { expect, test } from './local-requests';
import type { APIRequestContext, Page, Response } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { api, ownerEmail, shopLogin } from './helpers';

const shop = 'http://127.0.0.1:3003';
const configPath = 'http://127.0.0.1:3001/api/v1/admin/storefront-code';
const empty = {
  ga4MeasurementId: null, metaPixelId: null, baiduSiteKey: null,
  headCode: '', bodyStartCode: '', bodyEndCode: '',
};
type Config = {
  ga4MeasurementId: string | null; metaPixelId: string | null; baiduSiteKey: string | null;
  headCode: string; bodyStartCode: string; bodyEndCode: string;
};
type Order = {
  id: string; totalAmount: number; currency: string; shippingAmount: number; taxAmount: number;
  items: Array<{ productId: string; productName: string; variantId: string; unitPrice: number; quantity: number }>;
};
let token: string;
test.describe.configure({ mode: 'serial' });

async function configure(request: APIRequestContext, values: Config = empty) {
  const headers = { authorization: `Bearer ${token}` };
  const current = await request.get(configPath, { headers });
  expect(current.ok()).toBe(true);
  const { data } = await current.json();
  const saved = await request.put(configPath, { headers, data: { ...values, expectedRevision: data.revision } });
  expect(saved.ok(), await saved.text()).toBe(true);
  const enabled = await request.post(`${configPath}/switch`, { headers, data: { enabled: true } });
  expect(enabled.ok()).toBe(true);
}
test.beforeAll(async ({ request }) => {
  token = (await api<{ token: string }>(request, '/auth/login', {
    method: 'POST', data: { email: ownerEmail, password: 'FinalOwnerPassword123!' },
  })).token;
  await configure(request);
});
test.beforeEach(async ({ request }) => { await configure(request); });
test.afterEach(async ({ request }) => { await configure(request); });
test.afterAll(async ({ request }) => { await configure(request); });

function providers(): Config {
  const id = randomUUID().replaceAll('-', '');
  return { ...empty, ga4MeasurementId: `G-${id.toUpperCase()}`,
    metaPixelId: String(Number.parseInt(id.slice(0, 12), 16)), baiduSiteKey: id };
}
function marker(config: Config, order?: Order) {
  const ga4: unknown[][] = [['js', '<Date>'], ['config', config.ga4MeasurementId]];
  const meta: unknown[][] = [['init', config.metaPixelId], ['track', 'PageView']];
  const baidu: unknown[][] = [];
  if (order) {
    ga4.push(['event', 'purchase', {
      transaction_id: order.id, value: Number(order.totalAmount), currency: order.currency,
      shipping: Number(order.shippingAmount), tax: Number(order.taxAmount),
      items: order.items.map((item) => ({
        item_id: item.productId, item_name: item.productName,
        ...(item.variantId ? { item_variant: item.variantId } : {}),
        price: Number(item.unitPrice), quantity: item.quantity,
      })),
    }]);
    meta.push(['track', 'Purchase', {
      value: Number(order.totalAmount), currency: order.currency, content_type: 'product',
      content_ids: order.items.map((item) => item.productId),
      contents: order.items.map((item) => ({ id: item.productId, quantity: item.quantity })),
      num_items: order.items.reduce((sum, item) => sum + item.quantity, 0),
    }, { eventID: `purchase-${order.id}` }]);
    baidu.push(['_trackOrder', { orderId: order.id, orderTotal: Number(order.totalAmount),
      item: order.items.map((item) => ({
        skuId: item.variantId || item.productId, skuName: item.productName,
        Price: Number(item.unitPrice), Quantity: item.quantity,
      })),
    }]);
  }
  return 'Provider commands: ' + JSON.stringify([
    { provider: 'ga4', loads: 1, commands: ga4 },
    { provider: 'meta', loads: 1, commands: meta },
    { provider: 'baidu', loads: 1, commands: baidu },
  ]) + '|merchant:null';
}
async function checkMarker(page: Page, config: Config, order?: Order) {
  await expect(page.getByText(marker(config, order), { exact: true })).toBeVisible();
  await expect(page.getByText(/^Provider commands:/)).toHaveCount(1);
}
function observeClaims(page: Page) {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.endsWith('/tracking-claim')) requests.push(request.url());
  });
  return requests;
}
function nextClaim(page: Page) {
  return page.waitForResponse((response) => new URL(response.url()).pathname.endsWith('/tracking-claim') &&
    response.request().method() === 'POST');
}
async function checkClaim(response: Response, claimed: boolean) {
  expect(response.status()).toBe(200);
  expect((await response.json()).data).toEqual({ claimed });
}
async function buyerWithCart(page: Page, request: APIRequestContext) {
  const key = randomUUID();
  const name = `Purchase Product ${key}`;
  await api(request, '/admin/products', { token, method: 'POST', data: {
    name, requiresShipping: true,
    variants: [{ name: 'Standard', salePrice: 12.25, stock: 5, skuCode: `PURCHASE-${key}` }],
  } });
  const email = `purchase-${key}@e2e.example`;
  await api(request, '/admin/users', { token, method: 'POST', data: {
    username: `Purchase Buyer ${key}`, email, password: 'PurchaseBuyerPassword123!',
  } });
  await page.goto(`${shop}/en/login`);
  await shopLogin(page, { locale: 'en', email, password: 'PurchaseBuyerPassword123!', expectedPath: '/en' });
  await addToCart(page, name);
  return name;
}
async function addToCart(page: Page, name: string) {
  await page.goto(`${shop}/en/products`);
  await page.getByRole('searchbox', { name: 'Search products', exact: true }).fill(name);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('heading', { name, exact: true }).click();
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await expect(page).toHaveURL(`${shop}/en/cart`);
}
const address = {
  firstName: 'Purchase', lastName: 'Buyer', phone: '+1-555-0126', addressLine1: '26 Purchase Street',
  city: 'San Francisco', state: 'CA', postalCode: '94105', country: 'US',
};
async function placeOrder(page: Page) {
  await page.getByRole('link', { name: 'Checkout', exact: true }).click();
  await page.getByLabel('First name').fill(address.firstName);
  await page.getByLabel('Last name').fill(address.lastName);
  await page.getByLabel('Phone').fill(address.phone);
  await page.getByLabel('Address line 1').fill(address.addressLine1);
  await page.getByRole('textbox', { name: 'City', exact: true }).fill(address.city);
  await page.getByLabel('State / province').fill(address.state);
  await page.getByLabel('Postal code').fill(address.postalCode);
  await page.getByRole('combobox', { name: 'Country', exact: true }).selectOption('US');
  await page.getByRole('button', { name: 'Get shipping options', exact: true }).click();
  await page.getByRole('radio', { name: /Free shipping/i }).check();
  await page.getByRole('radio', { name: 'Manual payment', exact: true }).check();
  const claim = nextClaim(page);
  await page.getByRole('button', { name: 'Place order', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Order confirmation', exact: true })).toBeVisible();
  await checkClaim(await claim, true);
  const id = new URL(page.url()).searchParams.get('order');
  expect(id).toBeTruthy();
  const response = await page.request.get(`${shop}/bff/orders/${id}`);
  expect(response.ok()).toBe(true);
  return (await response.json()).data as Order;
}

test('G first confirmation sends exactly one exact purchase command per configured provider', async ({ page, request }) => {
  const config = providers();
  await configure(request, config);
  const claims = observeClaims(page);
  await buyerWithCart(page, request);
  const order = await placeOrder(page);
  expect(order.totalAmount).toBe(12.25);
  await checkMarker(page, config, order);
  expect(claims).toEqual([`${shop}/bff/orders/${order.id}/tracking-claim`]);
});

test('H reload and return for the same order never send additional purchase commands', async ({ page, request }) => {
  const config = providers();
  await configure(request, config);
  const claims = observeClaims(page);
  await buyerWithCart(page, request);
  const order = await placeOrder(page);
  await checkMarker(page, config, order);
  const reloadClaim = nextClaim(page);
  await page.reload();
  await checkClaim(await reloadClaim, false);
  await checkMarker(page, config);
  const returnClaim = nextClaim(page);
  await page.goto(`${shop}/en/checkout/return?order=${order.id}`);
  await expect(page.getByRole('heading', { name: 'Order confirmation', exact: true })).toBeVisible();
  await checkClaim(await returnClaim, false);
  await checkMarker(page, config);
  expect(claims).toEqual(Array(3).fill(`${shop}/bff/orders/${order.id}/tracking-claim`));
});

test('I a provider-free first confirmation consumes the claim and prevents a late purchase', async ({ page, request }) => {
  const claims = observeClaims(page);
  await buyerWithCart(page, request);
  const order = await placeOrder(page);
  await expect(page.getByText(/^Provider commands:/)).toHaveCount(0);
  const config = providers();
  await configure(request, config);
  const claim = nextClaim(page);
  await page.reload();
  await checkClaim(await claim, false);
  await checkMarker(page, config);
  expect(claims).toEqual(Array(2).fill(`${shop}/bff/orders/${order.id}/tracking-claim`));
});

test('J an order cancelled from the account page cannot claim or send a purchase', async ({ page, request }) => {
  const config = providers();
  await configure(request, config);
  await buyerWithCart(page, request);
  // Create through the real cookie-authenticated BFF without running a confirmation document.
  const cart = await page.request.get(`${shop}/bff/cart`);
  expect(cart.ok()).toBe(true);
  const items = (await cart.json()).data.items.map((item: { productId: string; variantId: string; quantity: number }) => ({
    productId: item.productId, variantId: item.variantId, quantity: item.quantity,
  }));
  const headers = { origin: shop };
  const quote = await page.request.post(`${shop}/bff/checkout/quote`, {
    headers, data: { shippingAddress: address, shippingOptionId: 'free-shipping:free' },
  });
  expect(quote.ok()).toBe(true);
  const created = await page.request.post(`${shop}/bff/orders`, { headers, data: {
    items, shippingAddress: address, shippingOptionId: 'free-shipping:free', paymentMethod: 'manual-payment',
    expectedTotal: (await quote.json()).data.total,
  } });
  expect(created.status()).toBe(201);
  const order = (await created.json()).data as Order;
  const claims = observeClaims(page);
  await page.goto(`${shop}/en/account/orders`);
  await page.getByRole('link', { name: 'View details', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel order', exact: true }).click();
  await page.getByRole('combobox', { name: 'Reason', exact: true }).selectOption('other');
  await page.getByRole('textbox', { name: 'Other reason', exact: true }).fill('Cancel before first confirmation');
  await page.getByRole('button', { name: 'Confirm cancellation', exact: true }).click();
  await expect(page.getByText('Cancelled', { exact: true })).toBeVisible();
  const claim = nextClaim(page);
  await page.goto(`${shop}/en/checkout/complete?order=${order.id}`);
  const response = await claim;
  expect(response.status()).toBe(409);
  expect((await response.json()).error.code).toBe('PURCHASE_TRACKING_UNAVAILABLE');
  await checkMarker(page, config);
  expect(claims).toEqual([`${shop}/bff/orders/${order.id}/tracking-claim`]);
});

test('K checkout and cancel payment documents make no post-commit provider stub requests', async ({ page, request }) => {
  const config = providers();
  await configure(request, config);
  const name = await buyerWithCart(page, request);
  const order = await placeOrder(page);
  await checkMarker(page, config, order);
  await addToCart(page, name);
  let paymentDocument = false;
  let pending: string | undefined;
  const commits: string[] = [];
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) pending = request.url();
    if (paymentDocument && request.url().startsWith('data:text/javascript,') &&
      decodeURIComponent(request.url()).includes('recordProviderStub')) requests.push(request.url());
  });
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame() && pending === frame.url()) {
      pending = undefined;
      paymentDocument = /^\/en\/checkout(?:\/cancel)?$/.test(new URL(frame.url()).pathname);
      if (paymentDocument) commits.push(frame.url());
    }
  });
  await page.getByRole('link', { name: 'Checkout', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Checkout', exact: true })).toBeVisible();
  await expect(page.getByText(/^Provider commands:/)).toHaveCount(0);
  await page.goto(`${shop}/en/checkout/cancel?order=${order.id}`);
  await expect(page.getByRole('heading', { name: 'Payment pending', exact: true })).toBeVisible();
  await expect(page.getByText(/^Provider commands:/)).toHaveCount(0);
  expect(commits).toEqual([`${shop}/en/checkout`, `${shop}/en/checkout/cancel?order=${order.id}`]);
  expect(requests).toEqual([]);
});
