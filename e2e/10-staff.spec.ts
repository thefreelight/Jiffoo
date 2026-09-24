import { expect, test } from '@playwright/test';
import { login, staffEmail } from './helpers';

test('invite a staff member in Admin and activate in a new browser context', async ({ page, browser }) => {
  await login(page);
  await page.goto('/en/staff');
  await page.getByRole('button', { name: 'Grant Staff Access' }).click();
  await page.getByRole('textbox', { name: 'Email' }).fill(staffEmail);
  await page.getByRole('textbox', { name: 'Username' }).fill('e2e-staff');
  await page.getByRole('combobox', { name: 'Role' }).click();
  await page.getByRole('option', { name: 'Analyst' }).click();
  await page.getByRole('dialog', { name: 'Grant Staff Access' }).getByRole('button', { name: 'Grant access' }).click();
  await page.getByRole('link', { name: 'e2e-staff' }).click();
  await page.getByRole('button', { name: 'Show invite link' }).click();
  const link = await page.getByRole('textbox', { name: 'Invite link' }).inputValue();
  const context = await browser.newContext();
  try {
    const invited = await context.newPage();
    await invited.goto(link);
    await invited.getByLabel('Password', { exact: true }).fill('StaffPassword123!');
    await invited.getByLabel('Confirm password').fill('StaffPassword123!');
    await invited.getByRole('button', { name: 'Activate account' }).click();
    await expect(invited.getByText('Your account is ready.')).toBeVisible();
    await login(invited, staffEmail, 'StaffPassword123!');
  } finally {
    await context.close();
  }
});
