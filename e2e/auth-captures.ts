import { expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

export async function captureAuthState(page: Page, state: string, heading: string) {
  if (process.env.CI === 'true') return;
  const directory = 'C:/Users/11948/Pictures/jiffoo-b3';
  await mkdir(directory, { recursive: true });
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    for (const [width, height] of [[1440, state.startsWith('install-') ? 1000 : 820], [390, 1000]]) {
      await page.setViewportSize({ width, height });
      await expect(page.getByRole('heading', { name: heading, exact: true, level: 1 })).toBeVisible();
      await page.getByRole('heading', { name: heading, exact: true, level: 1 }).click();
      await page.keyboard.press('Control+Home');
      const image = await page.screenshot({ path: directory + '/' + state + '-' + colorScheme + '-' + width + '.png', fullPage: true, animations: 'disabled' });
      expect(image.readUInt32BE(16), 'Public account screens stay within the viewport').toBe(width);
    }
  }
  await page.emulateMedia({ colorScheme: 'light' });
  await page.setViewportSize({ width: 1440, height: 900 });
}
