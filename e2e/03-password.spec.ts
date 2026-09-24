import { expect, test } from '@playwright/test';
import { changedPassword, login, logout, originalPassword, ownerEmail } from './helpers';

test('password change keeps the session and revokes the old password', async ({ page }) => {
  await login(page, ownerEmail, originalPassword);
  await page.goto('/en/profile#security');
  await page.getByPlaceholder('New Password').fill(changedPassword);
  await page.getByPlaceholder('Confirm Password').fill(changedPassword);
  await page.getByPlaceholder('Current password (required for security changes)').fill(originalPassword);
  await page.getByRole('button', { name: 'Update Password' }).click();
  await expect(page.getByPlaceholder('New Password')).toBeEmpty();
  await page.reload();
  await expect(page).toHaveURL(/\/en\/profile/);
  await logout(page);
  await page.getByPlaceholder('Enter your email').fill(ownerEmail);
  await page.getByPlaceholder('Enter your password').fill(originalPassword);
  await page.getByRole('button', { name: /sign in|authenticate/i }).click();
  await expect(page).toHaveURL(/\/en\/auth\/login/);
  await login(page);
});
