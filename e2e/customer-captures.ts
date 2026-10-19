import { captureVisual } from './visual-capture';
import { expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { chooseOverviewMode } from './overview-captures';

export async function captureCustomers(page: Page, kind: 'list' | 'detail') {
  if (process.env.CI === 'true') return;
  const writeCapture = Boolean(process.env.VISUAL_SET);
  const directory = 'e2e/visual-results/' + process.env.VISUAL_SET + '/customers';
  if (writeCapture) await mkdir(directory, { recursive: true });
  const original = page.url();
  for (const mode of ['Light', 'Dark']) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(original);
    await chooseOverviewMode(page, mode);
    await page.goto(original.replace('/en/', '/zh-Hans/'));
    for (const [width, height] of [[1440, 1600], [390, 2000]]) {
      await page.setViewportSize({ width, height });
      const heading = page.getByRole('heading', { level: 1, name: kind === 'list' ? '客户' : 'E2E Customer', exact: true });
      await expect(heading).toBeVisible();
      await expect(page.getByRole('button', { name: '更多操作：E2E Customer', exact: true })).toBeVisible();
      await heading.click();
      await page.keyboard.press('Control+Home');
      const image = await captureVisual(page, { ...(writeCapture ? { path: directory + '/' + kind + '-' + mode.toLowerCase() + '-' + width + '.png' } : {}), animations: 'disabled', fullPage: true });
      expect(image.readUInt32BE(16), 'Customer pages stay within the viewport').toBe(width);
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(original);
}
