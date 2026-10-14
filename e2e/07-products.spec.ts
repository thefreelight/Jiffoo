import { expect, test } from './local-requests';
import { api, changedPassword, login, ownerEmail } from './helpers';
import { getTestPrisma, disconnectDatabase } from '../apps/api/tests/helpers/db';
import { createOrderWithItems } from '../apps/api/tests/helpers/fixtures';
import { captureU4, appearanceU4 } from './u4-captures';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { captureProductEditorStates } from './product-editor-captures';

test('create a stocked product and open its detail from the list', async ({ page }) => {
  await login(page);
  await page.goto('/en/products/create');
  await page.getByLabel('Name', { exact: true }).first().fill('E2E Product');
  await page.getByRole('textbox', { name: /^Variant name:/ }).first().fill('Standard');
  await page.getByRole('textbox', { name: /^SKU:/ }).first().fill('E2E-001');
  await page.getByRole('spinbutton', { name: /^Price:/ }).first().fill('19.99');
  await page.getByRole('spinbutton', { name: /^Stock:/ }).first().fill('20');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/\/products\/[^/]+\/edit$/);
  await page.getByRole('link', { name: '← Products', exact: true }).click();
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
  await page.getByRole('button', { name: 'Category', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'U4 Apparel', exact: true }).click();
  await page.getByRole('textbox', { name: /^Variant name:/ }).first().fill('Standard');
  await page.getByRole('spinbutton', { name: /^Price:/ }).first().fill('12');
  await page.getByRole('spinbutton', { name: /^Stock:/ }).first().fill('4');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/products\/[^/]+\/edit$/);
  await page.getByRole('link', { name: '← Products', exact: true }).click();
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

