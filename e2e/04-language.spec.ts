import { expect, test } from './local-requests';
import { login } from './helpers';

test('language switch changes visible text and preserves the route', async ({ page }) => {
  await login(page);
  await page.goto('/en/settings');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Interface language', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await page.getByRole('menuitem', { name: '简体中文' }).click();
  await expect(page).toHaveURL(/\/zh-Hans\/settings/);
  await expect(page.getByRole('heading', { name: 'Settings' })).not.toBeVisible();
  await page.getByRole('button', { name: '账户菜单', exact: true }).click();
  await page.getByRole('menuitem', { name: '界面语言', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await page.getByRole('menuitem', { name: '繁體中文' }).click();
  await expect(page).toHaveURL(/\/zh-Hant\/settings/);
  await page.getByRole('button', { name: '帳戶選單', exact: true }).click();
  await page.getByRole('menuitem', { name: '介面語言', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await page.getByRole('menuitem', { name: 'English' }).click();
  await expect(page).toHaveURL(/\/en\/settings/);
});
