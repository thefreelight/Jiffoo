import { readFile } from 'node:fs/promises';
import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const ownerEmail = 'owner@e2e.example';
export const originalPassword = 'OwnerPassword123!';
export const changedPassword = 'ChangedPassword123!';
export const customerEmail = 'customer@e2e.example';
export const staffEmail = 'staff@e2e.example';

export async function login(page: Page, email = ownerEmail, password = changedPassword) {
  await page.goto('/en/auth/login');
  await page.getByPlaceholder('Enter your email').fill(email);
  await page.getByPlaceholder('Enter your password').fill(password);
  await page.getByRole('button', { name: /sign in|authenticate/i }).click();
  await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
  if (!page.url().endsWith('/en/dashboard')) {
    await page.getByRole('link', { name: 'Dashboard' }).click();
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
    data: options.data,
    headers: options.token ? { authorization: `Bearer ${options.token}` } : {},
  });
  const body = await response.json();
  expect(response.ok(), `${options.method || 'GET'} ${path}: ${JSON.stringify(body)}`).toBeTruthy();
  return body.data as T;
}

export async function customerToken(request: APIRequestContext) {
  const result = await api<{ token: string }>(request, '/auth/login', {
    method: 'POST', data: { email: customerEmail, password: 'CustomerPassword123!' },
  });
  return result.token;
}

export async function deliveredLink(recipient: string, path: string) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const log = await readFile('e2e/test-results/worker.log', 'utf8');
    const messages = log.split('[plugin:console-email] Console email').filter((message) => message.includes(recipient));
    for (const message of messages.reverse()) {
      const match = message.match(/https?:\/\/[^\s"'\\]+/g)?.find((url) => url.includes(path));
      if (match) return match.replace(/[),.]+$/, '');
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No delivered ${path} link for ${recipient} in worker stdout`);
}
