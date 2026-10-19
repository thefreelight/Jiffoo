import { captureVisual } from './visual-capture';
import { mkdir } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { expect } from './local-requests';
const directory = 'e2e/visual-results/' + process.env.VISUAL_SET + '/products';
export async function captureU4(page: Page, name: string) {
  if (process.platform !== 'win32') return;
  const writeCapture = Boolean(process.env.VISUAL_SET);
  if (writeCapture) await mkdir(directory, { recursive: true });
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('listitem').filter({ hasText: /Product saved\.|Product created\.|cannot be deleted/ })).toHaveCount(0, { timeout: 10000 });
  await captureVisual(page, { ...(writeCapture ? { path: directory + '/' + name + '.png' } : {}), animations: 'disabled', caret: 'hide' });
}
export async function appearanceU4(page: Page, mode: string) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Appearance', exact: true }).focus(); await page.keyboard.press('ArrowRight');
  await page.getByRole('menuitemradio', { name: mode, exact: true }).click();
}
