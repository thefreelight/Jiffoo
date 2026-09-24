import { expect, test } from '@playwright/test';
import { login, logout, originalPassword, ownerEmail } from './helpers';

test('logout and login preserve the session across reload', async ({ page }) => {
  await login(page, ownerEmail, originalPassword);
  await logout(page);
  await expect(page.getByText('Demo Credentials')).not.toBeVisible();
  await login(page, ownerEmail, originalPassword);
  await page.reload();
  await expect(page).toHaveURL(/\/en\/dashboard/);
});
