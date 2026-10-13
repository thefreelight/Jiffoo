import { expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

export async function chooseOverviewMode(page: Page, mode: string) {
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Appearance', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await page.getByRole('menuitemradio', { name: mode, exact: true }).click();
}

export async function captureOverview(page: Page, empty = false) {
  const capture = process.env.CI !== 'true';
  const directory = 'C:/Users/11948/Pictures/jiffoo-u2';
  if (capture) await mkdir(directory, { recursive: true });
  for (const mode of ['Light', 'Dark']) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await chooseOverviewMode(page, mode);
    if (!empty) await expect(page.getByRole('img', { name: /^Paid sales: / }).last()).toHaveCSS('fill', mode === 'Dark' ? 'rgb(237, 237, 237)' : 'rgb(23, 23, 23)');
    for (const [width, height] of [[1440, 900], [390, 844]]) {
      await page.setViewportSize({ width, height });
      await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Recent orders', exact: true })).toBeVisible();
      await page.getByRole('heading', { name: 'Overview', exact: true }).click();
      await page.keyboard.press('Control+Home');
      const image = await page.screenshot({ ...(capture ? { path: directory + '/overview-' + (empty ? 'empty-' : '') + mode.toLowerCase() + '-' + width + '.png' } : {}), animations: 'disabled' });
      expect(image.readUInt32BE(16)).toBe(width);
      expect(image.readUInt32BE(20)).toBe(height);
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}
