import { readFile } from 'node:fs/promises';
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { getNamespaceMessages } from '../packages/shared/src/i18n/messages';

export const ownerEmail = 'owner@e2e.example';
export const originalPassword = 'OwnerPassword123!';
export const changedPassword = 'ChangedPassword123!';
export const finalOwnerPassword = 'FinalOwnerPassword123!';
export const customerEmail = 'customer@e2e.example';
export const staffEmail = 'staff@e2e.example';
type ShopLocale = 'en' | 'zh-Hans' | 'zh-Hant';

const shopLabels = {
  en: { email: 'Email', password: 'Password', login: 'Login', logout: 'Logout', account: 'Account' },
  'zh-Hans': { email: '邮箱', password: '密码', login: '登录', logout: '退出登录', account: '账户' },
  'zh-Hant': { email: '電子郵件', password: '密碼', login: '登入', logout: '登出', account: '帳戶' },
} as const;

function shopCopy(locale: ShopLocale) {
  return getNamespaceMessages(locale, 'storefront') as { shop: { openMenu: string; closeMenu: string }; navigation: Record<string, string> };
}

export async function shopAccountAction(page: Page, locale: ShopLocale, action: 'login' | 'register' | 'account' | 'orders' | 'logout') {
  const t = shopCopy(locale);
  const phone = (page.viewportSize()?.width ?? 1440) < 768;
  await page.getByRole('button', { name: phone ? t.shop.openMenu : t.navigation.account, exact: true }).click();
  await page.getByRole(phone ? action === 'logout' ? 'button' : 'link' : 'menuitem', { name: t.navigation[action], exact: true }).click();
}

export async function shopLogin(page: Page, { locale, email, password, expectedPath }: {
  locale: ShopLocale; email: string; password: string; expectedPath: string;
}) {
  const labels = shopLabels[locale];
  await page.getByLabel(labels.email).fill(email);
  await page.getByLabel(labels.password, { exact: true }).fill(password);
  await page.getByRole('button', { name: labels.login, exact: true }).click();
  await expect(page).toHaveURL(new URL(expectedPath, page.url()).href);
  const phone = (page.viewportSize()?.width ?? 1440) < 768;
  const t = shopCopy(locale);
  await page.getByRole('button', { name: phone ? t.shop.openMenu : labels.account, exact: true }).click();
  await expect(page.getByRole(phone ? 'link' : 'menuitem', { name: labels.account, exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
}

export async function shopLogout(page: Page, { locale }: { locale: ShopLocale }) {
  const labels = shopLabels[locale];
  await shopAccountAction(page, locale, 'logout');
  await expect(page).toHaveURL(new URL(`/${locale}`, page.url()).href);
  const phone = (page.viewportSize()?.width ?? 1440) < 768;
  await page.getByRole('button', { name: phone ? shopCopy(locale).shop.openMenu : labels.account, exact: true }).click();
  await expect(page.getByRole(phone ? 'link' : 'menuitem', { name: labels.login, exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
}

export async function login(page: Page, email = ownerEmail, password = changedPassword) {
  await page.goto('/en/auth/login');
  await page.getByLabel('Email or login name', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: /sign in|authenticate/i }).click();
  await expect(page.getByRole('link', { name: 'Overview' })).toBeVisible();
  if (!page.url().endsWith('/en/dashboard')) {
    await page.getByRole('link', { name: 'Overview' }).click();
  }
  await expect(page).toHaveURL(/\/en\/dashboard/);
}

export async function logout(page: Page) {
  await page.getByRole('button', { name: 'Account menu' }).last().click();
  await page.getByRole('menuitem', { name: /log out/i }).click();
  await expect(page).toHaveURL(/\/en\/auth\/login/);
}

export async function api<T>(request: APIRequestContext, path: string, options: {
  method?: 'GET' | 'POST';
  data?: unknown;
  token?: string;
} = {}): Promise<T> {
  const response = await request.fetch(`http://127.0.0.1:3001/api/v1${path}`, {
    method: options.method || 'GET',
    data: path === '/auth/login' ? { surface: 'admin', ...(options.data as Record<string, unknown>) } : options.data,
    headers: options.token ? { authorization: `Bearer ${options.token}` } : {},
  });
  const body = await response.json();
  expect(response.ok(), `${options.method || 'GET'} ${path}: ${JSON.stringify(body)}`).toBeTruthy();
  return body.data as T;
}

export async function customerToken(request: APIRequestContext) {
  const result = await api<{ token: string }>(request, '/auth/login', {
    method: 'POST', data: { email: customerEmail, password: 'CustomerPassword123!', surface: 'storefront' },
  });
  return result.token;
}

export async function deliveredLink(recipient: string, path: string, afterLink?: string) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const log = await readFile('e2e/test-results/worker.log', 'utf8');
    const messages = log.split('[plugin:console-email] Console email').filter((message) => message.includes(recipient));
    for (const message of messages.reverse()) {
      const match = message.match(/https?:\/\/[^\s"'\\]+/g)?.find((url) => {
        try {
          return new URL(url).pathname === path;
        } catch { return false; }
      });
      if (match && match.replace(/[),.]+$/, '') !== afterLink) return match.replace(/[),.]+$/, '');
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No delivered ${path} link for ${recipient} in worker stdout`);
}
