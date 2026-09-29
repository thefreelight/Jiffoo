import { expect, test } from './local-requests';
import type { APIRequestContext, Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { api, login, ownerEmail } from './helpers';

const shop = 'http://127.0.0.1:3003';
const configPath = 'http://127.0.0.1:3001/api/v1/admin/storefront-code';
const empty = {
  ga4MeasurementId: null, metaPixelId: null, baiduSiteKey: null,
  headCode: '', bodyStartCode: '', bodyEndCode: '',
};
type Config = Omit<typeof empty, 'ga4MeasurementId' | 'metaPixelId' | 'baiduSiteKey'> & {
  ga4MeasurementId: string | null; metaPixelId: string | null; baiduSiteKey: string | null;
};
let token: string;
test.describe.configure({ mode: 'serial' });

async function configure(request: APIRequestContext, values: Config = empty) {
  const headers = { authorization: `Bearer ${token}` };
  const current = await request.get(configPath, { headers });
  expect(current.ok()).toBe(true);
  const { data } = await current.json();
  const response = await request.put(configPath, { headers, data: { ...values, expectedRevision: data.revision } });
  expect(response.ok(), await response.text()).toBe(true);
}
async function switchCode(request: APIRequestContext, enabled: boolean) {
  const response = await request.post(`${configPath}/switch`, {
    headers: { authorization: `Bearer ${token}` }, data: { enabled },
  });
  expect(response.ok()).toBe(true);
}
test.beforeAll(async ({ request }) => {
  token = (await api<{ token: string }>(request, '/auth/login', {
    method: 'POST', data: { email: ownerEmail, password: 'FinalOwnerPassword123!' },
  })).token;
  await configure(request);
  await switchCode(request, true);
});
test.beforeEach(async ({ request }) => {
  await configure(request);
  await switchCode(request, true);
});
test.afterEach(async ({ request }) => {
  await configure(request);
  await switchCode(request, true);
});
test.afterAll(async ({ request }) => {
  await configure(request);
  await switchCode(request, true);
});

function providers(): Config {
  const id = randomUUID().replaceAll('-', '');
  return { ...empty, ga4MeasurementId: `G-${id.toUpperCase()}`,
    metaPixelId: String(Number.parseInt(id.slice(0, 12), 16)), baiduSiteKey: id };
}
const merchantHead = `<script>
window.providerMerchant={
  ready:!!(window.gtag&&window.dataLayer.length===2&&window.fbq&&window.fbq.queue.length===2&&window._hmt),
  order:Array.from(document.scripts).filter(script=>script.src.startsWith('data:text/javascript,')).map(script=>{
    const source=decodeURIComponent(script.src.slice(script.src.indexOf(',')+1));
    return ['ga4','meta','baidu'].find(provider=>source.includes("const provider = '"+provider+"'"));
  })
};
</script>`;

function marker(config: Config, merchant = false) {
  return 'Provider commands: ' + JSON.stringify([
    { provider: 'ga4', loads: 1, commands: [['js', '<Date>'], ['config', config.ga4MeasurementId]] },
    { provider: 'meta', loads: 1, commands: [['init', config.metaPixelId], ['track', 'PageView']] },
    { provider: 'baidu', loads: 1, commands: [] },
  ]) + '|merchant:' + JSON.stringify(merchant ? { ready: true, order: ['ga4', 'meta', 'baidu'] } : null);
}
async function checkMarker(page: Page, config: Config, merchant = false) {
  const element = page.getByText(marker(config, merchant), { exact: true });
  await expect(element).toHaveCount(1);
  await expect(element).toBeVisible();
}
async function product(request: APIRequestContext, categoryId?: string) {
  const id = randomUUID();
  const name = `Provider Product ${id}`;
  await api(request, '/admin/products', {
    token, method: 'POST', data: {
      name, categoryId, requiresShipping: true,
      variants: [{ name: 'Standard', salePrice: 12, stock: 3, skuCode: `PROVIDER-${id}` }],
    },
  });
  return name;
}
async function buyerWithCart(page: Page, request: APIRequestContext) {
  const name = await product(request);
  const id = randomUUID();
  await page.goto(`${shop}/en/register`);
  await page.getByLabel('Name').fill(`Provider Buyer ${id}`);
  await page.getByLabel('Email').fill(`provider-${id}@e2e.example`);
  await page.getByLabel('Password', { exact: true }).fill('ProviderBuyerPassword123!');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page).toHaveURL(`${shop}/en/account`);
  await page.goto(`${shop}/en/products`);
  await page.getByRole('searchbox', { name: 'Search products', exact: true }).fill(name);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('heading', { name, exact: true }).click();
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await expect(page).toHaveURL(`${shop}/en/cart`);
  return name;
}
async function placeOrder(page: Page) {
  await page.getByLabel('First name').fill('Provider');
  await page.getByLabel('Last name').fill('Buyer');
  await page.getByLabel('Phone').fill('+1-555-0123');
  await page.getByLabel('Address line 1').fill('25 Provider Street');
  await page.getByRole('textbox', { name: 'City', exact: true }).fill('San Francisco');
  await page.getByLabel('State / province').fill('CA');
  await page.getByLabel('Postal code').fill('94105');
  await page.getByRole('combobox', { name: 'Country', exact: true }).selectOption('US');
  await page.getByRole('button', { name: 'Get shipping options', exact: true }).click();
  await page.getByRole('radio', { name: /Free shipping/i }).check();
  await page.getByRole('radio', { name: 'Manual payment', exact: true }).check();
  await page.getByRole('button', { name: 'Place order', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Order confirmation', exact: true })).toBeVisible();
  const id = new URL(page.url()).searchParams.get('order');
  expect(id).toBeTruthy();
  return id!;
}

test('C initializes GA4 Meta Baidu before merchant head code on storefront and confirmation without external requests', async ({ page, request }) => {
  const config = { ...providers(), headCode: merchantHead };
  await configure(request, config);
  await page.goto(`${shop}/en`);
  await checkMarker(page, config, true);
  await buyerWithCart(page, request);
  await page.getByRole('link', { name: 'Checkout', exact: true }).click();
  await placeOrder(page);
  await checkMarker(page, config, true);
});

test('D soft home category product and locale navigation initializes providers exactly once per document', async ({ page, request }) => {
  const id = randomUUID();
  const categoryName = `Provider Category ${id}`;
  const category = await api<{ id: string }>(request, '/admin/products/categories', {
    token, method: 'POST', data: { name: categoryName, slug: `provider-${id}` },
  });
  const name = await product(request, category.id);
  const config = providers();
  await configure(request, config);
  let commits = 0;
  page.on('request', (req) => {
    if (req.isNavigationRequest() && req.frame() === page.mainFrame()) commits += 1;
  });
  await page.goto(`${shop}/en`);
  await checkMarker(page, config);
  const initialCommits = commits;
  await page.getByRole('navigation', { name: 'Categories', exact: true }).getByRole('link', { name: categoryName, exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: categoryName, exact: true })).toBeVisible();
  await checkMarker(page, config);
  await page.getByRole('heading', { name, exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add to cart', exact: true })).toBeVisible();
  await checkMarker(page, config);
  await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('zh-Hans');
  await expect(page).toHaveURL(/\/zh-Hans\/products\//);
  await expect(page.getByRole('button', { name: '加入购物车', exact: true })).toBeVisible();
  await checkMarker(page, config);
  expect(commits).toBe(initialCommits);
});

test('E direct and storefront arrivals at checkout and cancel have no provider marker or post-commit stub request', async ({ page, request }) => {
  const productName = await buyerWithCart(page, request);
  const config = providers();
  await configure(request, config);
  await page.getByRole('link', { name: 'Checkout', exact: true }).click();
  const id = await placeOrder(page);
  await checkMarker(page, config);
  await page.goto(`${shop}/en/products`);
  await page.getByRole('searchbox', { name: 'Search products', exact: true }).fill(productName);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('heading', { name: productName, exact: true }).click();
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await expect(page).toHaveURL(`${shop}/en/cart`);
  await configure(request, { ...config, bodyEndCode: `<a href="/en/checkout/cancel?order=${id}">Provider cancel destination</a>` });
  const afterPayment: string[] = [];
  const paymentCommits: string[] = [];
  let paymentDocument = false;
  let pendingDocument: string | undefined;
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame() && pendingDocument === frame.url()) {
      pendingDocument = undefined;
      paymentDocument = /^\/en\/checkout(?:\/cancel)?$/.test(new URL(frame.url()).pathname);
      if (paymentDocument) paymentCommits.push(frame.url());
    }
  });
  page.on('request', (req) => {
    if (req.isNavigationRequest() && req.frame() === page.mainFrame()) pendingDocument = req.url();
    if (paymentDocument && req.url().startsWith('data:text/javascript,') &&
      decodeURIComponent(req.url()).includes('recordProviderStub')) afterPayment.push(req.url());
  });
  for (const path of ['/en/checkout', `/en/checkout/cancel?order=${id}`]) {
    const response = await page.goto(`${shop}${path}`);
    expect(response?.ok()).toBe(true);
    expect(await response!.text()).not.toContain('StorefrontCodeLoader');
    await expect(page.getByRole('heading', { name: path.includes('cancel') ? 'Payment pending' : 'Checkout', exact: true })).toBeVisible();
    await expect(page.getByText(/^Provider commands:/)).toHaveCount(0);
  }
  await page.goto(`${shop}/en/cart`);
  await checkMarker(page, config);
  await page.getByRole('link', { name: 'Checkout', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Checkout', exact: true })).toBeVisible();
  await expect(page.getByText(/^Provider commands:/)).toHaveCount(0);
  await page.goto(`${shop}/en`);
  await checkMarker(page, config);
  await page.getByRole('link', { name: 'Provider cancel destination', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Payment pending', exact: true })).toBeVisible();
  await expect(page.getByText(/^Provider commands:/)).toHaveCount(0);
  expect(afterPayment).toEqual([]);
  expect(paymentCommits).toEqual([
    `${shop}/en/checkout`, `${shop}/en/checkout/cancel?order=${id}`,
    `${shop}/en/checkout`, `${shop}/en/checkout/cancel?order=${id}`,
  ]);
});

test('F the master switch removes providers on reload and restores them on the next document', async ({ page, request }) => {
  const config = providers();
  await configure(request, config);
  await page.goto(`${shop}/en`);
  await checkMarker(page, config);
  await switchCode(request, false);
  const response = await page.reload();
  expect(await response!.text()).not.toContain('StorefrontCodeLoader');
  await expect(page.getByRole('heading', { name: 'Browse categories', exact: true })).toBeVisible();
  await expect(page.getByText(/^Provider commands:/)).toHaveCount(0);
  await switchCode(request, true);
  await page.reload();
  await checkMarker(page, config);
});

test('G provider IDs without any merchant slots still initialize all three libraries', async ({ page, request }) => {
  const config = providers();
  await configure(request, config);
  await page.goto(`${shop}/en`);
  await checkMarker(page, config);
});

test('H exact Baidu SPA and commerce hints render in all three Admin languages', async ({ page }) => {
  await login(page, ownerEmail, 'FinalOwnerPassword123!');
  const hints = {
    en: ['Enable Single-page application settings in Baidu Tongji to count client-side page changes.',
      'Enable E-commerce analytics in Baidu Tongji Application Center to view order reports.'],
    'zh-Hans': ['在百度统计中启用单页应用设置，以统计客户端页面切换。', '在百度统计的应用中心启用电商分析，以查看订单报告。'],
    'zh-Hant': ['在百度統計中啟用單頁應用設定，以統計用戶端頁面切換。', '在百度統計的應用中心啟用電商分析，以查看訂單報告。'],
  };
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const [locale, texts] of Object.entries(hints)) {
    await page.goto(`/${locale}/storefront-code`);
    for (const text of texts) await expect(page.getByText(text, { exact: true })).toBeVisible();
    if (locale === 'en') {
      await mkdir('e2e/test-results/provider-review', { recursive: true });
      await page.screenshot({ path: 'e2e/test-results/provider-review/admin-en-1440.png' });
    }
  }
});
