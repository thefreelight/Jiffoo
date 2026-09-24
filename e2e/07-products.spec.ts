import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('create a stocked product and open its detail from the list', async ({ page }) => {
  await login(page);
  await page.goto('/en/products/create');
  await page.getByPlaceholder('Enter product title...').fill('E2E Product');
  await page.getByPlaceholder('e.g. Red / XL').fill('Standard');
  await page.getByPlaceholder('SKU-REF').fill('E2E-001');
  await page.getByPlaceholder('0.00').fill('19.99');
  await page.getByPlaceholder('0', { exact: true }).fill('20');
  await page.getByRole('button', { name: 'Save Product' }).click();
  await expect(page).toHaveURL(/\/products/);
  await expect(page.getByRole('link', { name: 'E2E Product' }).first()).toBeVisible();
  await page.getByRole('link', { name: 'E2E Product' }).first().click();
  await expect(page.getByPlaceholder('Enter product title...')).toHaveValue('E2E Product');
});
