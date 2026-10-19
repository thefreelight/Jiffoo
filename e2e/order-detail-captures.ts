import { expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { chooseOverviewMode } from './overview-captures';

export async function captureOrderDetail(page: Page, state: 'processing' | 'shipped' | 'review' | 'cancelled') {
  if (process.env.CI === 'true') return;
  const writeCapture = Boolean(process.env.VISUAL_SET);
  const directory = 'e2e/visual-results/' + process.env.VISUAL_SET + '/order-detail';
  if (writeCapture) await mkdir(directory, { recursive: true });
  const original = page.url();
  for (const mode of ['Light', 'Dark']) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(original);
    await chooseOverviewMode(page, mode);
    await page.goto(original.replace('/en/', '/zh-Hans/'));
    for (const [width, height] of [[1440, 1700], [390, 2000]]) {
      await page.setViewportSize({ width, height });
      await page.getByRole('heading', { level: 1, name: /^订单 [A-Z]{2,6}-[0-9]{8}-[0-9]{4,}$/ }).click(); await page.keyboard.press('Control+Home');
      await expect(page.getByRole('region', { name: 'Notifications alt+T', exact: true }).getByRole('listitem', { name: /.*/ })).toHaveCount(0);
      const image = await page.screenshot({ ...(writeCapture ? { path: directory + '/detail-' + state + '-' + mode.toLowerCase() + '-' + width + '.png' } : {}), animations: 'disabled' });
      expect(image.readUInt32BE(16)).toBe(width); expect(image.readUInt32BE(20)).toBe(height);
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(original);
}
