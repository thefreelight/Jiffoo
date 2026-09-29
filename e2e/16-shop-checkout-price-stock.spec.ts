import { expect, test } from './local-requests';
import { login, ownerEmail } from './helpers';

test('stock limit and changed price require a fresh checkout confirmation', async ({ page, newObservedContext }) => {
  await login(page, ownerEmail, 'FinalOwnerPassword123!');
  await page.goto('/en/products/create');
  await page.getByPlaceholder('Enter product title...').fill('Price Change Product');
  await page.getByPlaceholder('e.g. Red / XL').fill('Standard');
  await page.getByPlaceholder('SKU-REF').fill('E2E-PRICE-001');
  await page.getByPlaceholder('0.00').fill('10.00');
  await page.getByPlaceholder('0', { exact: true }).fill('6');
  await page.getByRole('button', { name: 'Save Product' }).click();
  await expect(page).toHaveURL(/\/en\/products$/);
  await page.getByRole('link', { name: 'Price Change Product' }).click();
  await expect(page.getByPlaceholder('Enter product title...')).toHaveValue('Price Change Product');

  const shopContext = await newObservedContext({ baseURL: 'http://127.0.0.1:3003' });
  const shop = await shopContext.newPage();
  try {
    await shop.goto('/en/register');
    await shop.getByLabel('Name').fill('Price Buyer');
    await shop.getByLabel('Email').fill('price-change@e2e.example');
    await shop.getByLabel('Password', { exact: true }).fill('PriceBuyerPassword123!');
    await shop.getByRole('button', { name: 'Create account' }).click();
    await expect(shop).toHaveURL(/\/en\/account$/);
    await shop.goto('/en/products');
    await shop.getByRole('searchbox', { name: 'Search products' }).fill('Price Change Product');
    await shop.getByRole('button', { name: 'Search', exact: true }).click();
    await shop.getByRole('link', { name: /Price Change Product/ }).click();

    await page.getByPlaceholder('0', { exact: true }).fill('2');
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByRole('button', { name: 'Updated', exact: true })).toBeVisible();
    await expect(page.getByText('Product updated successfully', { exact: true })).toHaveCount(1);
    await shop.getByLabel('Quantity').fill('3');
    await shop.getByRole('button', { name: 'Add to cart' }).click();
    await expect(shop.getByText('Available quantity: 2', { exact: true })).toHaveText('Available quantity: 2');
    await shop.getByLabel('Quantity').fill('1');
    await shop.getByRole('button', { name: 'Add to cart' }).click();
    await expect(shop).toHaveURL(/\/en\/cart$/);
    await shop.getByRole('link', { name: 'Checkout', exact: true }).click();
    await shop.getByLabel('First name').fill('Price');
    await shop.getByLabel('Last name').fill('Buyer');
    await shop.getByLabel('Phone').fill('+1-555-0199');
    await shop.getByLabel('Address line 1').fill('2 Price Road');
    await shop.getByRole('textbox', { name: 'City', exact: true }).fill('San Francisco');
    await shop.getByLabel('State / province').fill('CA');
    await shop.getByLabel('Postal code').fill('94105');
    await shop.getByRole('combobox', { name: 'Country', exact: true }).selectOption({ label: 'United States' });
    await shop.getByRole('button', { name: 'Get shipping options' }).click();
    await shop.getByRole('radio', { name: /Free shipping/i }).check();
    await expect(shop.getByRole('status', { name: 'Total $10.00' })).toBeVisible();
    await expect(shop.getByText('Tax (Tax added)')).toBeVisible();
    await shop.getByRole('radio', { name: 'Manual payment' }).check();

    await page.getByPlaceholder('0.00').fill('15.00');
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByRole('button', { name: 'Updated', exact: true })).toBeVisible();
    await expect(page.getByText('Product updated successfully', { exact: true })).toHaveCount(1);
    await shop.getByRole('button', { name: 'Place order' }).click();
    await expect(shop.getByText('Price changed. Review the new total and confirm again.', { exact: true })).toHaveText('Price changed. Review the new total and confirm again.');
    await expect(shop.getByRole('status', { name: 'Total $15.00' })).toBeVisible();
    await shop.getByRole('button', { name: 'Place order' }).click();
    await expect(shop).toHaveURL(/\/en\/checkout\/complete\?order=/);
    await expect(shop.getByRole('heading', { name: 'Order confirmation' })).toBeVisible();
    await expect(shop.getByText('Pay manually.')).toBeVisible();
  } finally {
    await shopContext.close();
  }
});
