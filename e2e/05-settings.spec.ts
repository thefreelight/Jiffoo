import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('store name persists after saving settings and reloading', async ({ page }) => {
  await login(page);
  await page.goto('/en/settings');
  await page.getByRole('textbox', { name: 'Store Name' }).fill('E2E Updated Store');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Store Name' })).toHaveValue('E2E Updated Store');
});
