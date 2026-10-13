import { expect, test } from './local-requests';
import { login, ownerEmail } from './helpers';
import { PrismaClient } from '@prisma/client';
import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
async function chooseMode(page: import('@playwright/test').Page, mode: string) {
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Appearance', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await page.getByRole('menuitemradio', { name: mode, exact: true }).click();
}
test('U1b modes and rail persist through SSR reload while mobile navigation stays keyboard accessible', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await login(page, ownerEmail, 'FinalOwnerPassword123!');
  await expect(page.getByRole('main')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
  await chooseMode(page, 'Light');
  await expect(page.getByRole('main')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await page.reload();
  await expect(page.getByRole('main')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await chooseMode(page, 'Dark');
  await expect(page.getByRole('main')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
  const toggle = page.getByRole('button', { name: 'Collapse sidebar', exact: true });
  await toggle.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Expand sidebar', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await page.reload();
  await expect(page.getByRole('complementary', { name: 'Store navigation', exact: true })).toHaveCSS('width', '56px');
  for (const name of ['Dashboard', 'Products', 'Orders', 'Notifications', 'Customers', 'Administrators', 'Plugins', 'Themes', 'Settings', 'System Health', 'Audit log', 'Tracking & custom code'])
    await expect(page.getByRole('link', { name, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Store', exact: true })).toHaveCount(0);
  await expect(page.getByRole('separator')).toHaveCount(2);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open menu', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Store navigation', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Orders', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Orders', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Store navigation', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await chooseMode(page, 'Light');
  await expect(page.getByRole('dialog', { name: 'Store navigation', exact: true })).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await page.getByRole('button', { name: 'Close menu', exact: true }).click();
  await expect(page.getByRole('main')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
});

test('U1c Orders filters, compact cards and review banner use real data in both modes', async ({ page }) => {
  const databaseUrl = process.env.DATABASE_URL_TEST;
  expect(databaseUrl).toBe('postgresql://postgres:postgres@localhost:5432/jiffoo_core_test');
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const id = 'u1c-review-' + randomUUID();
  const directory = 'C:/Users/11948/Pictures/jiffoo-u1c';
  const capture = process.env.CI !== 'true';
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /hydrat/i.test(message.text())) errors.push(message.text()); });
  try {
    await login(page, ownerEmail, 'FinalOwnerPassword123!');
    await page.goto('/en/orders');
    await expect(page.getByRole('heading', { name: 'Orders', exact: true })).toBeVisible();
    if (capture) await mkdir(directory, { recursive: true });
    for (const mode of ['Light', 'Dark']) {
      await page.setViewportSize({ width: 1440, height: 900 });
      await chooseMode(page, mode);
      for (const [width, height] of [[1440, 900], [390, 844]]) {
        await page.setViewportSize({ width, height });
        await expect(page.getByRole('link', { name: /^View order / }).first()).toBeVisible();
        const image = await page.screenshot({ ...(capture ? { path: directory + '/orders-' + mode.toLowerCase() + '-' + width + '.png' } : {}), fullPage: true, animations: 'disabled' });
        expect(image.readUInt32BE(16)).toBe(width);
      }
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
      if (capture) await page.screenshot({ path: directory + '/rail-' + mode.toLowerCase() + '-1440.png', animations: 'disabled' });
      await page.getByRole('button', { name: 'Expand sidebar', exact: true }).click();
    }
    const user = await db.user.findUniqueOrThrow({ where: { email: 'customer@e2e.example' } });
    const item = await db.orderItem.findFirstOrThrow();
    const amount = item.unitPrice.mul(3);
    const provider = await db.paymentProviderAccount.findFirstOrThrow({ where: { namespace: 'jiffoo-manual' } });
    await db.order.create({ data: { id, userId: user.id, status: 'PENDING', paymentStatus: 'PENDING', currency: 'USD', subtotalAmount: amount, totalAmount: amount,
      items: { create: { productId: item.productId, variantId: item.variantId, quantity: 3, unitPrice: item.unitPrice, lineTotal: amount, catalogSnapshot: item.catalogSnapshot! } },
      payments: { create: { paymentMethod: 'manual-payment', providerKey: provider.providerKey, amount, currency: 'USD', status: 'REQUIRES_REVIEW', idempotencyKey: randomUUID() } },
    } });
    await page.reload();
    await expect(page.getByRole('button', { name: 'Review payments', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Review payments', exact: true }).click();
    await expect(page.getByRole('combobox', { name: 'Payment', exact: true })).toHaveValue('REVIEW');
    await page.getByRole('textbox', { name: 'Search order number or customer email' }).fill(id);
    await expect(page.getByRole('link', { name: 'View order ' + id, exact: true })).toBeVisible();
    await expect(page.getByText('3 items', { exact: true }).first()).toBeVisible();
    for (const mode of ['Light', 'Dark']) {
      await page.setViewportSize({ width: 1440, height: 900 }); await chooseMode(page, mode);
      for (const [width, height] of [[1440, 900], [390, 844]]) {
        await page.setViewportSize({ width, height });
        await expect(page.getByRole('button', { name: 'Review payments', exact: true })).toBeVisible();
        const image = await page.screenshot({ ...(capture ? { path: directory + '/orders-review-' + mode.toLowerCase() + '-' + width + '.png' } : {}), fullPage: true, animations: 'disabled' });
        expect(image.readUInt32BE(16)).toBe(width);
      }
    }
    await page.getByRole('link', { name: 'View order ' + id, exact: true }).click();
    await expect(page).toHaveURL(new RegExp('/en/orders/' + id + '$'));
    expect(errors).toEqual([]);
  } finally {
    await db.payment.deleteMany({ where: { orderId: id } });
    await db.orderItem.deleteMany({ where: { orderId: id } });
    await db.order.deleteMany({ where: { id } });
    await db.$disconnect();
  }
});
