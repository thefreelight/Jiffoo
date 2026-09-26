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
    .getByRole('group', { name: 'Hero heading' })
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

  const defaultRow = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Default Shop' }) });
  await defaultRow.getByRole('button', { name: 'Configure' }).click();
  const editor = page.getByRole('region', { name: 'Configure Default Shop' })
    .getByRole('region', { name: 'Home page' });
  await editor.getByLabel('Add section').selectOption('text-block');
  const text = editor.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Text block · section-1' }) });
  await text.getByRole('button', { name: 'Add Title' }).click();
  await text.getByRole('group', { name: 'Title' }).getByLabel('en', { exact: true }).fill('Merchant welcome');
  await text.getByRole('group', { name: 'Title' }).getByLabel('zh-Hans', { exact: true }).fill('商店欢迎');
  await text.getByRole('group', { name: 'Title' }).getByLabel('zh-Hant', { exact: true }).fill('商店歡迎');
  await text.getByRole('group', { name: 'Body' }).getByLabel('en', { exact: true }).fill('Welcome to our store');
  await text.getByRole('group', { name: 'Body' }).getByLabel('zh-Hans', { exact: true }).fill('欢迎来到商店');
  await text.getByRole('group', { name: 'Body' }).getByLabel('zh-Hant', { exact: true }).fill('歡迎來到商店');
  await text.getByRole('button', { name: 'Move up' }).click();
  await text.getByRole('button', { name: 'Move up' }).click();
  const grid = editor.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Product grid · home-products' }) });
  await grid.getByRole('button', { name: 'Move up' }).click();
  const categories = editor.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Category list · home-categories' }) });
  await categories.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Save configuration' }).click();
  await expect(page.getByText('Configuration saved', { exact: true })).toBeVisible();
  await shop.reload();
  await expect(shop.getByRole('heading', { name: 'Merchant welcome' })).toBeVisible();
  await expect(shop.getByRole('heading', { name: 'Browse categories' })).toHaveCount(0);
  await expect(shop.getByRole('heading', { level: 2 })).toHaveText(['Merchant welcome', 'Featured products']);
  await shop.goto('http://127.0.0.1:3003/zh-Hans');
  await expect(shop.getByRole('heading', { name: '商店欢迎' })).toBeVisible();
  await editor.getByRole('button', { name: 'Reset to theme default' }).click();
  await page.getByRole('button', { name: 'Save configuration' }).click();
  await expect(page.getByText('Configuration saved', { exact: true })).toBeVisible();
  await shop.goto('http://127.0.0.1:3003/en');
  await expect(shop.getByRole('heading', { level: 2 })).toHaveText(['Browse categories', 'Featured products']);

  await page.getByLabel('Theme package', { exact: true }).setInputFiles({
    name: 'invalid-theme.zip', mimeType: 'application/zip', buffer: await themePackage(true),
  });
  await page.getByRole('button', { name: 'Upload theme' }).click();
  await expect(page.getByText('Executable or unsupported package entry: scripts/run.js', { exact: true })).toBeVisible();
  await page.getByRole('region', { name: 'Configure Default Shop' }).getByRole('button', { name: 'Close' }).click();
  await row.getByRole('button', { name: 'Uninstall' }).click();
  await expect(page.getByRole('heading', { name: 'E2E Shop Theme' })).toHaveCount(0);
  await shop.close();
});
