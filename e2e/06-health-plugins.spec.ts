import { expect, test } from './local-requests';
import { login } from './helpers';

test('health overview and five enabled builtin plugins are visible', async ({ page }) => {
  await login(page);
  await page.goto('/en/system/health');
  await expect(page.getByRole('heading', { name: 'System Health' })).toBeVisible();
  await expect(page.getByText('Overall status')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Background worker', exact: true }).getByText('Running (1)', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Plugin database integrity', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run read-only scan', exact: true })).toBeVisible();
  const scanned = page.waitForResponse(response => response.url().endsWith('/extensions/plugin/database-audit') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Run read-only scan', exact: true }).click();
  const result = await scanned; expect(result.ok()).toBe(true);
  const report = (await result.json()).data.latest;
  expect(report.counts.blocking).toBe(0);
  await expect(page.getByText(`Installed plugins: ${report.counts.plugins}`, { exact: true })).toBeVisible();
  await expect(page.getByText(`Scan finished at: ${report.finishedAt}`, { exact: true })).toBeVisible();
  await page.goto('/en/plugins');
  await expect(page.getByRole('heading', { name: 'Plugins' })).toBeVisible();
  for (const plugin of ['Console email', 'Free shipping', 'Manual payment', 'Zero tax', 'Manual fulfillment']) {
    const row = page.getByRole('article', { name: plugin, exact: true });
    await expect(row.getByRole('link', { name: plugin, exact: true })).toBeVisible();
    await expect(row.getByText('Enabled', { exact: true })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'Disable', exact: true })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Installed', exact: true })).toContainText('5');
  await expect(page.getByRole('heading', { name: 'Plugin database integrity', exact: true })).toHaveCount(0);
});
