import { captureReview, expect, test } from './review-capture';
import type { APIRequestContext } from '@playwright/test';
import { api, login, ownerEmail } from './helpers';
import { storeLocalDate } from './store-local-date';

const base = 'http://127.0.0.1:3001/api/v1';
let token: string, actorId: string, actorName: string, timezone: string;
const headers = () => ({ authorization: `Bearer ${token}` });
const empty = { ga4MeasurementId: null, metaPixelId: null, baiduSiteKey: null, headCode: '', bodyStartCode: '', bodyEndCode: '' };
test.describe.configure({ mode: 'serial' });
async function saveCode(request: APIRequestContext) {
  const current = await request.get(`${base}/admin/storefront-code`, { headers: headers() });
  expect(current.ok()).toBe(true);
  const response = await request.put(`${base}/admin/storefront-code`, { headers: headers(), data: { ...empty, expectedRevision: (await current.json()).data.revision } });
  expect(response.ok()).toBe(true);
}
test.beforeAll(async ({ request }) => {
  const result = await api<{ token: string; user: { id: string; username: string } }>(request, '/auth/login', { method: 'POST', data: { email: ownerEmail, password: 'FinalOwnerPassword123!' } });
  token = result.token; actorId = result.user.id; actorName = result.user.username; timezone = (await api<{ timezone: string }>(request, '/store/context')).timezone;
});
test.beforeEach(async ({ page, request }) => { await saveCode(request); await login(page, ownerEmail, 'FinalOwnerPassword123!'); });

test('audit rows show real actors, expanded facts and literal raw records', async ({ page }) => {
  await page.goto('/en/audit-events');
  const table = page.getByRole('table', { name: 'Audit log', exact: true });
  await expect(table).toBeVisible();
  const row = table.getByRole('row', { name: /Tracking configuration saved/ }).first();
  await expect(row.getByText(actorName, { exact: true })).toBeVisible();
  await row.getByRole('button', { name: 'Expand: Tracking configuration saved', exact: true }).click();
  await page.getByRole('button', { name: 'Technical details (raw record) ›', exact: true }).filter({ visible: true }).click();
  await expect(page.getByText(/"fromRevision":/).filter({ visible: true })).toBeVisible();
  await expect(page.getByText(/"toRevision":/).filter({ visible: true })).toBeVisible();
});

test('category, actor and exact time filters persist in the URL, paginate and export', async ({ page, request }) => {
  for (let index = 0; index < 21; index++) await saveCode(request);
  const response = await request.get(`${base}/admin/audit-events?limit=100&actorId=${actorId}&action=storefront-code.save`, { headers: headers() });
  expect(response.ok()).toBe(true);
  const own = (await response.json()).data.items.slice(0, 21);
  expect(own).toHaveLength(21);
  await page.goto('/en/audit-events');
  await page.getByRole('combobox', { name: 'Category', exact: true }).click();
  await page.getByRole('option', { name: 'Tracking code', exact: true }).click();
  await page.getByRole('combobox', { name: 'Actor', exact: true }).click();
  await page.getByRole('option', { name: actorName + ' · ' + ownerEmail, exact: true }).click();
  await page.getByText('Time', { exact: true }).click();
  await page.getByLabel(`From (${timezone})`, { exact: true }).fill(storeLocalDate(own[20].createdAt, timezone));
  await page.getByLabel(`To (${timezone})`, { exact: true }).fill(storeLocalDate(own[0].createdAt, timezone));
  await expect(page.getByText('21 records', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Page 2', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('table', { name: 'Audit log', exact: true }).getByRole('row', { name: /.+/ })).toHaveCount(2);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Page 2', exact: true })).toHaveAttribute('aria-current', 'page');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('audit-events.json');
  await page.getByRole('button', { name: 'Clear all', exact: true }).click();
  await expect(page).not.toHaveURL(/category=|actorId=|from=|to=/);
});

test('audit cards fit phones and all three locale headings are available', async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
    await page.goto('/en/audit-events');
    const heading = page.getByRole('heading', { name: 'Audit log', exact: true });
    await expect(heading).toBeVisible();
    const bounds = await heading.boundingBox(); expect(bounds).not.toBeNull(); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    if (width === 390) {
      await expect(page.getByRole('table', { name: 'Audit log', exact: true })).toBeHidden();
      await page.getByRole('button', { name: 'Expand: Tracking configuration saved', exact: true }).first().click();
      await expect(page.getByRole('button', { name: 'Technical details (raw record) ›', exact: true })).toBeVisible();
    }
    await captureReview(page, 'audit-review', `en-${width}`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const [locale, title] of [['zh-Hans', '审计记录'], ['zh-Hant', '稽核記錄']]) {
    await page.goto(`/${locale}/audit-events`);
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(page.getByRole('table', { name: title, exact: true })).toBeVisible();
  }
});
