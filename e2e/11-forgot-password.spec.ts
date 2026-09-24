import { expect, test } from '@playwright/test';
import { deliveredLink, login, ownerEmail } from './helpers';

test('admin requests a reset email and signs in with the new password', async ({ page }) => {
  await page.goto('/en/auth/login');
  await page.getByRole('link', { name: 'Forgot password?' }).click();
  await expect(page.getByRole('heading', { name: 'Forgot password' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(ownerEmail);
  await page.getByRole('button', { name: 'Request reset link' }).click();
  await expect(page.getByText('If an account exists for that email')).toBeVisible();
  const link = await deliveredLink(ownerEmail, '/auth/reset-password');
  await page.goto(link);
  await page.getByLabel('New password').fill('FinalOwnerPassword123!');
  await page.getByLabel('Confirm password').fill('FinalOwnerPassword123!');
  await page.getByRole('button', { name: 'Reset password' }).click();
  await expect(page.getByText('Password updated.')).toBeVisible();
  await login(page, ownerEmail, 'FinalOwnerPassword123!');
});
