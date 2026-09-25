import { expect, test } from './local-requests';
import { customerEmail, login } from './helpers';

test('record payment, ship a Shop checkout order, and resend its notification', async ({ page, browser }) => {
  const shopContext = await browser.newContext({ baseURL: 'http://127.0.0.1:3003' });
  const shop = await shopContext.newPage();
  try {
    await shop.goto('/en/products');
    await shop.getByRole('link', { name: /E2E Product/ }).click();
    await shop.getByRole('link', { name: 'Register', exact: true }).click();
    await shop.getByLabel('Name').fill('E2E Customer');
    await shop.getByLabel('Email').fill(customerEmail);
    await shop.getByLabel('Password', { exact: true }).fill('CustomerPassword123!');
    await shop.getByRole('button', { name: 'Create account' }).click();
    await expect(shop).toHaveURL(/\/en\/account$/);
    await shop.goto('/en/products');
    await shop.getByRole('link', { name: /E2E Product/ }).click();
    await shop.getByRole('button', { name: 'Add to cart' }).click();
    await expect(shop).toHaveURL(/\/en\/cart$/);
    await shop.getByLabel('Quantity').fill('2');
    await expect(shop.getByLabel('Quantity')).toHaveValue('2');
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
    await expect(shop.getByText('Tax (Tax added)')).toBeVisible();
    await expect(shop.getByRole('status', { name: 'Total $39.98' })).toBeVisible();
    await shop.getByRole('radio', { name: 'Manual payment' }).check();
    await shop.getByRole('button', { name: 'Place order' }).click();
    await expect(shop).toHaveURL(/\/en\/checkout\/complete\?order=/);
    await expect(shop.getByRole('heading', { name: 'Payment instructions' })).toBeVisible();
    await expect(shop.getByText('Pay manually.')).toBeVisible();
    const orderId = new URL(shop.url()).searchParams.get('order');
    expect(orderId).toBeTruthy();
    await shop.reload();
    await expect(shop.getByText('Pay manually.')).toBeVisible();

    await login(page);
    await page.goto(`/en/orders/${orderId}`);
    await page.getByRole('button', { name: 'Record Payment' }).click();
    await expect(page.getByText('PAID', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Initiate Dispatch' }).click();
    await page.getByRole('textbox', { name: 'Shipping Carrier' }).fill('E2E Carrier');
    await page.getByRole('textbox', { name: 'Tracking Number' }).fill('E2E-TRACK-001');
    await page.getByRole('button', { name: 'Confirm Shipment' }).click();
    await expect(page.getByText('SHIPPED', { exact: true }).first()).toBeVisible();
    await page.goto('/en/notifications');
    await expect(page.getByText('order confirmation')).toBeVisible();
    await expect(page.getByText('payment received')).toBeVisible();
    await expect(page.getByText('shipped', { exact: true })).toBeVisible();
    await page.getByRole('row', { name: /order confirmation.*customer@e2e.example/i }).click();
    await expect(page.getByRole('dialog', { name: 'Notification detail' })).toBeVisible();
    await page.getByRole('button', { name: 'Resend' }).click();
    await expect(page.getByText('Notification queued')).toBeVisible();
    await shop.reload();
    await expect(shop.getByText('PAID', { exact: true })).toBeVisible();
    await expect(shop.getByText('Pay manually.')).toHaveCount(0);
  } finally {
    await shopContext.close();
  }
});
