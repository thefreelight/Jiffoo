import { expect, test } from './local-requests';
import { login, logout, originalPassword, ownerEmail } from './helpers';

test('logout and login preserve the session across reload', async ({ page }) => {
  await login(page, ownerEmail, originalPassword);
  await logout(page);
  await expect(page.getByText('Initial Admin Credentials')).not.toBeVisible();
  await login(page, ownerEmail, originalPassword);
  await page.reload();
  await expect(page).toHaveURL(/\/en\/dashboard/);
});
