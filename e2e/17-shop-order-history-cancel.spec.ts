import { expect, test } from './local-requests';
import { login, ownerEmail } from './helpers';

test('customer order history, detail, and cancellation are reflected in Admin', async ({ page, browser }) => {
  const shopContext = await browser.newContext({ baseURL: 'http://127.0.0.1:3003' });
  const shop = await shopContext.newPage();
  try {
    await shop.goto('/en/register');
    await shop.getByLabel('Name').fill('History Buyer');
    await shop.getByLabel('Email').fill('history-buyer@e2e.example');
    await shop.getByLabel('Password', { exact: true }).fill('HistoryBuyerPassword123!');
    await shop.getByRole('button', { name: 'Create account' }).click();
    await expect(shop).toHaveURL(/\/en\/account$/);
    await shop.goto('/en/products');
    await shop.getByRole('link', { name: /E2E Product/ }).click();
    await shop.getByRole('button', { name: 'Add to cart' }).click();
    await shop.getByRole('link', { name: 'Checkout', exact: true }).click();
    await shop.getByLabel('First name').fill('History');
    await shop.getByLabel('Last name').fill('Buyer');
    await shop.getByLabel('Phone').fill('+1-555-0117');
    await shop.getByLabel('Address line 1').fill('17 History Street');
    await shop.getByRole('textbox', { name: 'City', exact: true }).fill('San Francisco');
    await shop.getByLabel('State / province').fill('CA');
    await shop.getByLabel('Postal code').fill('94105');
    await shop.getByRole('combobox', { name: 'Country', exact: true }).selectOption({ label: 'United States' });
    await shop.getByRole('button', { name: 'Get shipping options' }).click();
    await shop.getByRole('radio', { name: /Free shipping/i }).check();
    await shop.getByRole('radio', { name: 'Manual payment' }).check();
    await shop.getByRole('button', { name: 'Place order' }).click();
    await expect(shop).toHaveURL(/\/en\/checkout\/complete\?order=/);
    const orderId = new URL(shop.url()).searchParams.get('order');
    expect(orderId).toBeTruthy();
    await shop.getByRole('link', { name: 'My orders' }).first().click();
    await expect(shop.getByRole('heading', { name: 'My orders' })).toBeVisible();
    await expect(shop.getByText('Pending', { exact: true }).first()).toBeVisible();
    await shop.getByRole('link', { name: 'View details' }).click();
    await expect(shop.getByText('Pay manually.')).toBeVisible();
    await expect(shop.getByText(/Pay before/)).toBeVisible();
    await shop.getByRole('button', { name: 'Cancel order' }).click();
    await shop.getByRole('combobox', { name: 'Reason' }).selectOption('other');
    await shop.getByRole('textbox', { name: 'Other reason' }).fill('Please cancel this test purchase');
    await shop.getByRole('button', { name: 'Confirm cancellation' }).click();
    await expect(shop.getByText('Cancelled', { exact: true })).toBeVisible();
    await expect(shop.getByRole('button', { name: 'Cancel order' })).toHaveCount(0);
    await expect(shop.getByText('Pay manually.')).toHaveCount(0);
    await login(page, ownerEmail, 'FinalOwnerPassword123!');
    await page.goto(`/en/orders/${orderId}`);
    await expect(page.getByText('Please cancel this test purchase')).toBeVisible();
  } finally {
    await shopContext.close();
  }
});
