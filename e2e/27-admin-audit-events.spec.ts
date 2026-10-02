import { captureReview, expect, test } from './review-capture';
import type { APIRequestContext, Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import archiver from 'archiver';
import { api, login, ownerEmail } from './helpers';

const base = 'http://127.0.0.1:3001/api/v1';
const empty = { ga4MeasurementId: null, metaPixelId: null, baiduSiteKey: null, headCode: '', bodyStartCode: '', bodyEndCode: '' };
type Event = { id: string; createdAt: string; action: string; targetType: string; targetId: string;
  summary: unknown; actor: { id: string; email: string; username: string; isActive: boolean } | null };
let token: string;
let actorId: string;
const headers = () => ({ authorization: `Bearer ${token}` });
test.describe.configure({ mode: 'serial' });

async function current(request: APIRequestContext) {
  const response = await request.get(`${base}/admin/storefront-code`, { headers: headers() });
  expect(response.ok()).toBe(true);
  return (await response.json()).data;
}
async function saveConfig(request: APIRequestContext) {
  const config = await current(request);
  const response = await request.put(`${base}/admin/storefront-code`, {
    headers: headers(), data: { ...empty, expectedRevision: config.revision },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()).data;
}
async function reset(request: APIRequestContext) {
  await saveConfig(request);
  const response = await request.post(`${base}/admin/storefront-code/switch`, { headers: headers(), data: { enabled: true } });
  expect(response.ok()).toBe(true);
}
async function events(request: APIRequestContext, query = ''): Promise<Event[]> {
  const response = await request.get(`${base}/admin/audit-events?limit=100&actorId=${actorId}${query}`, { headers: headers() });
  expect(response.ok()).toBe(true);
  return (await response.json()).data.items;
}
async function open(page: Page) {
  await page.getByRole('link', { name: 'Audit log', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Audit log', exact: true })).toHaveAttribute('aria-busy', 'false');
}
const rows = (page: Page) => page.getByRole('table', { name: 'Audit log', exact: true }).getByRole('row');
function localDate(value: string) {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 23)
    .replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.000$/, '').replace(/:00$/, '');
  expect(new Date(local).getTime()).toBe(date.getTime());
  return local;
}
async function select(page: Page, label: string, value: string) {
  await page.getByRole('combobox', { name: label, exact: true }).selectOption(value);
  await expect(page.getByRole('table', { name: 'Audit log', exact: true })).toHaveAttribute('aria-busy', 'false');
}

test.beforeAll(async ({ request }) => {
  const result = await api<{ token: string; user: { id: string } }>(request, '/auth/login', {
    method: 'POST', data: { email: ownerEmail, password: 'FinalOwnerPassword123!' },
  });
  token = result.token;
  actorId = result.user.id;
});
test.beforeEach(async ({ page, request }) => {
  await reset(request);
  await login(page, ownerEmail, 'FinalOwnerPassword123!');
});
test.afterEach(async ({ request }) => { await reset(request); });

test('G UI save and master switch changes appear newest first with exact action labels and actor email', async ({ page, request }) => {
  await page.getByRole('link', { name: 'Tracking & custom code', exact: true }).click();
  await expect(page.getByLabel('GA4 measurement ID', { exact: true })).toBeVisible();
  const before = await current(request);
  await page.getByRole('button', { name: 'Save configuration', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Configuration saved.' })).toHaveText('Configuration saved.');
  await page.getByRole('switch', { name: 'Master switch', exact: true }).uncheck();
  await expect(page.getByLabel('Current revision', { exact: true })).toHaveText(String(before.revision + 2));
  await page.getByRole('switch', { name: 'Master switch', exact: true }).check();
  await expect(page.getByLabel('Current revision', { exact: true })).toHaveText(String(before.revision + 3));
  const latest = (await events(request)).slice(0, 3);
  expect(latest.map((row) => row.action)).toEqual(['storefront-code.switch', 'storefront-code.switch', 'storefront-code.save']);
  await open(page);
  for (const [index, event] of latest.entries()) {
    const row = rows(page).nth(index + 1);
    await expect(row.getByRole('button', { name: `Event details ${event.id}`, exact: true })).toBeVisible();
    await expect(row.getByRole('cell').nth(1)).toContainText(ownerEmail);
    await expect(row.getByRole('cell').nth(2)).toHaveText(index === 2 ? 'Tracking configuration saved' : 'Tracking master switch changed');
  }
});

test('H action and time filters restrict rows and pagination moves between exact event pages', async ({ page, request }) => {
  for (let index = 0; index < 21; index++) await saveConfig(request);
  const own = (await events(request, '&action=storefront-code.save')).slice(0, 21);
  expect(own).toHaveLength(21);
  await open(page);
  await select(page, 'Action', 'storefront-code.save');
  for (const row of await rows(page).all()) {
    if ((await row.getByRole('cell').count()) > 0)
      await expect(row.getByRole('cell').nth(2)).toHaveText('Tracking configuration saved');
  }
  await page.getByLabel('From', { exact: true }).fill(localDate(own[20].createdAt));
  await page.getByLabel('To', { exact: true }).fill(localDate(own[0].createdAt));
  await expect(page.getByLabel('Total events', { exact: true })).toHaveText('21');
  await expect(page.getByLabel('Page', { exact: true })).toHaveText('1 / 2');
  for (const [index, event] of own.slice(0, 20).entries())
    await expect(rows(page).nth(index + 1).getByRole('button', { name: `Event details ${event.id}`, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(page.getByLabel('Page', { exact: true })).toHaveText('2 / 2');
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).nth(1).getByRole('button', { name: `Event details ${own[20].id}`, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Previous page', exact: true }).click();
  await expect(page.getByLabel('Page', { exact: true })).toHaveText('1 / 2');
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await page.getByLabel('From', { exact: true }).fill(localDate(own[0].createdAt));
  await expect(page.getByLabel('Page', { exact: true })).toHaveText('1 / 1');
  await expect(page.getByLabel('Total events', { exact: true })).toHaveText('1');
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).nth(1).getByRole('button', { name: `Event details ${own[0].id}`, exact: true })).toBeVisible();
});

async function installAndRemoveTheme(request: APIRequestContext) {
  const manifest = JSON.parse(await readFile(resolve(__dirname, 'fixtures/themes/test-shop-theme/theme.json'), 'utf8'));
  manifest.slug = `audit-${randomUUID().replaceAll('-', '').slice(0, 24)}`;
  manifest.name = manifest.slug;
  const archive = archiver('zip', { zlib: { level: 9 } });
  const chunks: Buffer[] = [];
  archive.on('data', (chunk: Buffer) => chunks.push(chunk));
  const finished = new Promise<void>((done, fail) => { archive.on('end', done); archive.on('error', fail); });
  archive.append(JSON.stringify(manifest), { name: 'theme.json' });
  await archive.finalize();
  await finished;
  const installed = await request.post(`${base}/extensions/theme/install`, { headers: headers(), multipart: {
    confirmUnsigned: 'true', file: { name: 'audit-theme.zip', mimeType: 'application/zip', buffer: Buffer.concat(chunks) },
  } });
  expect(installed.status()).toBe(200);
  const removed = await request.delete(`${base}/extensions/theme/${manifest.slug}`, { headers: headers() });
  expect(removed.ok()).toBe(true);
  return manifest.slug as string;
}

test('I expanded details show literal revision JSON and an empty writer summary shows Not recorded', async ({ page, request }) => {
  await saveConfig(request);
  const saved = (await events(request, '&action=storefront-code.save'))[0];
  const slug = await installAndRemoveTheme(request);
  const removed = (await events(request, '&action=theme.uninstall')).find((row) => row.targetId === slug)!;
  expect(removed.summary).toEqual({});
  await open(page);
  await page.getByRole('button', { name: `Event details ${saved.id}`, exact: true }).click();
  await expect(page.getByLabel('Summary', { exact: true })).toHaveText(JSON.stringify(saved.summary, null, 2));
  await expect(page.getByLabel('Summary', { exact: true })).toContainText('"fromRevision":');
  await expect(page.getByLabel('Summary', { exact: true })).toContainText('"toRevision":');
  await page.getByRole('button', { name: `Event details ${removed.id}`, exact: true }).click();
  await expect(page.getByLabel('Summary', { exact: true })).toHaveText('Not recorded');
});

test('J Chinese titles and column headers are exact and review views fit desktop and mobile', async ({ page, request }) => {
  await saveConfig(request);
  await open(page);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
    await expect(page.getByRole('heading', { name: 'Audit log', exact: true })).toBeVisible();
    const heading = await page.getByRole('heading', { name: 'Audit log', exact: true }).boundingBox();
    expect(heading).not.toBeNull();
    expect(heading!.x).toBeGreaterThanOrEqual(0);
    expect(heading!.x + heading!.width).toBeLessThanOrEqual(width);
    await captureReview(page, 'audit-review', `en-${width}`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const entry of [
    { locale: 'zh-Hans', title: '审计日志', columns: ['时间', '操作人', '操作', '目标'] },
    { locale: 'zh-Hant', title: '稽核日誌', columns: ['時間', '操作人', '操作', '目標'] },
  ]) {
    await page.goto(`/${entry.locale}/audit-events`);
    await expect(page.getByRole('heading', { name: entry.title, exact: true })).toBeVisible();
    const table = page.getByRole('table', { name: entry.title, exact: true });
    await expect(table).toHaveAttribute('aria-busy', 'false');
    for (const column of entry.columns) await expect(table.getByRole('columnheader', { name: column, exact: true })).toBeVisible();
    await expect(table.getByText(entry.locale === 'zh-Hans' ? '已保存跟踪配置' : '已儲存追蹤設定', { exact: true }).first()).toBeVisible();
    if (entry.locale === 'zh-Hans') await captureReview(page, 'audit-review', 'zh-Hans-1440');
  }
});
