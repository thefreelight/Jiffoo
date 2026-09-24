import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('language switch changes visible text and preserves the route', async ({ page }) => {
  await login(page);
  await page.goto('/en/settings');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await page.getByRole('button', { name: 'Change language' }).click();
  await page.getByRole('menuitem', { name: '简体中文' }).click();
  await expect(page).toHaveURL(/\/zh-Hans\/settings/);
  await expect(page.getByRole('heading', { name: 'Settings' })).not.toBeVisible();
  await page.getByRole('button', { name: 'Change language' }).click();
  await page.getByRole('menuitem', { name: '繁體中文' }).click();
  await expect(page).toHaveURL(/\/zh-Hant\/settings/);
  await page.getByRole('button', { name: 'Change language' }).click();
  await page.getByRole('menuitem', { name: 'English' }).click();
  await expect(page).toHaveURL(/\/en\/settings/);
});
