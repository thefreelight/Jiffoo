import { expect, test } from '@playwright/test';
import { originalPassword, ownerEmail } from './helpers';

test('first-run install creates the owner and opens the dashboard', async ({ page }) => {
  await page.goto('/en/install');
  await page.getByLabel('Login name').fill('e2e-owner');
  await page.getByLabel('Email').fill(ownerEmail);
  await page.getByLabel(/^Password/).fill(originalPassword);
  await page.getByLabel('Confirm password').fill(originalPassword);
  await page.getByLabel('Store name').fill('E2E Store');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page).toHaveURL(/\/en\/dashboard/);
});
