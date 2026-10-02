import { captureReview, expect, test } from './review-capture';
import type { APIRequestContext, Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { api, login, ownerEmail } from './helpers';

const origin = 'http://127.0.0.1:3003';
const path = 'http://127.0.0.1:3001/api/v1/admin/storefront-code';
const empty = { ga4MeasurementId: null, metaPixelId: null, baiduSiteKey: null, headCode: '', bodyStartCode: '', bodyEndCode: '' };
const labels = ['GA4 measurement ID', 'Meta Pixel ID', 'Baidu Tongji site key', 'Head code', 'Body start code', 'Body end code'];
const keys = Object.keys(empty) as Array<keyof typeof empty>;
let token: string;
const headers = () => ({ authorization: `Bearer ${token}` });
async function current(request: APIRequestContext) {
  const response = await request.get(path, { headers: headers() });
  expect(response.ok()).toBe(true);
  return (await response.json()).data;
}
async function reset(request: APIRequestContext) {
  const config = await current(request);
  const saved = await request.put(path, { headers: headers(), data: { ...empty, expectedRevision: config.revision } });
  expect(saved.ok()).toBe(true);
  const switched = await request.post(`${path}/switch`, { headers: headers(), data: { enabled: true } });
  expect(switched.ok()).toBe(true);
}
test.beforeAll(async ({ request }) => {
  token = (await api<{ token: string }>(request, '/auth/login', {
    method: 'POST', data: { email: ownerEmail, password: 'FinalOwnerPassword123!' },
  })).token;
});
test.beforeEach(async ({ request, page }) => {
  await reset(request);
  await login(page, ownerEmail, 'FinalOwnerPassword123!');
  await page.getByRole('link', { name: 'Tracking & custom code', exact: true }).click();
  await expect(page.getByLabel('GA4 measurement ID', { exact: true })).toBeVisible();
});
test.afterEach(async ({ request }) => reset(request));

function code() {
  const probe = randomUUID();
  const marker = `Admin merchant ${probe}|runs:1|order:head,external,dependent,start,end`;
  const external = `data:text/javascript,${encodeURIComponent("window.adminMerchant.order.push('external');window.adminMerchant.ready=true;")}`;
  return { marker, values: {
    ga4MeasurementId: 'G-ABC123', metaPixelId: '123456', baiduSiteKey: '0123456789abcdef0123456789abcdef',
    headCode: `<script>window.adminMerchant={runs:1,order:['head']};const probe=new Image();probe.src='http://127.0.0.1:3001/api/v1/store/storefront-code?merchantProbe=${probe}';</script><script src="${external}"></script><script>if(!window.adminMerchant.ready)throw new Error('Missing dependency');window.adminMerchant.order.push('dependent');</script>`,
    bodyStartCode: `<script>window.adminMerchant.order.push('start');</script>`,
    bodyEndCode: `<script>window.adminMerchant.order.push('end');const marker=document.createElement('div');marker.textContent='Admin merchant ${probe}|runs:'+window.adminMerchant.runs+'|order:'+window.adminMerchant.order.join(',');document.body.appendChild(marker);</script>`,
  } };
}
async function fill(page: Page, values: Record<keyof typeof empty, string | null>) {
  for (const [index, key] of keys.entries()) await page.getByLabel(labels[index], { exact: true }).fill(values[key] ?? '');
}
async function save(page: Page) {
  await page.getByRole('button', { name: 'Save configuration', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Configuration saved.' })).toHaveText('Configuration saved.');
  await expect(page.getByRole('button', { name: 'Save configuration', exact: true })).toBeEnabled();
}
async function checkValues(page: Page, values: Record<keyof typeof empty, string | null>) {
  for (const [index, key] of keys.entries()) await expect(page.getByLabel(labels[index], { exact: true })).toHaveValue(values[key] ?? '');
}

test('A saves all provider IDs and slots, persists on reload and runs the saved storefront marker', async ({ page }) => {
  const configured = code();
  await fill(page, configured.values); await save(page);
  await page.reload(); await checkValues(page, configured.values);
  await page.goto(`${origin}/en`);
  await expect(page.getByText(configured.marker, { exact: true })).toHaveCount(1);
  await expect(page.getByText(configured.marker, { exact: true })).toBeVisible();
});

test('B invalid GA4 shows a field error without saving or adding history', async ({ page, request }) => {
  const before = await current(request);
  const count = await page.getByLabel('Total revisions', { exact: true }).textContent();
  await page.getByLabel('GA4 measurement ID', { exact: true }).fill('G-abc123');
  await page.getByRole('button', { name: 'Save configuration', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Invalid provider ID format.' })).toHaveText('Invalid provider ID format.');
  await expect(page.getByLabel('GA4 measurement ID', { exact: true })).toHaveValue('G-abc123');
  await expect(page.getByLabel('Total revisions', { exact: true })).toHaveText(count!);
  expect(await current(request)).toEqual(before);
});

test('C save and restore conflicts preserve edits until explicit reload, including after switching', async ({ page, context, request }) => {
  const other = await context.newPage();
  try {
    await other.goto('/en/storefront-code');
    await expect(other.getByLabel('Head code', { exact: true })).toHaveValue('');
    const first = `first-${randomUUID()}`, second = `second-${randomUUID()}`;
    await page.getByLabel('Head code', { exact: true }).fill(first); await save(page);
    await other.getByLabel('Head code', { exact: true }).fill(second);
    await other.getByRole('button', { name: 'Save configuration', exact: true }).click();
    const alert = other.getByRole('alert').filter({ hasText: 'The configuration changed. Your edits are preserved.' });
    await expect(alert).toContainText('The configuration changed. Your edits are preserved.');
    await expect(other.getByLabel('Head code', { exact: true })).toHaveValue(second);
    await expect(other.getByRole('button', { name: 'Save configuration', exact: true })).toBeDisabled();
    await other.getByRole('switch', { name: 'Master switch', exact: true }).uncheck();
    await expect(other.getByRole('switch', { name: 'Master switch', exact: true })).toBeEnabled();
    await expect(other.getByRole('switch', { name: 'Master switch', exact: true })).not.toBeChecked();
    await expect(alert).toContainText('The configuration changed. Your edits are preserved.');
    await expect(other.getByLabel('Head code', { exact: true })).toHaveValue(second);
    await expect(other.getByRole('button', { name: 'Save configuration', exact: true })).toBeDisabled();
    await alert.getByRole('button', { name: 'Reload latest configuration', exact: true }).click();
    await expect(other.getByLabel('Head code', { exact: true })).toHaveValue(first);
    await expect(alert).toHaveCount(0);
    await expect(other.getByRole('button', { name: 'Save configuration', exact: true })).toBeEnabled();
    const snapshot = await current(request);
    await other.getByRole('button', { name: `Revision ${snapshot.revision}`, exact: true }).click();
    await expect(other.getByRole('region', { name: 'Revision details', exact: true }).getByText(first, { exact: true })).toBeVisible();
    const restoreDraft = `restore-draft-${randomUUID()}`, latest = `latest-${randomUUID()}`;
    await other.getByLabel('Head code', { exact: true }).fill(restoreDraft);
    await other.getByRole('button', { name: 'Restore revision', exact: true }).click();
    const confirmation = other.getByRole('alertdialog', { name: 'Confirm restore', exact: true });
    await expect(confirmation).toBeVisible();
    await page.getByRole('button', { name: 'Reload latest configuration', exact: true }).click();
    await expect(page.getByRole('switch', { name: 'Master switch', exact: true })).not.toBeChecked();
    await page.getByLabel('Head code', { exact: true }).fill(latest); await save(page);
    const beforeRestore = await current(request);
    await confirmation.getByRole('button', { name: 'Confirm restore', exact: true }).click();
    await expect(alert).toContainText('The configuration changed. Your edits are preserved.');
    await expect(other.getByLabel('Head code', { exact: true })).toHaveValue(restoreDraft);
    expect(await current(request)).toEqual(beforeRestore);
    await expect(confirmation.getByRole('button', { name: 'Confirm restore', exact: true })).toBeDisabled();
    await expect(other.getByRole('button', { name: 'Restore revision', exact: true })).toBeDisabled();
    await expect(other.getByRole('button', { name: 'Save configuration', exact: true })).toBeDisabled();
    await other.getByRole('switch', { name: 'Master switch', exact: true }).check();
    await expect(other.getByRole('switch', { name: 'Master switch', exact: true })).toBeEnabled();
    await expect(other.getByRole('switch', { name: 'Master switch', exact: true })).toBeChecked();
    await expect(alert).toContainText('The configuration changed. Your edits are preserved.');
    await expect(other.getByLabel('Head code', { exact: true })).toHaveValue(restoreDraft);
    await expect(confirmation.getByRole('button', { name: 'Confirm restore', exact: true })).toBeDisabled();
    await alert.getByRole('button', { name: 'Reload latest configuration', exact: true }).click();
    await expect(other.getByLabel('Head code', { exact: true })).toHaveValue(latest);
    await expect(alert).toHaveCount(0);
    await expect(confirmation).toHaveCount(0);
    await expect(other.getByRole('button', { name: 'Save configuration', exact: true })).toBeEnabled();
  } finally { await other.close(); }
});

test('D the page master switch removes code after reload and restores it when enabled', async ({ page, context }) => {
  const configured = code();
  await fill(page, configured.values); await save(page);
  const shop = await context.newPage();
  try {
    await shop.goto(`${origin}/en`);
    await expect(shop.getByText(configured.marker, { exact: true })).toBeVisible();
    await page.getByRole('switch', { name: 'Master switch', exact: true }).uncheck();
    await expect(page.getByRole('switch', { name: 'Master switch', exact: true })).toBeEnabled();
    await expect(page.getByRole('switch', { name: 'Master switch', exact: true })).not.toBeChecked();
    await shop.reload(); await expect(shop.getByText(configured.marker, { exact: true })).toHaveCount(0);
    await expect(shop.getByRole('link', { name: 'E2E Updated Store', exact: true })).toBeVisible();
    await page.getByRole('switch', { name: 'Master switch', exact: true }).check();
    await expect(page.getByRole('switch', { name: 'Master switch', exact: true })).toBeEnabled();
    await shop.reload(); await expect(shop.getByText(configured.marker, { exact: true })).toBeVisible();
  } finally { await shop.close(); }
});

test('E history is paginated newest first, renders literal code and restores without changing the switch', async ({ page, request }) => {
  const literal = '<img src="http://127.0.0.1:3001/api/v1/store/storefront-code?adminHistoryProbe=1">';
  const values = { ...code().values, headCode: literal, bodyEndCode: 'literal body end' };
  await fill(page, values); await save(page);
  const snapshot = await current(request);
  for (let index = 0; index < 10; index++) {
    await page.getByLabel('Head code', { exact: true }).fill(`newer-${index}-${randomUUID()}`);
    await save(page);
  }
  await page.getByRole('switch', { name: 'Master switch', exact: true }).uncheck();
  await expect(page.getByRole('switch', { name: 'Master switch', exact: true })).toBeEnabled();
  const before = await current(request);
  const history = page.getByRole('region', { name: 'Configuration history', exact: true });
  const response = await request.get(`${path}/revisions?page=1&limit=10`, { headers: headers() });
  expect(response.ok()).toBe(true);
  const data = (await response.json()).data;
  expect(data.items.length).toBe(10);
  const numbers = data.items.map((item: { revision: number }) => item.revision);
  expect(numbers).toEqual(Array.from({ length: 10 }, (_, index) => before.revision - index));
  await expect(history.getByRole('button', { name: /^Revision \d+$/ })).toHaveText(numbers.map((revision: number) => `Revision ${revision}`));
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(history.getByRole('button', { name: /^Revision \d+$/ }).first()).toHaveText(`Revision ${numbers[9] - 1}`);
  await page.getByRole('button', { name: 'Previous page', exact: true }).click();
  await expect(history.getByRole('button', { name: /^Revision \d+$/ }).first()).toHaveText(`Revision ${before.revision}`);
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(history.getByRole('button', { name: `Revision ${snapshot.revision}`, exact: true })).toBeVisible();
  const probes: string[] = [];
  page.on('request', (request) => { if (new URL(request.url()).searchParams.has('adminHistoryProbe')) probes.push(request.url()); });
  await history.getByRole('button', { name: `Revision ${snapshot.revision}`, exact: true }).click();
  const detail = page.getByRole('region', { name: 'Revision details', exact: true });
  await expect(detail.getByText(literal, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Restore revision', exact: true }).click();
  await expect(page.getByRole('alertdialog', { name: 'Confirm restore', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm restore', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Revision restored.' })).toHaveText('Revision restored.');
  await checkValues(page, values);
  await expect(page.getByRole('switch', { name: 'Master switch', exact: true })).not.toBeChecked();
  const after = await current(request);
  expect(after.revision).toBe(before.revision + 1); expect(after.enabled).toBe(false);
  for (const key of keys) expect(after[key]).toBe(snapshot[key]);
  expect(probes).toEqual([]);
});

test('F renders translated headings in both Chinese locales and captures page review views', async ({ page }) => {
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await expect(page.getByRole('heading', { name: 'Tracking & custom code', exact: true })).toBeVisible();
    const heading = await page.getByRole('heading', { name: 'Tracking & custom code', exact: true }).boundingBox();
    const menu = width === 390 ? await page.getByRole('button', { name: 'Open menu', exact: true }).boundingBox() : null;
    console.log('Storefront code heading bounds:', JSON.stringify({ width, heading, menu }));
    expect(heading).not.toBeNull();
    if (width === 390) {
      expect(menu).not.toBeNull();
      expect(heading!.y).toBeGreaterThanOrEqual(menu!.y + menu!.height);
    }
    await captureReview(page, 'storefront-code-review', `en-${width}`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const [locale, title, history, provider] of [
    ['zh-Hans', '跟踪与自定义代码', '配置历史', 'GA4 衡量 ID'],
    ['zh-Hant', '追蹤與自訂程式碼', '設定歷史', 'GA4 評估 ID'],
  ]) {
    await page.goto(`/${locale}/storefront-code`);
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: history, exact: true })).toBeVisible();
    await expect(page.getByLabel(provider, { exact: true })).toBeVisible();
    if (locale === 'zh-Hans') await captureReview(page, 'storefront-code-review', 'zh-Hans-1440');
  }
});
