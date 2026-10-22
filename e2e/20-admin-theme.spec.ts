import { captureVisual } from './visual-capture';
import { expect, test } from './review-capture';
import { login, ownerEmail } from './helpers';
import { adminThemePackage } from './theme-package';
import { captureThemeCodeState } from './theme-code-captures';
import { chooseOverviewMode } from './overview-captures';
import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';

test('C1a activates Admin assets on every auth screen and restores the default', async ({ page, newObservedContext }) => {
  test.setTimeout(180000);
  const bytes = await adminThemePackage(true), hash = createHash('sha256').update(bytes).digest('hex');
  await login(page, ownerEmail, 'FinalOwnerPassword123!'); await page.getByRole('link', { name: 'Themes', exact: true }).click();
  await page.getByRole('tab', { name: 'Admin themes', exact: true }).click(); await expect(page).toHaveURL(/target=admin/);
  await expect(page.getByRole('heading', { name: 'Default Admin', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Upload theme', exact: true }).click();
  await page.getByLabel('Theme package', { exact: true }).setInputFiles({ name: 'admin.zip', mimeType: 'application/zip', buffer: bytes });
  await page.getByLabel('I trust this theme package. It is unsigned, so the system cannot verify its author.', { exact: true }).check();
  await page.getByRole('button', { name: 'Install', exact: true }).click();
  const fonts: string[] = []; page.on('request', request => { if (request.url().includes('/fonts/outfit.woff2')) fonts.push(request.url()); });
  await page.getByRole('article', { name: 'E2E Admin Theme', exact: true }).getByRole('button', { name: 'Activate', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Active', exact: true }).getByRole('heading', { name: 'E2E Admin Theme', exact: true })).toBeVisible();
  await chooseOverviewMode(page, 'Light');
  await expect(page.getByRole('img', { name: 'Store logo', exact: true })).toHaveAttribute('src', `/api/v1/themes/e2e-admin-theme/${hash}/assets/logo.png`);
  await expect(page.getByRole('button', { name: 'Upload theme', exact: true })).toHaveCSS('color', 'rgb(204, 0, 51)');
  expect(fonts.some(url => url.endsWith(`/themes/e2e-admin-theme/${hash}/fonts/outfit.woff2`))).toBe(true);
  await captureThemeCodeState(page, 'themes-admin');
  await page.getByRole('link', { name: 'View settings', exact: true }).click();
  await expect(page.getByText('This theme has no adjustable settings.', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Home sections', exact: true })).toHaveCount(0);
  await captureThemeCodeState(page, 'theme-edit-admin-no-settings');
  await page.getByRole('link', { name: '← Themes', exact: true }).click();
  for (const mode of ['Light', 'Dark']) {
    const fresh = await newObservedContext(), auth = await fresh.newPage();
    try {
      await login(auth, ownerEmail, 'FinalOwnerPassword123!'); await chooseOverviewMode(auth, mode);
      await auth.getByRole('button', { name: 'Account menu', exact: true }).click(); await auth.getByRole('menuitem', { name: 'Log out', exact: true }).click();
      await expect(auth.getByRole('heading', { name: 'Sign in to Admin', exact: true })).toBeVisible();
      for (const [route, title] of [['login', 'Sign in to Admin'], ['forgot-password', 'Recover password'], ['reset-password', 'Link expired'], ['accept-invite', 'Invitation link expired']]) {
        if (route !== 'login') await auth.goto('/en/auth/' + route);
        await expect(auth.getByRole('heading', { name: title, exact: true })).toBeVisible();
        await expect(auth.getByRole('main')).toHaveCSS('background-image', `url("http://127.0.0.1:3002/api/v1/themes/e2e-admin-theme/${hash}/assets/login.png")`);
        if (process.env.VISUAL_SET) {
          const directory = 'e2e/visual-results/' + process.env.VISUAL_SET; await mkdir(directory, { recursive: true });
          for (const [width, height] of [[1440, 900], [390, 844]]) { await auth.setViewportSize({ width, height }); const image = await captureVisual(auth, { path: `${directory}/c1a-auth-${route}-${mode.toLowerCase()}-${width}.png`, fullPage: true, animations: 'disabled' }); expect(image.readUInt32BE(16)).toBe(width); }
        }
      }
    } finally { await fresh.close(); }
  }
  // Signing out in either context revokes every session for this principal.
  await expect(page.getByRole('heading', { name: 'Sign in to Admin', exact: true })).toBeVisible();
  await login(page, ownerEmail, 'FinalOwnerPassword123!');
  await page.getByRole('link', { name: 'Themes', exact: true }).click();
  await page.getByRole('tab', { name: 'Admin themes', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Active', exact: true }).getByRole('heading', { name: 'E2E Admin Theme', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'More actions: E2E Admin Theme', exact: true }).click(); await page.getByRole('menuitem', { name: 'Restore previous theme', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Active', exact: true }).getByRole('heading', { name: 'Default Admin', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'More actions: E2E Admin Theme', exact: true }).click(); await page.getByRole('menuitem', { name: 'Uninstall', exact: true }).click(); await expect(page.getByRole('article', { name: 'E2E Admin Theme', exact: true })).toHaveCount(0);
  const plain = await newObservedContext(); try { const auth = await plain.newPage(); await auth.goto('/en/auth/login'); await expect(auth.getByRole('heading', { name: 'Sign in to Admin', exact: true })).toBeVisible(); await expect(auth.getByRole('main')).toHaveCSS('background-image', 'none'); } finally { await plain.close(); }
});
