import { expect, test } from './local-requests';
import { login, ownerEmail } from './helpers';
import { adminThemePackage } from './theme-package';

test('P activates an Admin theme with local assets and restores the default immediately', async ({ page, newObservedContext }) => {
  await login(page, ownerEmail, 'FinalOwnerPassword123!');
  await page.getByRole('link', { name: 'Themes' }).click();
  await page.getByRole('tab', { name: 'Admin' }).click();
  await expect(page.getByRole('heading', { name: 'Default Admin' })).toBeVisible();
  await page.getByLabel('Theme package', { exact: true }).setInputFiles({
    name: 'e2e-admin-theme.zip', mimeType: 'application/zip', buffer: await adminThemePackage(),
  });
  await page.getByLabel('I trust this unsigned theme package').check();
  await page.getByRole('button', { name: 'Upload theme' }).click();
  const row = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'E2E Admin Theme' }) });
  await expect(row.getByRole('button', { name: 'Activate' })).toBeVisible();
  const fonts: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/fonts/outfit.woff2')) fonts.push(request.url());
  });
  await row.getByRole('button', { name: 'Activate' }).click();
  await expect(row.getByText('Active')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Upload theme' })).toHaveCSS('background-color', 'rgb(204, 0, 51)');
  await expect(page.getByRole('img', { name: 'Store Console logo' }))
    .toHaveAttribute('src', /\/api\/v1\/themes\/e2e-admin-theme\/1\.0\.0\/assets\/logo\.png/);
  await expect(page.getByRole('main').last()).toHaveCSS('font-family', /E2E Outfit/);
  expect(fonts.some((url) => url.includes('/api/v1/themes/e2e-admin-theme/1.0.0/fonts/outfit.woff2'))).toBe(true);

  const fresh = await newObservedContext();
  const loginPage = await fresh.newPage();
  await loginPage.goto('http://127.0.0.1:3002/en/auth/login');
  await expect(loginPage.getByRole('main')).toHaveCSS('background-image',
    /\/api\/v1\/themes\/e2e-admin-theme\/1\.0\.0\/assets\/login\.png/);
  await fresh.close();

  await page.getByRole('button', { name: 'Restore previous theme' }).click();
  await expect(page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Default Admin' }) })
    .getByText('Active')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Upload theme' })).toHaveCSS('background-color', 'rgb(37, 99, 235)');
  await row.getByRole('button', { name: 'Uninstall' }).click();
  await expect(page.getByRole('heading', { name: 'E2E Admin Theme' })).toHaveCount(0);
});
