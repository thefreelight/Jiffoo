import { expect, test } from './local-requests';
import { login } from './helpers';

test('health overview and five enabled builtin plugins are visible', async ({ page }) => {
  await login(page);
  await page.goto('/en/system/health');
  await expect(page.getByRole('heading', { name: 'System health' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Overall status' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Background tasks (worker)', exact: true }).getByText(/1 running/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Plugin database check', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start check', exact: true })).toBeVisible();
  const scanned = page.waitForResponse(response => response.url().endsWith('/extensions/plugin/database-audit') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Start check', exact: true }).click();
  const result = await scanned; expect(result.ok()).toBe(true);
  const report = (await result.json()).data.latest;
  expect(report.counts.blocking).toBe(0);
  const check = page.getByRole('region', { name: 'Plugin database check', exact: true });
  await expect(check.getByText(String(report.counts.plugins), { exact: true }).first()).toBeVisible();
  await expect(check.getByText(/^Last checked:/)).toBeVisible();
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
