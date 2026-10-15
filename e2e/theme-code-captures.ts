import { mkdir } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { expect } from './local-requests';

export async function captureThemeCodeState(page: Page, name: string, overlay?: { open: () => Promise<void>; close: () => Promise<void> }) {
  if (!process.env.VISUAL_SET) return;
  const directory = 'e2e/visual-results/' + process.env.VISUAL_SET;
  await mkdir(directory, { recursive: true });
  for (const mode of ['Light', 'Dark']) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('button', { name: 'Account menu', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Appearance', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    await page.getByRole('menuitemradio', { name: mode, exact: true }).click();
    await page.getByRole('heading', { name: /.+/ }).first().click();
    await page.getByRole('main').focus(); await page.keyboard.press('Control+Home');
    if (overlay) await overlay.open();
    for (const [width, height] of [[1440, 900], [390, 844]]) {
      await page.setViewportSize({ width, height });
      const image = await page.screenshot({ path: `${directory}/c1a-${name}-${mode.toLowerCase()}-${width}.png`, fullPage: true, animations: 'disabled', caret: 'hide' });
      expect(image.readUInt32BE(16), 'Page has no horizontal overflow').toBe(width);
      if (!overlay) {
        for (const field of await page.getByRole('main').getByRole('textbox').all()) {
          const box = await field.boundingBox();
          if (box) { expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width); }
        }
        await page.setViewportSize({ width, height: 3000 });
        const full = await page.screenshot({ path: `${directory}/c1a-${name}-${mode.toLowerCase()}-${width}-full.png`, fullPage: true, animations: 'disabled', caret: 'hide' });
        expect(full.readUInt32BE(16)).toBe(width);
      }
    }
    if (overlay) await overlay.close();
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}
