import { expect, test } from './local-requests';
import { login, ownerEmail } from './helpers';
import { mkdir } from 'node:fs/promises';
test('captures Admin shell in light and dark at desktop and mobile widths', async ({ page }) => {
  test.setTimeout(60000);
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
      for (const name of ['dashboard', 'orders', 'products', 'products/categories']) {
        const title = name === 'orders' ? 'Orders' : name === 'products' ? 'Products' : name === 'products/categories' ? 'Categories' : 'Overview';
        const imageName = name.replace('/', '-');
        await page.goto('/en/' + name);
        await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
        await page.waitForLoadState('networkidle');
        await page.getByRole('heading', { name: title, exact: true }).click(); await page.keyboard.press('Control+Home');
        await page.screenshot({ path: directory + '/shell-' + imageName + '-' + mode.toLowerCase() + '-' + width + '.png', animations: 'disabled' });
        if (name !== 'dashboard') {
          const localizedTitle = name === 'orders' ? '订单' : name === 'products' ? '商品' : '分类';
          await page.goto('/zh-Hans/' + name);
          await expect(page.getByRole('heading', { name: localizedTitle, exact: true })).toBeVisible();
          if (name === 'orders') await expect(page.getByRole('link', { name: /^查看订单 / }).first()).toBeVisible();
          else if (name === 'products') await expect(page.getByRole('link', { name: 'E2E Product', exact: true })).toBeVisible();
          else await expect(page.getByRole('button', { name: 'E2E Translated Category', exact: true })).toBeVisible();
          await page.getByRole('heading', { name: localizedTitle, exact: true }).click(); await page.keyboard.press('Control+Home');
          await page.screenshot({ path: directory + '/' + imageName + '-zh-Hans-' + mode.toLowerCase() + '-' + width + '.png', animations: 'disabled' });
          await page.goto('/en/' + name);
        }
      }
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
    await page.screenshot({ path: directory + '/shell-rail-' + mode.toLowerCase() + '-1440.png', animations: 'disabled' });
    await page.getByRole('button', { name: 'Expand sidebar', exact: true }).click();
  }
});
