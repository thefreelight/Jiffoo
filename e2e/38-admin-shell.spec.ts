import { expect, test } from './local-requests';
import { login, ownerEmail } from './helpers';
async function chooseMode(page: import('@playwright/test').Page, mode: string) {
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Appearance', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await page.getByRole('menuitemradio', { name: mode, exact: true }).click();
}
test('U1b modes and rail persist through SSR reload while mobile navigation stays keyboard accessible', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await login(page, ownerEmail, 'FinalOwnerPassword123!');
  await expect(page.getByRole('main')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
  await chooseMode(page, 'Light');
  await expect(page.getByRole('main')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await page.reload();
  await expect(page.getByRole('main')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await chooseMode(page, 'Dark');
  await expect(page.getByRole('main')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
  const toggle = page.getByRole('button', { name: 'Collapse sidebar', exact: true });
  await toggle.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Expand sidebar', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await page.reload();
  await expect(page.getByRole('complementary', { name: 'Store navigation', exact: true })).toHaveCSS('width', '56px');
  for (const name of ['Dashboard', 'Products', 'Orders', 'Notifications', 'Customers', 'Administrators', 'Plugins', 'Themes', 'Settings', 'System Health', 'Audit log', 'Tracking & custom code'])
    await expect(page.getByRole('link', { name, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Store', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Store', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Enter');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open menu', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Store navigation', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Orders', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Orders', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Store navigation', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await chooseMode(page, 'Light');
  await expect(page.getByRole('dialog', { name: 'Store navigation', exact: true })).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await page.getByRole('button', { name: 'Close menu', exact: true }).click();
  await expect(page.getByRole('main')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
});
