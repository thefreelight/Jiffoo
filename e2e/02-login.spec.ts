import { expect, test } from './local-requests';
import { login, logout, originalPassword, ownerEmail } from './helpers';

test('logout and login preserve the session across reload', async ({ page }) => {
  await login(page, ownerEmail, originalPassword);
  await logout(page);
  await login(page, ownerEmail, originalPassword);
  await page.reload();
  await expect(page).toHaveURL(/\/en\/dashboard/);
});

test('K default Admin theme requests no Outfit font files', async ({ page }) => {
  const outfitRequests: string[] = [];
  page.on('request', (request) => {
    if (/outfit.*\.woff2/i.test(request.url())) outfitRequests.push(request.url());
  });
  await login(page, ownerEmail, originalPassword);
  await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
  expect(outfitRequests).toEqual([]);
});
