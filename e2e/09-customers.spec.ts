import { expect, test } from '@playwright/test';
import { api, customerEmail, login } from './helpers';

test('generate a customer reset link once and log in with the new password', async ({ page, request }) => {
  await login(page);
  await page.goto('/en/customers');
  await page.getByPlaceholder('Search customers by name or email...').fill(customerEmail);
  await page.getByRole('row', { name: new RegExp(customerEmail) }).getByRole('link').click();
  await page.getByRole('button', { name: 'Generate reset link' }).click();
  await page.getByRole('dialog', { name: 'Generate reset link' }).getByRole('button', { name: 'Generate link' }).click();
  const link = await page.getByRole('textbox', { name: 'Reset link' }).inputValue();
  const token = new URL(link).searchParams.get('token');
  expect(token).toBeTruthy();
  await api(request, '/auth/reset-password', {
    method: 'POST', data: { token, newPassword: 'CustomerChanged123!' },
  });
  const result = await api<{ token: string }>(request, '/auth/login', {
    method: 'POST', data: { email: customerEmail, password: 'CustomerChanged123!' },
  });
  expect(result.token).toBeTruthy();
});
