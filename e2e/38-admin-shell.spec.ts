import { captureVisual } from './visual-capture';
import { createNumberedOrder } from '../apps/api/tests/helpers/numbered-order';
import { expect, test } from './local-requests';
import { login, ownerEmail } from './helpers';
import { PrismaClient } from '@prisma/client';
import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { captureOverview, chooseOverviewMode } from './overview-captures';
import { captureOrderDetail } from './order-detail-captures';
async function chooseMode(page: import('@playwright/test').Page, mode: string) {
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Appearance', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await page.getByRole('menuitemradio', { name: mode, exact: true }).click();
}
test('dashboard keeps document within the viewport and scrolls all content inside main', async ({ page }, testInfo) => {
  await login(page, ownerEmail, 'FinalOwnerPassword123!');
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    await page.setViewportSize({ width, height });
    const main = page.getByRole('main');
    await expect(main).toHaveCSS('position', 'relative');
    await expect(main).toHaveCSS('overflow-y', 'auto');
    await expect(main).toHaveCSS('box-sizing', 'border-box');
    const before = await main.boundingBox();
    expect(before?.y).toBe(0); expect(before?.height).toBe(height);
    const image = await page.screenshot({ fullPage: true, animations: 'disabled' });
    expect(image.readUInt32BE(20), 'Document must not have a second vertical scroll range').toBe(height);
    await main.focus(); await page.keyboard.press('Control+End');
    const recent = await page.getByRole('heading', { name: 'Recent orders', exact: true }).boundingBox();
    expect(recent!.y).toBeGreaterThanOrEqual(0); expect(recent!.y + recent!.height).toBeLessThanOrEqual(height);
    expect(await main.boundingBox()).toEqual(before);
    await testInfo.attach('dashboard-scroll-' + width, { body: JSON.stringify({ viewport: { width, height }, main: before, recent, documentHeight: image.readUInt32BE(20) }), contentType: 'application/json' });
  }
});
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
  for (const name of ['Overview', 'Products', 'Orders', 'Notifications', 'Customers', 'Administrators', 'Plugins', 'Themes', 'Settings', 'System Health', 'Audit records', 'Tracking & custom code'])
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

