import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('health overview and five enabled builtin plugins are visible', async ({ page }) => {
  await login(page);
  await page.goto('/en/system/health');
  await expect(page.getByRole('heading', { name: 'System Health' })).toBeVisible();
  await expect(page.getByText('Overall status')).toBeVisible();
  await page.goto('/en/plugins');
  await expect(page.getByRole('heading', { name: 'Plugins' })).toBeVisible();
  for (const plugin of ['Console email', 'Free shipping', 'Manual payment', 'Zero tax', 'Manual fulfillment']) {
    await expect(page.getByText(plugin, { exact: true })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'Disable' })).toHaveCount(5);
});
