import { mkdir } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export async function captureS4State(page: Page, name: string) {
  const set = process.env.VISUAL_SET;
  if (!['baseline', 'current', 'noise-1', 'noise-2'].includes(set ?? '')) return;
  const previous = page.viewportSize();
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    for (const [width, height] of [[1440, 900], [390, 844]]) {
      await page.setViewportSize({ width, height });
      await page.getByRole('banner', { name: '' }).click({ position: { x: 1, y: 1 } });
      await page.keyboard.press('Control+Home');
      for (const captureSet of set === 'current' ? ['noise-1', 'noise-2', 'current'] : [set!]) {
        await mkdir(`e2e/visual-results/${captureSet}`, { recursive: true });
        const png = await page.screenshot({ path: `e2e/visual-results/${captureSet}/s4-${name}-${colorScheme}-${width}.png`, fullPage: true, animations: 'disabled' });
        expect(png.readUInt32BE(16), `${name} fits the viewport`).toBe(width);
      }
    }
  }
  if (previous) await page.setViewportSize(previous);
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
}
