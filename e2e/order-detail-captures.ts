import { expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { chooseOverviewMode } from './overview-captures';

export async function captureOrderDetail(page: Page, state: 'processing' | 'review' | 'cancelled', dialog?: 'ship' | 'refund') {
  if (process.env.CI === 'true') return;
  const directory = 'C:/Users/11948/Pictures/jiffoo-u3';
  await mkdir(directory, { recursive: true });
  for (const mode of ['Light', 'Dark']) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await chooseOverviewMode(page, mode);
    for (const [width, height] of state === 'cancelled' ? [[1440, 900]] : [[1440, 900], [390, 844]]) {
      await page.setViewportSize({ width, height });
      await page.getByRole('heading', { name: /^Order #/ }).click(); await page.keyboard.press('Control+Home');
      const filename = state === 'cancelled' ? 'detail-cancelled-1440-' + mode.toLowerCase() : 'detail-' + state + '-' + mode.toLowerCase() + '-' + width;
      const image = await page.screenshot({ path: directory + '/' + filename + '.png', animations: 'disabled' });
      expect(image.readUInt32BE(16)).toBe(width); expect(image.readUInt32BE(20)).toBe(height);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    if (dialog) {
      await page.getByRole('button', { name: dialog === 'ship' ? 'Ship order' : 'Refund', exact: true }).click();
      const modal = page.getByRole('dialog', { name: dialog === 'ship' ? 'Ship order' : 'Record offline refund', exact: true });
      await expect(modal).toBeVisible();
      await page.screenshot({ path: directory + '/dialog-' + dialog + '-' + mode.toLowerCase() + '-1440.png', animations: 'disabled' });
      await modal.getByRole('button', { name: 'Close', exact: true }).click();
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

export async function captureRefundDialog(page: Page) {
  if (process.env.CI === 'true') return;
  const directory = 'C:/Users/11948/Pictures/jiffoo-u3';
  await mkdir(directory, { recursive: true });
  for (const mode of ['Light', 'Dark']) {
    await page.setViewportSize({ width: 1440, height: 900 }); await chooseOverviewMode(page, mode);
    await page.getByRole('button', { name: 'Refund', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Record offline refund', exact: true });
    await expect(dialog).toBeVisible();
    await page.screenshot({ path: directory + '/dialog-refund-' + mode.toLowerCase() + '-1440.png', animations: 'disabled' });
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  }
}
