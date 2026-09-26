import { expect, test } from './local-requests';
import { login, ownerEmail } from './helpers';
import { themePackage } from './theme-package';

test('Admin theme loop updates Shop live, restores and rejects executable packages', async ({ page, context }) => {
  await login(page, ownerEmail, 'FinalOwnerPassword123!');
  await page.getByRole('link', { name: 'Themes' }).click();
  await expect(page.getByRole('heading', { name: 'Default Shop' })).toBeVisible();
  await page.getByLabel('Theme package', { exact: true }).setInputFiles({
    name: 'e2e-shop-theme.zip', mimeType: 'application/zip', buffer: await themePackage(),
  });
  await page.getByLabel('I trust this unsigned theme package').check();
  await page.getByRole('button', { name: 'Upload theme' }).click();
  const row = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'E2E Shop Theme' }) });
  await expect(row.getByRole('button', { name: 'Activate' })).toBeVisible();
  await row.getByRole('button', { name: 'Activate' }).click();
  await expect(row.getByText('Active')).toBeVisible();
  await expect(row.getByRole('button', { name: 'Uninstall' })).toHaveCount(0);

  const shop = await context.newPage();
  await shop.goto('http://127.0.0.1:3003/en');
  await expect(shop.getByRole('button', { name: 'Categories' })).toBeVisible();
  await expect(shop.getByRole('heading', { name: 'Theme launch' })).toBeVisible();
  await expect(shop.getByRole('link', { name: 'Browse products' })).toHaveCSS('background-color', 'rgb(204, 0, 51)');

  await row.getByRole('button', { name: 'Configure' }).click();
  await page.getByRole('region', { name: 'Configure E2E Shop Theme' })
    .getByRole('textbox', { name: 'en', exact: true }).fill('Updated theme heading');
  await page.getByRole('button', { name: 'Save configuration' }).click();
  await expect(page.getByText('Configuration saved', { exact: true })).toBeVisible();
  await shop.reload();
  await expect(shop.getByRole('heading', { name: 'Updated theme heading' })).toBeVisible();
  await page.getByRole('button', { name: 'Restore previous configuration' }).click();
  await expect(page.getByText('Configuration restored', { exact: true })).toBeVisible();
  await shop.reload();
  await expect(shop.getByRole('heading', { name: 'Theme launch' })).toBeVisible();
  await page.getByRole('button', { name: 'Restore previous theme' }).click();
  await expect(page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Default Shop' }) })
    .getByText('Active')).toBeVisible();
  await shop.reload();
  await expect(shop.getByRole('heading', { name: 'Browse categories' })).toBeVisible();
  await expect(shop.getByRole('heading', { name: 'Theme launch' })).toHaveCount(0);

  await page.getByLabel('Theme package', { exact: true }).setInputFiles({
    name: 'invalid-theme.zip', mimeType: 'application/zip', buffer: await themePackage(true),
  });
  await page.getByRole('button', { name: 'Upload theme' }).click();
  await expect(page.getByText('Executable or unsupported package entry: scripts/run.js', { exact: true })).toBeVisible();
  await page.getByRole('region', { name: 'Configure E2E Shop Theme' }).getByRole('button', { name: 'Close' }).click();
  await row.getByRole('button', { name: 'Uninstall' }).click();
  await expect(page.getByRole('heading', { name: 'E2E Shop Theme' })).toHaveCount(0);
  await shop.close();
});
