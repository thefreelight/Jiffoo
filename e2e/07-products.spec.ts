import { expect, test } from './local-requests';
import { api, changedPassword, login, ownerEmail } from './helpers';
import { getTestPrisma, disconnectDatabase } from '../apps/api/tests/helpers/db';
import { createOrderWithItems } from '../apps/api/tests/helpers/fixtures';
import { captureU4, appearanceU4 } from './u4-captures';
import { readFile } from 'node:fs/promises';

test('create a stocked product and open its detail from the list', async ({ page }) => {
  await login(page);
  await page.goto('/en/products/create');
  await page.getByLabel('Name', { exact: true }).first().fill('E2E Product');
  await page.getByLabel('Name', { exact: true }).nth(1).fill('Standard');
  await page.getByLabel('SKU', { exact: true }).fill('E2E-001');
  await page.getByLabel('Price', { exact: true }).fill('19.99');
  await page.getByLabel('Stock', { exact: true }).fill('20');
  await page.getByRole('button', { name: 'Create product' }).click();
  await expect(page).toHaveURL(/\/products/);
  await expect(page.getByRole('link', { name: 'E2E Product' }).first()).toBeVisible();
  await page.getByRole('link', { name: 'E2E Product' }).first().click();
  await expect(page.getByLabel('Name', { exact: true }).first()).toHaveValue('E2E Product');
});