test('A5 product editor guards changes, reorders images, navigates, duplicates and saves another', async ({ page }) => {
  test.setTimeout(180000);
  await login(page);
  await page.goto('/en/products/create');
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('A5 Editor Alpha');
  await page.getByRole('button', { name: 'Category', exact: true }).press('Enter');
  await page.getByRole('menuitemradio', { name: 'U4 Apparel', exact: true }).press('Enter');
  await page.getByRole('textbox', { name: /^Variant name:/ }).first().fill('Small');
  await page.getByRole('spinbutton', { name: /^Price:/ }).first().fill('9');
  await page.getByRole('spinbutton', { name: /^Stock:/ }).first().fill('8');
  await page.getByRole('button', { name: 'Add variant', exact: true }).click();
  await page.getByRole('textbox', { name: /^Variant name:/ }).last().fill('Large');
  await page.getByRole('spinbutton', { name: /^Price:/ }).last().fill('11');
  await page.getByRole('switch', { name: 'Available: Large', exact: true }).click();
  await expect(page.getByRole('switch', { name: 'Available: Large', exact: true })).toHaveAttribute('aria-checked', 'false');
  await page.getByLabel('Upload images', { exact: true }).setInputFiles([
    { name: 'cover.png', mimeType: 'image/png', buffer: await readFile(resolve(__dirname, 'fixtures/themes/test-admin-logo.png')) },
    { name: 'second.png', mimeType: 'image/png', buffer: await readFile(resolve(__dirname, 'fixtures/themes/test-admin-background.png')) },
  ]);
  const firstImage = page.getByRole('img', { name: 'Product image 1', exact: true }), secondImage = page.getByRole('img', { name: 'Product image 2', exact: true });
  await expect(secondImage).toBeVisible();
  const first = await firstImage.getAttribute('src'), second = await secondImage.getAttribute('src'); expect(second).not.toBe(first);
  await page.getByRole('button', { name: /^Image 2 actions:/ }).click(); await page.getByRole('menuitem', { name: 'Set cover', exact: true }).click();
  await expect(firstImage).toHaveAttribute('src', second!);
  await page.getByRole('button', { name: /^Image 1 actions:/ }).click(); await page.getByRole('menuitem', { name: 'Move later', exact: true }).click();
  await expect(firstImage).toHaveAttribute('src', first!);
  await page.getByRole('button', { name: /^Image 2 actions:/ }).click(); await page.getByRole('menuitem', { name: 'Set cover', exact: true }).click();
  await page.getByRole('button', { name: 'Save and add another', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Category', exact: true })).toContainText('U4 Apparel');
  await page.getByRole('button', { name: 'Category', exact: true }).click();
  await expect(page.getByRole('menuitemradio', { name: 'U4 Apparel', exact: true })).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('A5 Editor Beta');
  await page.getByRole('spinbutton', { name: /^Price:/ }).first().fill('5');
  await page.getByRole('spinbutton', { name: /^Stock:/ }).first().fill('2');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/\/products\/[^/]+\/edit$/);
  await page.getByRole('link', { name: '← Products', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search name, SPU or SKU', exact: true }).fill('A5 Editor');
  await expect(page).toHaveURL(/search=A5/);
  await page.getByRole('button', { name: 'Products', exact: true }).click();
  await expect(page.getByRole('columnheader', { name: 'Products', exact: true })).toHaveAttribute('aria-sort', 'ascending');
  await expect(page).toHaveURL(/sortBy=name/);
  const filtered = page.url();
  await page.getByRole('link', { name: 'A5 Editor Alpha', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Previous product', exact: true })).toBeDisabled();
  const originalUrl = page.url(), originalId = new URL(originalUrl).pathname.split('/')[3];
  const originalSpu = await page.getByRole('textbox', { name: 'SPU', exact: true }).inputValue(); expect(originalSpu).toMatch(/^[A-Z0-9]{8}$/);
  await page.getByRole('link', { name: 'Next product', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('A5 Editor Beta');
  await page.getByRole('link', { name: 'Previous product', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('A5 Editor Alpha');
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('A5 unsaved name');
  await page.getByRole('link', { name: 'Orders', exact: true }).click();
  const leave = page.getByRole('alertdialog', { name: 'Save before leaving?', exact: true }); await expect(leave).toBeVisible();
  await leave.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('A5 unsaved name');
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('menuitem', { name: 'My account', exact: true }).click();
  await expect(leave).toBeVisible();
  await leave.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('A5 unsaved name');
  await page.getByRole('link', { name: 'Orders', exact: true }).click();
  await leave.getByRole('button', { name: 'Leave without saving', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/orders$/);
  await page.goto(filtered); await page.getByRole('link', { name: 'A5 Editor Alpha', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('A5 Editor Alpha');
  await page.getByRole('button', { name: 'Product status', exact: true }).click(); await page.getByRole('menuitemradio', { name: 'Inactive', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click(); await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Bulk price / stock', exact: true }).click();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole('dialog', { name: 'Bulk price / stock', exact: true })).toBeVisible();
    const screenshot = await page.screenshot({ fullPage: true, animations: 'disabled' });
    expect(screenshot.readUInt32BE(16), 'Bulk panel has no horizontal overflow at ' + width).toBe(width);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('dialog', { name: 'Bulk price / stock', exact: true }).getByRole('spinbutton', { name: 'Price (optional)', exact: true }).fill('6.25');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click(); await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'More product actions', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: /^View in store/ })).toHaveAttribute('aria-disabled', 'true');
  await page.getByRole('menuitem', { name: 'Duplicate product', exact: true }).click();
  await expect(page).toHaveURL(/\/products\/create\?duplicate=/);
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('A5 Editor Alpha');
  await expect(page.getByRole('textbox', { name: 'SPU', exact: true })).toHaveValue('');
  for (const sku of await page.getByRole('textbox', { name: /^SKU:/ }).all()) await expect(sku).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Product status', exact: true })).toContainText('Inactive');
  await page.getByRole('button', { name: 'Save', exact: true }).click(); await expect(page).toHaveURL(/\/products\/[^/]+\/edit$/);
  expect(new URL(page.url()).pathname.split('/')[3]).not.toBe(originalId);
  const copiedSpu = await page.getByRole('textbox', { name: 'SPU', exact: true }).inputValue(); expect(copiedSpu).toMatch(/^[A-Z0-9]{8}$/); expect(copiedSpu).not.toBe(originalSpu);
  await expect(page.getByRole('img', { name: 'Product image 1', exact: true })).toHaveAttribute('src', second!);
  await captureProductEditorStates(page, originalId);
});
