import { expect, test } from './local-requests';
import { originalPassword, ownerEmail } from './helpers';

test('first-run install creates the owner and opens the dashboard', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => { pageErrors.push(error.message); console.error(`[Admin browser error] ${error.message}`); });
  page.on('console', message => { if (message.type() === 'error') console.error(`[Admin browser console] ${message.text()}`); });
  await page.goto('/en/install');
  await page.getByLabel('Login name').fill('e2e-owner');
  await page.getByLabel('Email').fill(ownerEmail);
  await page.getByLabel(/^Password/).fill(originalPassword);
  await page.getByLabel('Confirm password').fill(originalPassword);
  await page.getByLabel('Store name').fill('E2E Store');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page).toHaveURL(/\/en\/dashboard/);
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
  expect(pageErrors).toEqual([]);
});
