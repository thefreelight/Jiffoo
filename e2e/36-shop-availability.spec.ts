import { expect, test } from './local-requests';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

test('R exhausted real Core quotas preserve form input and render isolated localized availability pages', async ({ page, request }) => {
  test.setTimeout(180000);
  await page.goto('/en/forgot-password');
  const email = 'availability-retained@example.test';
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(email);
  let denied = false;
  for (let index = 0; index < 101; index++) {
    const response = await request.post('http://127.0.0.1:3001/api/v1/auth/forgot-password', { data: { email } });
    if (response.status() === 429) { denied = true; break; }
    expect(response.status()).toBe(200);
  }
  expect(denied).toBe(true);
  const submitted = page.waitForResponse((response) => response.url().endsWith('/bff/auth/forgot-password'));
  await page.getByRole('button', { name: 'Request reset link' }).click();
  expect((await submitted).status()).toBe(429);
  await expect(page.getByRole('status')).toContainText('Too many requests');
  await expect(page.getByRole('textbox', { name: 'Email', exact: true })).toHaveValue(email);
  await expect(page.getByRole('button', { name: 'Request reset link' })).toBeDisabled();
  if (process.env.VISUAL_SET === 'review') {
    await mkdir(resolve('e2e/visual-results/review'), { recursive: true });
    await page.screenshot({ path: resolve('e2e/visual-results/review/availability-form-en.png'), fullPage: true, animations: 'disabled' });
  }
  denied = false;
  for (let index = 0; index < 1001; index++) {
    const response = await request.get('http://127.0.0.1:3001/api/v1/store/context');
    if (response.status() === 429) { denied = true; break; }
    expect(response.status()).toBe(200);
  }
  expect(denied).toBe(true);
  const merchantRequests: string[] = [];
  page.on('request', (event) => { if (/provider-marker|google|facebook|baidu/.test(event.url())) merchantRequests.push(event.url()); });
  for (const [locale, title, retry] of [['en', 'Too many requests', 'Try again'], ['zh-Hans', '请求过于频繁', '再试一次'], ['zh-Hant', '請求過於頻繁', '再試一次']]) {
    const response = await page.goto(`/${locale}/products`);
    expect(response?.status()).toBe(429);
    await expect(page).toHaveURL(/\/availability\?/);
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await expect(page.getByRole('button', { name: retry })).toBeDisabled();
    expect(response?.headers()['cache-control']).toBe('no-store');
    expect(Number(response?.headers()['retry-after'])).toBeGreaterThan(0);
    expect(await page.content()).not.toMatch(/e2e-head-code|provider-marker|G-E2E/);
    if (process.env.VISUAL_SET === 'review') await page.screenshot({ path: resolve(`e2e/visual-results/review/availability-${locale}.png`), fullPage: true, animations: 'disabled' });
  }
  expect(merchantRequests).toEqual([]);
});