test('U2 Overview shows real attention counts and opens the Orders review deep link', async ({ page }) => {
  expect(process.env.DATABASE_URL_TEST).toBe('postgresql://postgres:postgres@localhost:5432/jiffoo_core_test');
  const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL_TEST } } });
  const ids = ['u2-review-' + randomUUID(), 'u2-to-ship-' + randomUUID()];
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    const user = await db.user.findUniqueOrThrow({ where: { email: 'customer@e2e.example' } });
    const item = await db.orderItem.findFirstOrThrow();
    const provider = await db.paymentProviderAccount.findFirstOrThrow({ where: { namespace: 'jiffoo-manual' } });
    const amount = item.unitPrice.mul(3);
    for (const [index, id] of ids.entries()) await createNumberedOrder(db, { data: {
      id, userId: user.id, status: index === 0 ? 'PENDING' : 'PROCESSING', paymentStatus: index === 0 ? 'PENDING' : 'PAID',
      currency: 'USD', subtotalAmount: amount, totalAmount: amount,
      items: { create: { productId: item.productId, variantId: item.variantId, quantity: 3, unitPrice: item.unitPrice, lineTotal: amount, catalogSnapshot: item.catalogSnapshot! } },
      ...(index === 0 ? { payments: { create: { paymentMethod: 'manual-payment', providerKey: provider.providerKey, amount, currency: 'USD', status: 'REQUIRES_REVIEW', idempotencyKey: randomUUID() } } } : {}),
    } });
    const count = await db.order.count({ where: { payments: { some: { status: 'REQUIRES_REVIEW', reviewResolution: null } } } });
    const toShip = await db.order.count({ where: { status: 'PROCESSING', paymentStatus: 'PAID' } });
    await login(page, ownerEmail, 'FinalOwnerPassword123!');
    // The existing dashboard cache expires after 15 seconds; reload rather than mutate it.
    await expect(async () => {
      await page.goto('/en/dashboard');
      await expect(page.getByText(count + ' orders have payments that need manual review', { exact: true })).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 20000 });
    await expect(page.getByText(toShip + ' paid orders are waiting to ship', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Orders', exact: true }).getByLabel(count + ' payments awaiting review', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Orders', exact: true }).getByRole('img', { name: count + ' payments awaiting review', exact: true })).toHaveCSS('width', '6px');
    await page.getByRole('button', { name: 'Expand sidebar', exact: true }).click();
    await expect(page.getByRole('table', { name: 'Sales, last 14 days', exact: true }).getByRole('row')).toHaveCount(15);
    await captureOverview(page);
    await page.getByRole('link', { name: 'Review payments', exact: true }).click();
    await expect(page).toHaveURL(/\/en\/orders\?payment=review$/);
    await expect(page.getByRole('button', { name: 'Payment', exact: true })).toContainText('Requires review');
    await expect(page.getByRole('link', { name: 'View order ' + (await db.order.findUniqueOrThrow({ where: { id: ids[0] } })).orderNumber, exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'View order ' + (await db.order.findUniqueOrThrow({ where: { id: ids[1] } })).orderNumber, exact: true })).toHaveCount(0);
    if (process.env.VISUAL_SET) for (const mode of ['Light', 'Dark']) {
      await chooseOverviewMode(page, mode);
      await page.getByRole('heading', { name: 'Orders', exact: true }).click(); await page.keyboard.press('Control+Home');
      await captureVisual(page, { path: 'e2e/visual-results/' + process.env.VISUAL_SET + '/admin-shell/orders-deeplink-' + mode.toLowerCase() + '-1440.png', animations: 'disabled' });
    }
    await page.goto('/en/dashboard');
    await page.getByRole('link', { name: 'View orders', exact: true }).click();
    await expect(page).toHaveURL(/\/en\/orders\?status=PROCESSING&payment=paid$/);
    await expect(page.getByRole('button', { name: 'Payment', exact: true })).toContainText('Paid');
    await expect(page.getByRole('tab', { name: /^Processing/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('link', { name: 'View order ' + (await db.order.findUniqueOrThrow({ where: { id: ids[1] } })).orderNumber, exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await db.payment.deleteMany({ where: { orderId: { in: ids } } });
    await db.orderItem.deleteMany({ where: { orderId: { in: ids } } });
    await db.order.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  }
});

test('A4 every sidebar group navigates and the account menu opens profile and logs out', async ({ page }) => {
  await login(page, ownerEmail, 'FinalOwnerPassword123!');
  await page.setViewportSize({ width: 1440, height: 900 });
  const navigation = page.getByRole('navigation', { name: 'Store navigation', exact: true });
  expect((await navigation.boundingBox())!.width, 'Navigation fills the shared sidebar').toBeGreaterThan(215);
  for (const group of ['Store', 'Appearance & extensions', 'Management']) {
    const trigger = navigation.getByRole('button', { name: group, exact: true });
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await trigger.click(); await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await trigger.click();
  }
  for (const [name, path] of [
    ['Orders', '/orders'], ['Products', '/products'], ['Categories', '/products/categories'], ['Customers', '/customers'], ['Notifications', '/notifications'],
    ['Themes', '/themes'], ['Plugins', '/plugins'], ['Tracking & custom code', '/storefront-code'],
    ['Administrators', '/staff'], ['Audit records', '/audit-events'], ['Settings', '/settings'], ['System Health', '/system/health'], ['Overview', '/dashboard'],
  ]) {
    await navigation.getByRole('link', { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp('/en' + path + '(?:\\?.*)?$'));
  }
  for (const name of ['Needs attention', 'Today', 'Sales, last 14 days', 'Recent orders']) await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  const notice = (await page.getByRole('alert', { name: 'Test signing mode', exact: true }).boundingBox())!;
  const heading = (await page.getByRole('heading', { name: 'Overview', exact: true }).boundingBox())!;
  expect(heading.y - notice.y - notice.height, 'The notice leaves exactly 24px before page content').toBe(24);
  await expect(page.getByRole('img', { name: 'Daily paid sales over the last 14 days', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  for (const name of ['My account', 'Appearance', 'Interface language', 'Log out']) await expect(page.getByRole('menuitem', { name, exact: true })).toBeVisible();
  await page.getByRole('menuitem', { name: 'My account', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/profile$/);
  await chooseMode(page, 'System');
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Log out', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/auth\/login$/);
});

test('U1c Orders filters, compact cards and review banner use real data in both modes', async ({ page }) => {
  const databaseUrl = process.env.DATABASE_URL_TEST;
  expect(databaseUrl).toBe('postgresql://postgres:postgres@localhost:5432/jiffoo_core_test');
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const id = 'u1c-review-' + randomUUID();
  const directory = 'e2e/visual-results/' + process.env.VISUAL_SET + '/admin-shell';
  const capture = Boolean(process.env.VISUAL_SET);
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
        const image = await captureVisual(page, { ...(capture ? { path: directory + '/orders-' + mode.toLowerCase() + '-' + width + '.png' } : {}), fullPage: true, animations: 'disabled' });
        expect(image.readUInt32BE(16)).toBe(width);
      }
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
      if (capture) await captureVisual(page, { path: directory + '/rail-' + mode.toLowerCase() + '-1440.png', animations: 'disabled' });
      await page.getByRole('button', { name: 'Expand sidebar', exact: true }).click();
    }
    const user = await db.user.findUniqueOrThrow({ where: { email: 'customer@e2e.example' } });
    const item = await db.orderItem.findFirstOrThrow();
    const amount = item.unitPrice.mul(3);
    const provider = await db.paymentProviderAccount.findFirstOrThrow({ where: { namespace: 'jiffoo-manual' } });
    await createNumberedOrder(db, { data: { id, userId: user.id, status: 'PENDING', paymentStatus: 'PENDING', currency: 'USD', subtotalAmount: amount, totalAmount: amount,
      items: { create: { productId: item.productId, variantId: item.variantId, quantity: 3, unitPrice: item.unitPrice, lineTotal: amount, catalogSnapshot: item.catalogSnapshot! } },
      payments: { create: { paymentMethod: 'manual-payment', providerKey: provider.providerKey, amount, currency: 'USD', status: 'REQUIRES_REVIEW', idempotencyKey: randomUUID() } },
    } });
    await page.reload();
    await expect(page.getByRole('button', { name: 'Review payments', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Review payments', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Payment', exact: true })).toContainText('Requires review');
    await page.getByRole('textbox', { name: 'Search order number or customer email' }).fill(id);
    await expect(page.getByRole('link', { name: 'View order ' + (await db.order.findUniqueOrThrow({ where: { id: id } })).orderNumber, exact: true })).toBeVisible();
    await expect(page.getByText('3 items', { exact: true }).first()).toBeVisible();
    await page.getByRole('checkbox', { name: 'Select all orders on this page', exact: true }).check();
    await page.getByRole('button', { name: 'Select all 1 matching orders', exact: true }).click();
    for (const mode of ['Light', 'Dark']) {
      await page.setViewportSize({ width: 1440, height: 900 }); await chooseMode(page, mode);
      for (const [width, height] of [[1440, 900], [390, 844]]) {
        await page.setViewportSize({ width, height });
        await expect(page.getByRole('button', { name: 'Review payments', exact: true })).toBeVisible();
        const image = await captureVisual(page, { ...(capture ? { path: directory + '/orders-review-' + mode.toLowerCase() + '-' + width + '.png' } : {}), fullPage: true, animations: 'disabled' });
        expect(image.readUInt32BE(16)).toBe(width);
      }
    }
    await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
    await page.getByRole('link', { name: 'View order ' + (await db.order.findUniqueOrThrow({ where: { id: id } })).orderNumber, exact: true }).click();
    await expect(page).toHaveURL(new RegExp('/en/orders/' + id + '$'));
    await expect(page.getByRole('heading', { name: /^Order [A-Z]{2,6}-[0-9]{8}-[0-9]{4,}$/ })).toBeVisible();
    test.setTimeout(120000);
    await captureOrderDetail(page, 'review');
    await page.getByRole('button', { name: 'Confirm not charged and close', exact: true }).click();
    const review = page.getByRole('dialog', { name: 'Confirm not charged and close', exact: true });
    await review.getByRole('textbox', { name: 'Evidence reference', exact: true }).fill('u3-not-charged-' + id);
    await review.getByRole('button', { name: 'Confirm not charged and close', exact: true }).click();
    await expect(review).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Confirm payment received', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'More order actions', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Cancel order', exact: true }).click();
    const cancel = page.getByRole('dialog', { name: 'Cancel order', exact: true });
    await cancel.getByRole('textbox', { name: 'Cancellation reason', exact: true }).fill('U3 confirmed not charged');
    await cancel.getByRole('button', { name: 'Cancel order', exact: true }).click();
    await expect(cancel).toHaveCount(0);
    await expect(page.getByText('Cancelled', { exact: true }).first()).toBeVisible();
    await captureOrderDetail(page, 'cancelled');
    expect(errors).toEqual([]);
  } finally {
    const payments = await db.payment.findMany({ where: { orderId: id }, select: { id: true } });
    await db.adminAuditEvent.deleteMany({ where: { targetId: { in: payments.map(payment => payment.id) } } });
    await db.notification.deleteMany({ where: { relatedId: id } });
    await db.eventDelivery.deleteMany({ where: { event: { aggregateId: id } } });
    await db.eventRecord.deleteMany({ where: { aggregateId: id } });
    await db.payment.deleteMany({ where: { orderId: id } });
    await db.orderItem.deleteMany({ where: { orderId: id } });
    await db.order.deleteMany({ where: { id } });
    await db.$disconnect();
  }
});
