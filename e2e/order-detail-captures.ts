import { expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { chooseOverviewMode } from './overview-captures';

export async function captureOrderDetail(page: Page, state: 'processing' | 'review' | 'cancelled') {
  if (process.env.CI === 'true' || state === 'review') return;
  const directory = 'C:/Users/11948/Pictures/jiffoo-u3';
  await mkdir(directory, { recursive: true });
  for (const mode of ['Light', 'Dark']) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await chooseOverviewMode(page, mode);
    for (const [width, height] of [[1440, 900]]) {
      await page.setViewportSize({ width, height });
      await page.getByRole('heading', { name: /^Order #/ }).click(); await page.keyboard.press('Control+Home');
      await expect(page.getByRole('region', { name: 'Notifications alt+T', exact: true }).getByRole('listitem', { name: /.*/ })).toHaveCount(0);
      const filename = state === 'cancelled' ? 'detail-cancelled-1440-' + mode.toLowerCase() : 'detail-' + state + '-' + mode.toLowerCase() + '-' + width;
      const image = await page.screenshot({ path: directory + '/' + filename + '.png', animations: 'disabled' });
      expect(image.readUInt32BE(16)).toBe(width); expect(image.readUInt32BE(20)).toBe(height);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}
