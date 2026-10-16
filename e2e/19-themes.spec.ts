import { expect, test } from './review-capture';
import { login, ownerEmail } from './helpers';
import { themePackage } from './theme-package';
import { captureThemeCodeState } from './theme-code-captures';
import type { Page } from '@playwright/test';

async function save(page: Page) {
  const response = page.waitForResponse(reply => reply.request().method() === 'PUT' && /\/themes\/[^/]+\/config$/.test(new URL(reply.url()).pathname));
  await page.getByRole('button', { name: 'Save', exact: true }).click(); expect((await response).ok()).toBe(true);
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
}
async function more(page: Page, item: string) {
  await page.getByRole('button', { name: 'More actions', exact: true }).click();
  await page.getByRole('menuitem', { name: item, exact: true }).click();
}
async function back(page: Page) { await page.getByRole('link', { name: '← Themes', exact: true }).click(); }

test('C1a customises shop themes, edits home sections, preserves stale drafts and restores defaults', async ({ page, context }) => {
  test.setTimeout(180000);
  await login(page, ownerEmail, 'FinalOwnerPassword123!');
  await page.getByRole('link', { name: 'Themes', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Default Shop', exact: true })).toBeVisible();
  await captureThemeCodeState(page, 'themes-builtin');
  await captureThemeCodeState(page, 'themes-upload', { open: () => page.getByRole('button', { name: 'Upload theme', exact: true }).click(), close: () => page.getByRole('button', { name: 'Cancel', exact: true }).click() });
  await page.getByRole('button', { name: 'Upload theme', exact: true }).click();
  await page.getByLabel('Theme package', { exact: true }).setInputFiles({ name: 'shop.zip', mimeType: 'application/zip', buffer: await themePackage() });
  await page.getByLabel('I trust this theme package. It is unsigned, so the system cannot verify its author.', { exact: true }).check();
  await page.getByRole('button', { name: 'Install', exact: true }).click();
  await page.getByRole('article', { name: 'E2E Shop Theme', exact: true }).getByRole('button', { name: 'Activate', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Active', exact: true }).getByRole('heading', { name: 'E2E Shop Theme' })).toBeVisible();
  await captureThemeCodeState(page, 'themes-normal');
  await page.getByRole('link', { name: 'Customise', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Customise E2E Shop Theme', exact: true })).toBeVisible();
  await captureThemeCodeState(page, 'theme-edit-saved');
  const other = await context.newPage();
  await other.goto('/en/themes/shop/e2e-shop-theme');
  await expect(other.getByRole('group', { name: 'Hero heading', exact: true })).toBeVisible();
  await page.getByRole('group', { name: 'Hero heading', exact: true }).getByRole('textbox', { name: 'en', exact: true }).fill('Updated theme heading');
  await captureThemeCodeState(page, 'theme-edit-dirty');
  await page.getByRole('link', { name: 'Orders', exact: true }).click();
  await expect(page.getByRole('alertdialog', { name: 'Unsaved changes', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await page.getByRole('link', { name: 'Orders', exact: true }).click();
  await expect(page.getByRole('alertdialog', { name: 'Unsaved changes', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await page.getByRole('button', { name: 'Close menu', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Hero heading', exact: true }).getByRole('textbox', { name: 'en', exact: true })).toHaveValue('Updated theme heading');
  await page.setViewportSize({ width: 1440, height: 900 });
  await save(page);
  const shop = await context.newPage();
  await shop.goto('http://127.0.0.1:3003/en'); await expect(shop.getByRole('heading', { name: 'Updated theme heading', exact: true })).toBeVisible();
  await other.getByRole('group', { name: 'Hero heading', exact: true }).getByRole('textbox', { name: 'en', exact: true }).fill('Stale heading');
  await other.getByRole('button', { name: 'Save', exact: true }).click();
  const conflict = other.getByRole('alert').filter({ hasText: 'Someone saved this theme configuration elsewhere.' });
  await expect(conflict).toBeVisible();
  await expect(other.getByRole('group', { name: 'Hero heading', exact: true }).getByRole('textbox', { name: 'en', exact: true })).toHaveValue('Stale heading');
  await captureThemeCodeState(other, 'theme-edit-conflict');
  await conflict.getByRole('button', { name: 'Load latest configuration', exact: true }).click();
  await expect(other.getByRole('group', { name: 'Hero heading', exact: true }).getByRole('textbox', { name: 'en', exact: true })).toHaveValue('Updated theme heading'); await other.close();
  await more(page, 'Restore previous configuration');
  await page.getByRole('alertdialog', { name: 'Restore previous configuration', exact: true }).getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Hero heading', exact: true }).getByRole('textbox', { name: 'en', exact: true })).toHaveValue('Theme launch');
  await back(page);
  await page.getByRole('button', { name: 'More actions: E2E Shop Theme', exact: true }).click(); await page.getByRole('menuitem', { name: 'Restore previous theme', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Active', exact: true }).getByRole('heading', { name: 'Default Shop', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Customise', exact: true }).click();
  await expect(page.getByText('This theme has no adjustable settings.', { exact: true })).toBeVisible();
  await captureThemeCodeState(page, 'theme-edit-no-settings');
  await captureThemeCodeState(page, 'theme-edit-add-menu', { open: () => page.getByRole('button', { name: 'Add section', exact: true }).click(), close: () => page.keyboard.press('Escape') });
  await page.getByRole('button', { name: 'Add section', exact: true }).click(); await page.getByRole('menuitem', { name: 'Text block', exact: true }).click();
  const block = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Text block', exact: true }) });
  await block.getByRole('group', { name: 'Body', exact: true }).getByLabel('en', { exact: true }).fill('Merchant welcome');
  await block.getByRole('group', { name: 'Body', exact: true }).getByLabel('zh-Hans', { exact: true }).fill('欢迎');
  await block.getByRole('group', { name: 'Body', exact: true }).getByLabel('zh-Hant', { exact: true }).fill('歡迎');
  await block.getByRole('button', { name: 'Move up: Text block', exact: true }).click();
  await block.getByRole('button', { name: 'Move up: Text block', exact: true }).click();
  const categories = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Category list', exact: true }) });
  await categories.getByRole('button', { name: 'Delete: Category list', exact: true }).click();
  await save(page); await shop.reload(); await expect(shop.getByText('Merchant welcome', { exact: true })).toBeVisible(); await expect(shop.getByRole('heading', { name: 'Browse categories', exact: true })).toHaveCount(0);
  expect((await shop.getByText('Merchant welcome', { exact: true }).boundingBox())!.y).toBeLessThan((await shop.getByRole('heading', { name: 'New arrivals', exact: true }).boundingBox())!.y);
  await more(page, 'Reset home to theme defaults'); await page.getByRole('alertdialog', { name: 'Reset home to theme defaults', exact: true }).getByRole('button', { name: 'Confirm', exact: true }).click(); await save(page);
  await shop.reload(); await expect(shop.getByRole('heading', { name: 'Browse categories', exact: true })).toBeVisible(); await shop.close(); await back(page);
  await page.getByRole('button', { name: 'Upload theme', exact: true }).click(); await page.getByLabel('Theme package', { exact: true }).setInputFiles({ name: 'invalid.zip', mimeType: 'application/zip', buffer: await themePackage(true) }); await page.getByLabel('I trust this theme package. It is unsigned, so the system cannot verify its author.', { exact: true }).check(); await page.getByRole('button', { name: 'Install', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Upload theme', exact: true }).getByRole('alert')).toContainText('Executable or unsupported package entry: scripts/run.js'); await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'More actions: E2E Shop Theme', exact: true }).click(); await page.getByRole('menuitem', { name: 'Uninstall', exact: true }).click(); await expect(page.getByRole('article', { name: 'E2E Shop Theme', exact: true })).toHaveCount(0);
});