test('product filters, sorting, bulk visibility/category, safe deletion and CSV export', async ({ page, request, context }) => {
  test.setTimeout(90000);
  await login(page);
  const { token } = await api<{ token: string }>(request, '/auth/login', { method: 'POST', data: { email: ownerEmail, password: changedPassword } });
  const category = await api<{ id: string }>(request, '/admin/products/categories', { token, method: 'POST', data: { name: 'U4 Apparel', slug: 'u4-apparel', description: 'Clothing and accessories' } });
  await api(request, '/admin/products', { token, method: 'POST', data: { name: 'U4 Empty Product', variants: [{ name: 'Standard', salePrice: 10, stock: 0 }] } });
  await page.goto('/en/products/create');
  await page.getByLabel('Name', { exact: true }).first().fill('U4 Ordered Product');
  await page.getByLabel('Category', { exact: true }).selectOption(category.id);
  await page.getByLabel('Name', { exact: true }).nth(1).fill('Standard');
  await page.getByLabel('Price', { exact: true }).fill('12');
  await page.getByLabel('Stock', { exact: true }).fill('4');
  await page.getByRole('button', { name: 'Create product', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/products$/);
  const db = getTestPrisma();
  try {
    const product = await db.product.findFirstOrThrow({ where: { name: 'U4 Ordered Product' }, include: { variants: true } });
    const user = await db.user.findUniqueOrThrow({ where: { email: ownerEmail } });
    await createOrderWithItems(user as any, [{ product }]);
    const hidden = await api<{ id: string }>(request, '/admin/products', { token, method: 'POST', data: { name: 'U4 Hidden Product', variants: [{ name: 'Standard', salePrice: 15, stock: 5 }] } });
    await api(request, '/admin/products/' + hidden.id, { token, method: 'PUT', data: { isActive: false } });
    await api(request, '/admin/products', { token, method: 'POST', data: { name: 'U4 Free Product', categoryId: category.id, variants: [{ name: 'Standard', salePrice: 22, stock: 7 }] } });
    await page.reload(); await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('button', { name: 'Category', exact: true }).click();
    await page.getByRole('menuitemradio', { name: 'U4 Apparel', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Remove filter: Category U4 Apparel', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Remove filter: Category U4 Apparel', exact: true }).click();
    await page.getByRole('button', { name: 'Price', exact: true }).click();
    await expect(page.getByRole('columnheader', { name: 'Price', exact: true })).toHaveAttribute('aria-sort', 'ascending');
    const selectPair = async () => {
      await page.getByRole('checkbox', { name: 'Select product U4 Ordered Product', exact: true }).check();
      await page.getByRole('checkbox', { name: 'Select product U4 Free Product', exact: true }).check();
    };
    const bulk = page.getByRole('region', { name: 'Bulk actions', exact: true });
    await selectPair();
    await bulk.getByRole('button', { name: 'Deactivate', exact: true }).click();
    await expect(bulk).toHaveCount(0);
    await expect(page.getByText('Processed 2 products; skipped 0.', { exact: true })).toBeVisible();
    await selectPair();
    await bulk.getByRole('button', { name: 'Activate', exact: true }).click();
    await expect(bulk).toHaveCount(0);
    await selectPair();
    await bulk.getByRole('button', { name: 'Change category', exact: true }).click();
    await page.getByRole('menuitemradio', { name: 'Uncategorized', exact: true }).click();
    await expect(bulk).toHaveCount(0);
    await selectPair();
    for (const mode of ['Light', 'Dark']) {
      await appearanceU4(page, mode);
      await bulk.getByRole('button', { name: 'Delete', exact: true }).click();
      const dialog = page.getByRole('alertdialog', { name: 'Delete 2 products?', exact: true });
      await expect(dialog.getByText(/U4 Free Product/)).toBeVisible();
      await expect(dialog.getByText(/U4 Ordered Product/)).toBeVisible();
      for (const [width, height] of [[1440, 900], [390, 844]]) {
        await page.setViewportSize({ width, height }); await captureU4(page, 'bulk-delete-' + mode.toLowerCase() + '-' + width);
      }
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await bulk.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.getByRole('alertdialog', { name: 'Delete 2 products?', exact: true }).getByRole('button', { name: 'Delete 1 products', exact: true }).click();
    await expect(page.getByText('Processed 1 products; skipped 1.', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'U4 Free Product', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'More actions for U4 Ordered Product', exact: true }).click();
    await expect(page.getByRole('menuitem', { name: /^Delete/ })).toHaveAttribute('aria-disabled', 'true');
    await page.keyboard.press('Escape');
    await page.getByRole('checkbox', { name: 'Select all products on this page', exact: true }).check();
    await page.getByRole('button', { name: /^Select all \d+ matching products$/ }).click();
    await expect(bulk.getByText(/^All \d+ products selected$/)).toBeVisible();
    await bulk.getByRole('button', { name: 'Clear selection', exact: true }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^products-\d{8}-\d{4}\.csv$/);
    const file = await download.path(); expect(file).toBeTruthy();
    expect((await readFile(file!, 'utf8')).split('\r\n')[0]).toBe('\uFEFFSPU,Product name,Product status,Category,Variant name,SKU,Sale price,Stock,Variant active,Product updated at,Time zone,Product ID,Variant ID');
    for (const mode of ['Light', 'Dark']) {
      await appearanceU4(page, mode);
      for (const [width, height] of [[1440, 900], [390, 844]]) {
        await page.setViewportSize({ width, height }); await captureU4(page, 'products-' + mode.toLowerCase() + '-' + width);
        await page.getByRole('link', { name: 'U4 Ordered Product', exact: true }).click();
        await expect(page.getByLabel('Name', { exact: true }).first()).toHaveValue('U4 Ordered Product');
        await page.getByRole('link', { name: '← Products', exact: true }).click();
      }
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.getByRole('link', { name: 'Manage categories', exact: true }).click();
      for (const [width, height] of [[1440, 900], [390, 844]]) {
        await page.setViewportSize({ width, height }); await captureU4(page, 'categories-' + mode.toLowerCase() + '-' + width);
      }
      await page.getByRole('button', { name: 'U4 Apparel', exact: true }).click();
      await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('U4 Apparel');
      for (const [width, height] of [[1440, 900], [390, 844]]) {
        await page.setViewportSize({ width, height }); await captureU4(page, 'category-dialog-' + mode.toLowerCase() + '-' + width);
      }
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      await page.getByRole('link', { name: '← Products', exact: true }).click();
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('button', { name: 'More actions for U4 Ordered Product', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Deactivate', exact: true }).click();
    await expect(page.getByText('Processed 1 products; skipped 0.', { exact: true })).toBeVisible();
    await page.getByRole('tab', { name: /^Inactive/ }).click();
    await expect(page.getByRole('link', { name: 'U4 Ordered Product', exact: true })).toBeVisible();
    const shop = await context.newPage();
    try { await shop.goto('http://127.0.0.1:3003/en/products'); await shop.getByRole('searchbox', { name: 'Search products', exact: true }).fill('U4 Ordered Product'); await shop.getByRole('button', { name: 'Search', exact: true }).click(); await expect(shop.getByRole('link', { name: /U4 Ordered Product/ })).toHaveCount(0); }
    finally { await shop.close(); }
  } finally { await disconnectDatabase(); }
});
