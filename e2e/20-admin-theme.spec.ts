import { captureReview, expect, test } from './review-capture';
import { login, ownerEmail } from './helpers';
import { adminThemePackage } from './theme-package';
import { createHash } from 'node:crypto';

test('P activates an Admin theme with local assets and restores the default immediately', async ({ page, newObservedContext }) => {
  const bytes = await adminThemePackage();
  const packageHash = createHash('sha256').update(bytes).digest('hex');
  await login(page, ownerEmail, 'FinalOwnerPassword123!');
  await page.getByRole('link', { name: 'Themes' }).click();
  await page.getByRole('tab', { name: 'Admin' }).click();
  await expect(page.getByRole('heading', { name: 'Default Admin' })).toBeVisible();
  await page.getByLabel('Theme package', { exact: true }).setInputFiles({
    name: 'e2e-admin-theme.zip', mimeType: 'application/zip', buffer: bytes,
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
    .toHaveAttribute('src', `/api/v1/themes/e2e-admin-theme/${packageHash}/assets/logo.png`);
  await expect(page.getByRole('main').last()).toHaveCSS('font-family', /E2E Outfit/);
  expect(fonts).toContain(`http://127.0.0.1:3002/api/v1/themes/e2e-admin-theme/${packageHash}/fonts/outfit.woff2`);
  await captureReview(page, 'theme-package-review', 'admin-active-hash-en', { width: 1440, height: 900 });

  const fresh = await newObservedContext();
  const loginPage = await fresh.newPage();
  await loginPage.goto('http://127.0.0.1:3002/en/auth/login');
  await expect(loginPage.getByRole('main')).toHaveCSS('background-image',
    `url("http://127.0.0.1:3002/api/v1/themes/e2e-admin-theme/${packageHash}/assets/login.png")`);
  await fresh.close();

  await page.getByRole('button', { name: 'Restore previous theme' }).click();
  await expect(page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Default Admin' }) })
    .getByText('Active')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Upload theme' })).toHaveCSS('background-color', 'rgb(37, 99, 235)');
  await row.getByRole('button', { name: 'Uninstall' }).click();
  await expect(page.getByRole('heading', { name: 'E2E Admin Theme' })).toHaveCount(0);
});
