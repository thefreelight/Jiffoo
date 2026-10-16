import { expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { appearanceU4 } from './u4-captures';

export async function captureProductEditorStates(page: Page, productId: string) {
  if (process.env.CI === 'true') return;
  const writeCapture = Boolean(process.env.VISUAL_SET);
  const directory = 'e2e/visual-results/' + process.env.VISUAL_SET + '/product-editor';
  if (writeCapture) await mkdir(directory, { recursive: true });
  const capture = async (name: string, mode: string) => {
    for (const [width, height] of [[1440, 1800], [390, 3000]]) {
      await page.setViewportSize({ width, height });
      if (!name.includes('leave')) { await page.getByRole('heading', { level: 1, name: /.+/ }).click(); await page.keyboard.press('Control+Home'); }
      await expect(page.getByRole('region', { name: 'Notifications alt+T', exact: true }).getByRole('listitem', { name: /.*/ })).toHaveCount(0);
      const screenshot = await page.screenshot({ ...(writeCapture ? { path: directory + '/' + name + '-' + mode.toLowerCase() + '-' + width + '.png' } : {}), fullPage: true, animations: 'disabled' });
      expect(screenshot.readUInt32BE(16), name + ' has no horizontal overflow at ' + width).toBe(width);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
  };
  for (const mode of ['Light', 'Dark']) {
    await page.goto('/en/products/' + productId + '/edit');
    await appearanceU4(page, mode);
    await page.goto('/zh-Hans/products/' + productId + '/edit');
    await expect(page.getByRole('table', { name: '规格、价格与库存', exact: true })).toBeVisible();
    await capture('edit-clean', mode);
    await page.getByRole('button', { name: '商品状态', exact: true }).click();
    await page.getByRole('menuitemradio', { name: '在售', exact: true }).click();
    await capture('edit-dirty', mode);
    await page.getByRole('button', { name: '放弃更改', exact: true }).click();
    await page.getByRole('textbox', { name: /^SKU:/ }).nth(1).fill('E2E-001');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByRole('table', { name: '规格、价格与库存', exact: true }).getByText(/这个 SKU 已被商品/)).toBeVisible();
    await page.getByRole('button', { name: '去修改 →', exact: true }).click();
    await expect(page.getByRole('textbox', { name: /^SKU:/ }).nth(1)).toBeFocused();
    await capture('edit-error', mode);
    await page.getByRole('link', { name: '← 商品', exact: true }).click();
    await expect(page.getByRole('alertdialog', { name: '离开前要保存吗？', exact: true })).toBeVisible();
    await capture('edit-leave', mode);
    await page.getByRole('button', { name: '继续编辑', exact: true }).click();
    await page.getByRole('button', { name: '放弃更改', exact: true }).click();
    await page.goto('/zh-Hans/products/create');
    await expect(page.getByRole('table', { name: '规格、价格与库存', exact: true })).toBeVisible();
    await capture('create-clean', mode);
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByText(/保存失败：有/)).toBeVisible();
    await capture('create-error', mode);
    await page.getByRole('textbox', { name: '名称', exact: true }).fill('A5 临时新商品');
    await page.getByRole('spinbutton', { name: /^价格:/ }).first().fill('1.25');
    await capture('create-dirty', mode);
    await page.getByRole('link', { name: '← 商品', exact: true }).click();
    await expect(page.getByRole('alertdialog', { name: '离开前要保存吗？', exact: true })).toBeVisible();
    await capture('create-leave', mode);
    await page.getByRole('button', { name: '不保存，离开', exact: true }).click();
    await expect(page).toHaveURL(/\/zh-Hans\/products/);
  }
  await page.goto('/en/products');
}
