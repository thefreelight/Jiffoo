import { expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { chooseOverviewMode } from './overview-captures';

export async function captureStaffPage(page: Page, kind: 'list' | 'detail' | 'profile', state: string, heading: string) {
  if (process.env.CI === 'true') return;
  const directory = 'C:/Users/11948/Pictures/jiffoo-b2';
  await mkdir(directory, { recursive: true });
  const original = page.url();
  for (const mode of ['Light', 'Dark']) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(original);
    await chooseOverviewMode(page, mode);
    await page.goto(original.replace('/en/', '/zh-Hans/'));
    for (const [width, height] of [[1440, 1400], [390, 1900]]) {
      await page.setViewportSize({ width, height });
      const title = page.getByRole('heading', { name: heading, exact: true, level: 1 });
      await expect(title).toBeVisible();
      if (kind === 'detail') {
        const event = state === 'owner' ? '安装时创建了店主账户' : state === 'active' ? '接受邀请，设置了密码' : state === 'removed' ? '被移除' : '被邀请为管理员';
        await expect(page.getByRole('region', { name: '记录', exact: true }).getByText(event, { exact: true })).toBeVisible();
      }
      if (kind === 'list') await expect(page.getByRole('link', { name: /e2e-admin/ })).toBeVisible();
      if (kind === 'profile') await expect(page.getByLabel('名字', { exact: true })).not.toHaveValue('');
      await title.click(); await page.keyboard.press('Control+Home');
      const image = await page.screenshot({ path: directory + '/' + kind + '-' + state + '-' + mode.toLowerCase() + '-' + width + '.png', fullPage: true, animations: 'disabled' });
      expect(image.readUInt32BE(16), 'Staff and profile pages stay within the viewport').toBe(width);
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(original);
}
