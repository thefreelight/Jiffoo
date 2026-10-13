import { mkdir } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { expect } from './local-requests';
const directory = 'C:/Users/11948/Pictures/jiffoo-u4';
export async function captureU4(page: Page, name: string) {
  if (process.platform !== 'win32') return;
  await mkdir(directory, { recursive: true });
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('listitem').filter({ hasText: /Product saved\.|Product created\.|cannot be deleted/ })).toHaveCount(0, { timeout: 10000 });
  await page.screenshot({ path: directory + '/' + name + '.png', animations: 'disabled', caret: 'hide' });
}
export async function appearanceU4(page: Page, mode: string) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Appearance', exact: true }).focus(); await page.keyboard.press('ArrowRight');
  await page.getByRole('menuitemradio', { name: mode, exact: true }).click();
}
