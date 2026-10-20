import { expect, test } from './local-requests';
import { captureS4State } from './s4-captures';
import { customerEmail, login, shopAccountAction } from './helpers';
import { captureOrderDetail } from './order-detail-captures';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { getTestPrisma, disconnectDatabase } from '../apps/api/tests/helpers/db';

test('record payment, ship a Shop checkout order, and resend its notification', async ({ page, newObservedContext }) => {
  test.setTimeout(120000);
  await page.context().grantPermissions(['clipboard-write']);
  const shopContext = await newObservedContext({ baseURL: 'http://127.0.0.1:3003' });
  const shop = await shopContext.newPage();
  try {
    await shop.goto('/en/products');
    await shop.getByRole('link', { name: /E2E Product/ }).click();
    await shopAccountAction(shop, 'en', 'register');
    await shop.getByLabel('Username').fill('E2E Customer');
    await shop.getByLabel('Email').fill(customerEmail);
    await shop.getByLabel('Password', { exact: true }).fill('CustomerPassword123!');
    await shop.getByRole('button', { name: 'Create account' }).click();
    await expect(shop).toHaveURL(/\/en\/account$/);
    await shop.goto('/en/products');
    await shop.getByRole('link', { name: /E2E Product/ }).click();
    await shop.getByRole('button', { name: 'Add to cart' }).click();
    await shop.getByRole('dialog', { name: /^Cart/ }).getByRole('link', { name: 'View cart', exact: true }).click();
    await expect(shop).toHaveURL(/\/en\/cart$/);
    await shop.getByRole('spinbutton', { name: 'Quantity E2E Product', exact: true }).fill('2');
    await expect(shop.getByRole('spinbutton', { name: 'Quantity E2E Product', exact: true })).toHaveValue('2');
    await shop.getByRole('link', { name: 'Checkout', exact: true }).click();
    await expect(shop).toHaveURL(/\/en\/checkout$/);
    await shop.getByLabel('First name').fill('E2E');
    await shop.getByLabel('Last name').fill('Customer');
    await shop.getByLabel('Phone').fill('+1-555-0102');
    await shop.getByLabel('Address line 1').fill('1 Test Street');
    await shop.getByRole('textbox', { name: 'City', exact: true }).fill('San Francisco');
    await shop.getByLabel('State / province').fill('CA');
    await shop.getByLabel('Postal code').fill('94105');
    await shop.getByRole('combobox', { name: 'Country', exact: true }).selectOption({ label: 'United States' });
    await shop.getByRole('button', { name: 'Get shipping options' }).click();
    await shop.getByRole('radio', { name: /Free shipping/i }).check();
    await expect(shop.getByText('Tax (Tax added)', { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(shop.getByRole('status', { name: 'Total $39.98' })).toBeVisible();
    await shop.getByRole('radio', { name: 'Manual payment' }).check();
    await shop.getByRole('button', { name: /^Pay /, exact: false }).click();
    await expect(shop).toHaveURL(/\/en\/checkout\/complete\?order=/);
    await expect(shop.getByRole('heading', { name: 'Payment instructions' })).toBeVisible();
    await expect(shop.getByText('Pay manually.')).toBeVisible();
    await captureS4State(shop, 'checkout-pending');
    const orderNumber = (await shop.getByText(/^[A-Z]{2,6}-[0-9]{8}-[0-9]{4,}$/, { exact: true }).textContent())!;
    expect(orderNumber).toMatch(/^JF-[0-9]{8}-[0-9]{4,}$/);
    const orderId = new URL(shop.url()).searchParams.get('order');
    expect(orderId).toBeTruthy();
    await shop.reload();
    await expect(shop.getByText('Pay manually.')).toBeVisible();

    await login(page);
    await page.goto('/en/orders');
    await page.getByRole('textbox', { name: 'Search order number or customer email' }).fill(orderNumber);
    await expect(page.getByRole('link', { name: 'View order ' + orderNumber, exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Payment', exact: true }).click();
    await page.getByRole('menuitemradio', { name: 'Unpaid', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Remove filter: Payment Unpaid', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Remove filter: Payment Unpaid', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Payment', exact: true })).toContainText('All');
    await page.getByRole('button', { name: 'Amount', exact: true }).click();
    await expect(page.getByRole('columnheader', { name: 'Amount', exact: true })).toHaveAttribute('aria-sort', 'ascending');
    await page.getByRole('button', { name: 'Rows per page', exact: true }).click();
    await page.getByRole('menuitemradio', { name: '50', exact: true }).click();
    await expect(page).toHaveURL(/pageSize=50/);
    await page.getByRole('checkbox', { name: 'Select order ' + orderNumber, exact: true }).check();
    await expect(page.getByRole('region', { name: 'Bulk actions', exact: true })).toBeVisible();
    await expect(page.getByText('Selected 1 orders on this page.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Select all 1 matching orders', exact: true }).click();
    await expect(page.getByText('Selected all 1 matching orders.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Only this page', exact: true }).click();
    await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    const download = await downloadPromise, file = await download.path();
    expect(file).toBeTruthy();
    const exported = await readFile(file!, 'utf8');
    expect(exported.split('\r\n')[0]).toBe('\uFEFFOrder number,Placed at,Time zone,Status,Payment status,Payment review pending,Customer email,Customer name,Item count,Item quantity,Subtotal,Shipping,Tax,Tax inclusive,Total,Currency,Payment method,Recipient name,Phone,Address line 1,Address line 2,City,State / province,Postal code,Country,Carrier,Tracking number,Shipped at');
    expect(exported).toContain(orderNumber);
    const listUrl = page.url();
    await page.getByRole('link', { name: 'View order ' + orderNumber, exact: true }).click();
    await page.getByRole('link', { name: '← Orders', exact: true }).click();
    await expect(page).toHaveURL(listUrl);
    await page.goto('/en/settings');
    await page.getByRole('textbox', { name: 'Order number prefix', exact: true }).fill('SHOP');
    const prefixSaved = page.waitForResponse(response => response.url().endsWith('/admin/settings/batch') && response.request().method() === 'PUT');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    expect((await prefixSaved).ok()).toBe(true);
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
    const db = getTestPrisma();
    let companionId: string, companionNumber: string;
    try {
      const product = await db.product.findFirstOrThrow({ where: { name: 'E2E Product' }, include: { variants: true } });
      const created = await shop.request.post('/bff/orders', { headers: { origin: 'http://127.0.0.1:3003' }, data: {
        items: [{ productId: product.id, variantId: product.variants[0].id, quantity: 1 }],
        shippingAddress: { firstName: 'E2E', lastName: 'Customer', phone: '+1-555-0102', addressLine1: '1 Test Street', city: 'San Francisco', state: 'CA', postalCode: '94105', country: 'US' },
        shippingOptionId: 'free-shipping:free', paymentMethod: 'manual-payment', expectedTotal: product.variants[0].salePrice.toFixed(2),
        idempotencyKey: randomUUID(),
      } });
      expect(created.status(), await created.text()).toBe(201);
      const companion = (await created.json()).data;
      companionId = companion.id;
      companionNumber = companion.orderNumber;
      expect(companionNumber).toMatch(/^SHOP-[0-9]{8}-[0-9]{4,}$/);
      expect((await db.order.findUniqueOrThrow({ where: { id: orderId! } })).orderNumber).toBe(orderNumber);
    } finally { await disconnectDatabase(); }
    await page.getByRole('textbox', { name: 'Order number prefix', exact: true }).fill('JF');
    const prefixRestored = page.waitForResponse(response => response.url().endsWith('/admin/settings/batch') && response.request().method() === 'PUT');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    expect((await prefixRestored).ok()).toBe(true);
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
    await page.goto(listUrl);
    await page.getByRole('textbox', { name: 'Search order number or customer email', exact: true }).fill(customerEmail);
    await expect(page.getByRole('link', { name: 'View order ' + companionNumber!, exact: true })).toBeVisible();
    const filteredUrl = page.url();
    await page.getByRole('link', { name: 'View order ' + orderNumber, exact: true }).click();
    await expect(page.getByRole('button', { name: 'Next order', exact: true })).toBeDisabled();
    await page.getByRole('link', { name: 'Previous order', exact: true }).click();
    await expect(page).toHaveURL(new RegExp('/en/orders/' + companionId! + '\\?'));
    await expect(page.getByRole('button', { name: 'Previous order', exact: true })).toBeDisabled();
    await page.getByRole('link', { name: 'Next order', exact: true }).click();
    await expect(page).toHaveURL(new RegExp('/en/orders/' + orderId + '\\?'));
    await page.getByRole('link', { name: '← Orders', exact: true }).click();
    await expect(page).toHaveURL(filteredUrl);
    const cancelled = await shop.request.post(`/bff/orders/${companionId!}/cancel`, { headers: { origin: 'http://127.0.0.1:3003' }, data: { cancelReason: 'E2E companion cleanup' } });
    expect(cancelled.ok(), await cancelled.text()).toBe(true);
    expect((await cancelled.json()).data.orderNumber).toBe(companionNumber!);
    const cleanup = getTestPrisma();
    try {
      await cleanup.notification.deleteMany({ where: { relatedType: 'order', relatedId: companionId! } });
      await cleanup.order.delete({ where: { id: companionId! } });
    }
    finally { await disconnectDatabase(); }
    await page.goto(`/en/orders/${orderId}`);
    await page.getByRole('button', { name: 'Copy order number', exact: true }).click();
    await expect(page.getByText(new RegExp('^Order\\s*' + orderNumber + '\\s*Copied$')).getByText('Copied', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'View all orders from this customer', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Remove filter: Customer ' + customerEmail, exact: true })).toBeVisible();
    await expect(page).toHaveURL(/customerId=/);
    await page.getByRole('button', { name: 'Remove filter: Customer ' + customerEmail, exact: true }).click();
    await expect(page).not.toHaveURL(/customerId=/);
    await page.goto(`/en/orders/${orderId}`);
    await page.getByRole('button', { name: 'More order actions', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Record payment', exact: true }).click();
    await page.getByLabel('Payment reference').fill(`e2e-payment-${orderId}`);
    await page.getByRole('button', { name: 'Record payment' }).click();
    await expect(page.getByText('Paid', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('1 Test Street', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Copy shipping address including recipient and phone', exact: true }).click();
    await expect(page.getByLabel('Customer and shipping address', { exact: true }).getByText('Copied', { exact: true })).toBeVisible();
    await captureOrderDetail(page, 'processing');
    await page.getByRole('heading', { name: 'Order history', exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: 'Copy order number', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ship order', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Ship order' }).click();
    await page.getByRole('textbox', { name: 'Carrier' }).fill('E2E Carrier');
    await page.getByRole('textbox', { name: 'Tracking number' }).fill('E2E-TRACK-001');
    await page.getByRole('button', { name: 'Ship order' }).click();
    await expect(page.getByText('Shipped', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Copy tracking number', exact: true }).click();
    await expect(page.getByLabel('Shipping', { exact: true }).getByText('Copied', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Track shipment (opens in 17TRACK)', exact: true })).toHaveAttribute('href', 'https://t.17track.net/en#nums=E2E-TRACK-001');
    await captureOrderDetail(page, 'shipped');
    if (process.env.VISUAL_SET) {
      const shipment = await shopContext.newPage();
      try {
        await shipment.goto(`/en/account/orders/${orderId}`);
        await expect(shipment.getByText('Shipped', { exact: true })).toBeVisible();
        await expect(shipment.getByText('E2E-TRACK-001', { exact: true })).toBeVisible();
        await captureS4State(shipment, 'order-shipped');
      } finally { await shipment.close(); }
    }
    await page.getByRole('button', { name: 'Mark as delivered' }).click();
    await expect(page.getByText('Delivered', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Delivered', { exact: true }).first()).toHaveCSS('flex-shrink', '0');
    await page.goto('/en/notifications');
    await expect(page.getByText('Order confirmation', { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText('Payment received', { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText('Order shipped', { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await page.getByRole('row', { name: /order confirmation.*customer@e2e.example/i }).click();
    await expect(page.getByRole('dialog', { name: 'Order confirmation', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Resend' }).click();
    await expect(page.getByText('Email queued', { exact: true })).toBeVisible();
    await expect(shop.getByRole('heading', { name: 'Order placed, payment successful', exact: true })).toBeVisible();
    await captureS4State(shop, 'checkout-paid');
    await expect(shop.getByText('Pay manually.')).toHaveCount(0);
    await shop.getByRole('link', { name: 'View order' }).click();
    await expect(shop.getByRole('heading', { name: 'Order details' })).toBeVisible();
    await expect(shop.getByText('Delivered', { exact: true })).toBeVisible();
    await expect(shop.getByText('Paid', { exact: true })).toBeVisible();
    await expect(shop.getByText('E2E-TRACK-001')).toBeVisible();
    await captureS4State(shop, 'order-shipment');
  } finally {
    await shopContext.close();
  }
});
