import { expect, test } from './local-requests';
import { customerEmail, login, shopLogin } from './helpers';

test('generate a customer reset link and reset and log in through Shop', async ({ page }) => {
  await login(page);
  await page.goto('/en/customers');
  await page.getByPlaceholder('Search customers by name or email...').fill(customerEmail);
  await page.getByRole('row', { name: new RegExp(customerEmail) }).getByRole('link').click();
  await page.getByRole('button', { name: 'Generate reset link' }).click();
  await page.getByRole('dialog', { name: 'Generate reset link' }).getByRole('button', { name: 'Generate link' }).click();
  const link = await page.getByRole('textbox', { name: 'Reset link' }).inputValue();
  expect(new URL(link).searchParams.get('token')).toBeTruthy();
  await page.goto(link);
  await expect(page.getByRole('heading', { name: 'Reset password' })).toBeVisible();
  await page.getByLabel('New password').fill('CustomerChanged123!');
  await page.getByRole('button', { name: 'Reset password' }).click();
  await expect(page.getByRole('status')).toHaveText('Password updated.');
  await page.goto('http://127.0.0.1:3003/en/login');
  await shopLogin(page, { locale: 'en', email: customerEmail, password: 'CustomerChanged123!', expectedPath: '/en' });
});
