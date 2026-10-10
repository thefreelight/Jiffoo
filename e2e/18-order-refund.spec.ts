import { expect, test } from './local-requests';
import { login, ownerEmail } from './helpers';

test('refund before shipment restores stock and notifies the customer', async ({ page, newObservedContext }) => {
  await login(page, ownerEmail, 'FinalOwnerPassword123!');
  await page.goto('/en/products/create');
  await page.getByPlaceholder('Enter product title...').fill('Refund Flow Product');
  await page.getByPlaceholder('e.g. Red / XL').fill('Standard');
  await page.getByPlaceholder('SKU-REF').fill('E2E-REFUND-018');
  await page.getByPlaceholder('0.00').fill('18.00');
  await page.getByPlaceholder('0', { exact: true }).fill('3');
  await page.getByRole('button', { name: 'Save Product' }).click();
  await expect(page).toHaveURL(/\/en\/products$/);
  await page.getByRole('link', { name: 'Refund Flow Product' }).click();
  await expect(page.getByPlaceholder('0', { exact: true })).toHaveValue('3');
  const productUrl = page.url();

  const shopContext = await newObservedContext({ baseURL: 'http://127.0.0.1:3003' });
  const shop = await shopContext.newPage();
  try {
    await shop.goto('/en/register');
    await shop.getByLabel('Name').fill('Refund Buyer');
    await shop.getByLabel('Email').fill('refund-buyer@e2e.example');
    await shop.getByLabel('Password', { exact: true }).fill('RefundBuyerPassword123!');
    await shop.getByRole('button', { name: 'Create account' }).click();
    await expect(shop).toHaveURL(/\/en\/account$/);
    await shop.goto('/en/products');
    await shop.getByRole('searchbox', { name: 'Search products' }).fill('Refund Flow Product');
    await shop.getByRole('button', { name: 'Search', exact: true }).click();
    await shop.getByRole('link', { name: /Refund Flow Product/ }).click();
    await shop.getByRole('button', { name: 'Add to cart' }).click();
    await shop.getByRole('link', { name: 'Checkout', exact: true }).click();
    await shop.getByLabel('First name').fill('Refund');
    await shop.getByLabel('Last name').fill('Buyer');
    await shop.getByLabel('Phone').fill('+1-555-0118');
    await shop.getByLabel('Address line 1').fill('18 Refund Street');
    await shop.getByRole('textbox', { name: 'City', exact: true }).fill('San Francisco');
    await shop.getByLabel('State / province').fill('CA');
    await shop.getByLabel('Postal code').fill('94105');
    await shop.getByRole('combobox', { name: 'Country', exact: true }).selectOption({ label: 'United States' });
    await shop.getByRole('button', { name: 'Get shipping options' }).click();
    await shop.getByRole('radio', { name: /Free shipping/i }).check();
    await shop.getByRole('radio', { name: 'Manual payment' }).check();
    await shop.getByRole('button', { name: 'Place order' }).click();
    await expect(shop).toHaveURL(/\/en\/checkout\/complete\?order=/);
    const id = new URL(shop.url()).searchParams.get('order');
    expect(id).toBeTruthy();

    await page.goto(`/en/orders/${id}`);
    await page.getByLabel('Payment reference').fill('e2e-payment-reference');
    await page.getByRole('button', { name: 'Record payment' }).click();
    await expect(page.getByText('PROCESSING', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Record offline full refund' }).click();
    await page.getByLabel('Refund reference').fill('e2e-offline-refund-reference');
    await page.getByRole('button', { name: /Record refund \$18\.00/ }).click();
    await expect(page.getByText('REFUNDED', { exact: true }).first()).toBeVisible();
    await page.goto(productUrl);
    await expect(page.getByPlaceholder('0', { exact: true })).toHaveValue('3');
    await shop.goto(`/en/account/orders/${id}`);
    await expect(shop.getByText('Refunded', { exact: true })).toHaveCount(2);
    await page.goto('/en/notifications');
    await expect(page.getByRole('row', { name: /refunded.*refund-buyer@e2e.example/i })).toBeVisible();
  } finally {
    await shopContext.close();
  }
});
