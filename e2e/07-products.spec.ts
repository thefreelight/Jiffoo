import { expect, test } from './local-requests';
import { api, changedPassword, login, ownerEmail } from './helpers';
import { getTestPrisma, disconnectDatabase } from '../apps/api/tests/helpers/db';
import { createOrderWithItems } from '../apps/api/tests/helpers/fixtures';
import { captureU4, appearanceU4 } from './u4-captures';

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


test('sold product deletion offers deactivation and hides it from Shop', async ({ page, request, context }) => {
  await login(page);
  const { token } = await api<{ token: string }>(request, '/auth/login', { method: 'POST', data: { email: ownerEmail, password: changedPassword } });
  const category = await api<{ id: string }>(request, '/admin/products/categories', { token, method: 'POST', data: { name: 'U4 Apparel', slug: 'u4-apparel', description: 'Clothing and accessories' } });
  await api<{ id: string }>(request, '/admin/products', { token, method: 'POST', data: { name: 'U4 Empty Product', variants: [{ name: 'Standard', salePrice: 10, stock: 0 }] } });
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
    const hide = await request.put('http://127.0.0.1:3001/api/v1/admin/products/' + hidden.id, { headers: { authorization: 'Bearer ' + token }, data: { isActive: false } }); expect(hide.status()).toBe(200);
    await page.reload();
    if (process.platform === 'win32') {
      for (const mode of ['Light', 'Dark']) {
        await appearanceU4(page, mode);
        for (const [width, height] of [[1440, 900], [390, 844]]) {
          await page.setViewportSize({ width, height }); await captureU4(page, 'products-' + mode.toLowerCase() + '-' + width);
          await page.getByRole('link', { name: 'U4 Ordered Product', exact: true }).click();
          await expect(page.getByLabel('Name', { exact: true }).first()).toHaveValue('U4 Ordered Product');
          await captureU4(page, 'product-edit-' + mode.toLowerCase() + '-' + width);
          await page.getByRole('link', { name: '← Products', exact: true }).click();
        }
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.getByRole('main', { name: '' }).getByRole('link', { name: 'Categories', exact: true }).click(); await captureU4(page, 'categories-' + mode.toLowerCase() + '-1440');
        await page.getByRole('link', { name: '← Products', exact: true }).click();
        await page.getByRole('button', { name: 'More actions for U4 Ordered Product', exact: true }).click();
        await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
        await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
        await expect(page.getByRole('dialog').getByRole('alert')).toHaveText('This product or variant has orders and cannot be deleted. Deactivate it instead.');
        await captureU4(page, 'dialog-delete-' + mode.toLowerCase() + '-1440');
        await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
      }
    }
    await page.getByRole('button', { name: 'More actions for U4 Ordered Product', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('has orders');
    await page.getByRole('button', { name: 'Deactivate instead', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Deactivate', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('tab', { name: /^Inactive/ }).click();
    await expect(page.getByRole('link', { name: 'U4 Ordered Product', exact: true })).toBeVisible();
    await expect(page).toHaveURL(/status=inactive/);
    const shop = await context.newPage();
    try { await shop.goto('http://127.0.0.1:3003/en/products'); await shop.getByRole('searchbox', { name: 'Search products', exact: true }).fill('U4 Ordered Product'); await shop.getByRole('button', { name: 'Search', exact: true }).click(); await expect(shop.getByRole('link', { name: /U4 Ordered Product/ })).toHaveCount(0); }
    finally { await shop.close(); }
  } finally { await disconnectDatabase(); }
});
