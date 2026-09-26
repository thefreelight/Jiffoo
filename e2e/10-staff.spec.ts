import { expect, test } from './local-requests';
import { login, staffEmail } from './helpers';

test('I invite, activate and remove a second administrator', async ({ page, browser }) => {
  await login(page);
  await page.goto('/en/staff');
  await expect(page.getByRole('heading', { name: 'Administrators' })).toBeVisible();
  const installer = page.getByRole('row').filter({ hasText: 'Install administrator' });
  await expect(installer).toBeVisible();
  await expect(installer.getByRole('button', { name: /Remove/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Invite administrator' }).click();
  const dialog = page.getByRole('dialog', { name: 'Invite administrator' });
  await dialog.getByRole('textbox', { name: 'Email' }).fill(staffEmail);
  await dialog.getByRole('textbox', { name: 'Username' }).fill('e2e-admin');
  await dialog.getByRole('button', { name: 'Send invitation' }).click();
  await expect(page.getByRole('link', { name: 'e2e-admin' })).toBeVisible();
  await page.getByRole('link', { name: 'e2e-admin' }).click();
  await page.getByRole('button', { name: 'Generate invitation link' }).click();
  const link = await page.getByRole('textbox', { name: 'Invitation link' }).inputValue();

  const context = await browser.newContext();
  try {
    const invited = await context.newPage();
    await invited.goto(link);
    await invited.getByLabel('Password', { exact: true }).fill('StaffPassword123!');
    await invited.getByLabel('Confirm password').fill('StaffPassword123!');
    await invited.getByRole('button', { name: 'Activate account' }).click();
    await expect(invited.getByText('Your account is ready.')).toBeVisible();
    await login(invited, staffEmail, 'StaffPassword123!');
    for (const name of ['Dashboard', 'Products', 'Orders', 'Notifications', 'Customers', 'Administrators', 'Plugins', 'System Health']) {
      await expect(invited.getByRole('link', { name, exact: true })).toBeVisible();
    }
    await invited.getByRole('link', { name: 'Administrators' }).click();
    const ownRow = invited.getByRole('row').filter({ hasText: staffEmail });
    await expect(ownRow).toBeVisible();
    await expect(ownRow.getByRole('button', { name: /Remove/ })).toHaveCount(0);

    await page.goto('/en/staff');
    const row = page.getByRole('row').filter({ hasText: staffEmail });
    await row.getByRole('button', { name: 'Remove e2e-admin' }).click();
    await page.getByRole('dialog', { name: 'Remove administrator?' })
      .getByRole('button', { name: 'Remove administrator' }).click();
    await expect(row.getByRole('button', { name: 'Remove e2e-admin' })).toHaveCount(0);
    await invited.getByRole('link', { name: 'Products' }).click();
    await expect(invited).toHaveURL(/\/en\/auth\/login/);
  } finally {
    await context.close();
  }
});
