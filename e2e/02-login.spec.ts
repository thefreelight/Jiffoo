import { expect, test } from './local-requests';
import { login, logout, originalPassword, ownerEmail } from './helpers';
import { captureAuthState } from './auth-captures';
import { getTestPrisma, disconnectDatabase } from '../apps/api/tests/helpers/db';
import Redis from 'ioredis';
import bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';

test('logout and login preserve the session across reload', async ({ page }) => {
  await login(page, ownerEmail, originalPassword);
  await logout(page);
  await login(page, ownerEmail, originalPassword);
  await page.reload();
  await expect(page).toHaveURL(/\/en\/dashboard/);
});

test('K default Admin theme requests no Outfit font files', async ({ page }) => {
  const outfitRequests: string[] = [];
  page.on('request', (request) => {
    if (/outfit.*\.woff2/i.test(request.url())) outfitRequests.push(request.url());
  });
  await login(page, ownerEmail, originalPassword);
  await expect(page.getByRole('link', { name: 'Overview' })).toBeVisible();
  expect(outfitRequests).toEqual([]);
});

test('customer credentials disclose account type only after the correct password and Admin cannot sign in to Shop', async ({ page }) => {
  test.setTimeout(120000);
  const db = getTestPrisma();
  try {
    const email = 'surface-customer@e2e.example', password = 'CustomerSurface123!';
    await db.user.create({ data: { email, username: 'surface-customer', password: await bcrypt.hash(password, 10), role: 'USER', isActive: true } });
    await page.goto('/zh-Hans/auth/login');
    await captureAuthState(page, 'login', '登录后台');
    await page.getByLabel('邮箱或登录名', { exact: true }).fill(email);
    await page.getByLabel('密码', { exact: true }).fill('WrongPassword123!');
    await page.getByRole('button', { name: '登录', exact: true }).click();
    await expect(page.getByRole('region', { name: '登录后台', exact: true }).getByRole('alert')).toHaveText('邮箱或密码不对，请重新输入。');
    await captureAuthState(page, 'login-wrong-password', '登录后台');
    await page.getByLabel('密码', { exact: true }).fill(password);
    await page.getByRole('button', { name: '登录', exact: true }).click();
    await expect(page.getByRole('region', { name: '登录后台', exact: true }).getByRole('alert')).toHaveText('这是商城的顾客账户，不能登录后台。如果你是店铺管理员，请用管理员邮箱登录。');
    await captureAuthState(page, 'login-customer', '登录后台');
    await page.getByRole('combobox', { name: '界面语言', exact: true }).click();
    await page.getByRole('option', { name: '繁體中文', exact: true }).click();
    await expect(page.getByRole('heading', { name: '登入後台', exact: true })).toBeVisible();
    await page.getByRole('combobox', { name: '介面語言', exact: true }).click();
    await page.getByRole('option', { name: 'English', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Sign in to Admin', exact: true })).toBeVisible();
    await page.goto('http://127.0.0.1:3003/zh-Hans/login');
    await page.getByLabel('邮箱', { exact: true }).fill(ownerEmail);
    await page.getByLabel('密码', { exact: true }).fill(originalPassword);
    await page.getByRole('button', { name: '登录', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('这是店铺后台的管理员账户，不能在商城登录或下单。');
  } finally { await db.user.deleteMany({ where: { email: 'surface-customer@e2e.example' } }); await disconnectDatabase(); }
});

test('shared login protection shows the too-many-attempts screen', async ({ page }) => {
  test.setTimeout(120000);
  const redisUrl = process.env.REDIS_URL!;
  expect(new URL(redisUrl).pathname).toBe('/14');
  const redis = new Redis(redisUrl);
  try {
    await page.goto('/zh-Hans/auth/login');
    await page.getByLabel('邮箱或登录名', { exact: true }).fill('missing-rate-limit@e2e.example');
    await page.getByLabel('密码', { exact: true }).fill('WrongPassword123!');
    for (let i = 0; i < 21; i++) {
      const response = page.waitForResponse(response => response.url().endsWith('/api/v1/auth/login') && response.request().method() === 'POST');
      await page.getByRole('button', { name: '登录', exact: true }).click();
      if ((await response).status() === 429) break;
    }
    await expect(page.getByRole('region', { name: '登录后台', exact: true }).getByRole('alert')).toHaveText('登录尝试次数太多，请稍后再试。');
    await captureAuthState(page, 'login-rate-limited', '登录后台');
  } finally {
    await redis.del('jiffoo:protection:rl:/api/v1/auth/login:ip:127.0.0.1');
    // The per-account bucket of the same sign-ins is cleaned up as well, so
    // the case leaves no state behind for the later specs.
    const accountHash = createHash('sha256').update('missing-rate-limit@e2e.example').digest('hex');
    const accountPrefix = `jiffoo:protection:rl:login-account:account:${accountHash}`;
    const accountKeys = await redis.keys(`${accountPrefix}:*`);
    if (accountKeys.length) await redis.del(...accountKeys);
    redis.disconnect();
  }
});
