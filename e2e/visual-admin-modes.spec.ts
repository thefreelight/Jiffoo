import { expect, test } from './local-requests';
import { login, ownerEmail } from './helpers';
import { mkdir } from 'node:fs/promises';
test('captures Admin shell in light and dark at desktop and mobile widths', async ({ page }) => {
  const directory = 'e2e/visual-results/' + process.env.VISUAL_SET;
  await mkdir(directory, { recursive: true });
  await login(page, ownerEmail, 'FinalOwnerPassword123!');
  for (const mode of ['Light', 'Dark']) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('button', { name: 'Account menu', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Appearance', exact: true }).focus(); await page.keyboard.press('ArrowRight');
    await page.getByRole('menuitemradio', { name: mode, exact: true }).click();
    for (const [width, height] of [[1440, 900], [390, 844]]) {
      await page.setViewportSize({ width, height });
      for (const name of ['dashboard', 'orders']) {
        await page.goto('/en/' + name);
        await expect(page.getByRole('heading', { name: name === 'orders' ? 'Orders' : 'Dashboard', exact: true })).toBeVisible();
        await page.waitForLoadState('networkidle');
        await page.getByRole('heading', { name: name === 'orders' ? 'Orders' : 'Dashboard', exact: true }).click(); await page.keyboard.press('Control+Home');
        await page.screenshot({ path: directory + '/shell-' + name + '-' + mode.toLowerCase() + '-' + width + '.png', animations: 'disabled' });
      }
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
    await page.screenshot({ path: directory + '/shell-rail-' + mode.toLowerCase() + '-1440.png', animations: 'disabled' });
    await page.getByRole('button', { name: 'Expand sidebar', exact: true }).click();
  }
});
