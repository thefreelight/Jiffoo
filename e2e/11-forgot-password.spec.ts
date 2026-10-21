import { expect, test } from './local-requests';
import { deliveredLink, finalOwnerPassword, login, ownerEmail } from './helpers';
import { captureAuthState } from './auth-captures';

test('admin requests a reset email and signs in with the new password', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/en/auth/login');
  await page.getByRole('link', { name: 'Forgot password?' }).click();
  await expect(page.getByRole('heading', { name: 'Recover password', exact: true })).toBeVisible();
  await captureAuthState(page, 'forgot-form', 'Recover password');
  await page.getByRole('textbox', { name: 'Login email', exact: true }).fill(ownerEmail);
  await page.getByRole('button', { name: 'Send reset email', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Check your email', exact: true })).toBeVisible();
  await captureAuthState(page, 'forgot-sent', 'Check your email');
  const link = await deliveredLink(ownerEmail, '/en/auth/reset-password');
  await page.goto(link);
  await captureAuthState(page, 'reset-form', 'Set a new password');
  await page.getByLabel('New password', { exact: true }).fill(finalOwnerPassword);
  await page.getByLabel('Enter again', { exact: true }).fill(finalOwnerPassword);
  await page.getByRole('button', { name: 'Save new password', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Password updated', exact: true })).toBeVisible();
  await captureAuthState(page, 'reset-complete', 'Password updated');
  await page.goto(link);
  await expect(page.getByRole('heading', { name: 'Link expired', exact: true })).toBeVisible();
  await expect(page.getByLabel('New password', { exact: true })).toHaveCount(0);
  await captureAuthState(page, 'reset-invalid', 'Link expired');
  await login(page, ownerEmail, finalOwnerPassword);
});
