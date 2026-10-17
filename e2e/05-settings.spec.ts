import { expect, test } from './local-requests';
import { login } from './helpers';

test('store name persists after saving settings and reloading', async ({ page }) => {
  await login(page);
  await page.goto('/en/settings');
  await page.getByRole('textbox', { name: 'Shop name', exact: true }).fill('');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Enter a shop name.', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Shop name', exact: true })).toBeFocused();
  await page.getByRole('textbox', { name: 'Shop name', exact: true }).fill('E2E Updated Store');
  const saved = page.waitForResponse(response => response.url().endsWith('/admin/settings/batch') && response.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  expect((await saved).ok()).toBe(true);
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Shop name', exact: true })).toHaveValue('E2E Updated Store');
  const context = await page.request.get('http://127.0.0.1:3001/api/v1/store/context');
  expect(context.ok()).toBe(true);
  const countries: string[] = (await context.json()).data.checkoutCountriesRequireStatePostal;
  const names = new Intl.DisplayNames(['en'], { type: 'region' });
  for (const code of countries) await page.getByRole('button', { name: `Remove ${names.of(code)}`, exact: true }).click();
  await expect(page.getByText('No country requires state/province and postal code.', { exact: true })).toBeVisible();
  const emptySave = page.waitForResponse(response => response.url().endsWith('/admin/settings/batch') && response.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  expect((await emptySave).ok()).toBe(true);
  await page.reload();
  await expect(page.getByText('No country requires state/province and postal code.', { exact: true })).toBeVisible();
  for (const code of countries) {
    await page.getByRole('button', { name: 'Add country or region', exact: true }).click();
    await page.getByRole('button', { name: `${names.of(code)} ${code}`, exact: true }).click();
  }
  const restored = page.waitForResponse(response => response.url().endsWith('/admin/settings/batch') && response.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  expect((await restored).ok()).toBe(true);
});
