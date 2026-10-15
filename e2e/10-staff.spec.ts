import { expect, test } from './local-requests';
import { customerEmail, login, ownerEmail, staffEmail } from './helpers';
import { captureStaffPage } from './staff-captures';
import { getTestPrisma, disconnectDatabase } from '../apps/api/tests/helpers/db';
import type { Page } from '@playwright/test';

async function invite(page: Page, email: string, name: string) {
  await page.goto('/en/staff');
  await page.getByRole('button', { name: 'Invite administrator', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Invite administrator', exact: true });
  await dialog.getByLabel('Email', { exact: true }).fill(email);
  await dialog.getByLabel('Name', { exact: true }).fill(name);
  await dialog.getByRole('button', { name: 'Send invitation', exact: true }).click();
  return dialog;
}
async function copyInvite(page: Page, expired = false) {
  await page.getByRole('button', { name: expired ? 'Copy new invitation link' : 'Copy invitation link', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Invitation link', exact: true });
  const link = await panel.getByRole('textbox', { name: 'Invitation link', exact: true }).inputValue();
  await panel.getByRole('button', { name: 'Copy link', exact: true }).click();
  await expect(panel.getByText('Copied', { exact: true })).toBeVisible();
  return link;
}
async function accept(page: Page, link: string, password = 'StaffPassword123!') {
  await page.goto(link);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Activate account', exact: true }).click();
}

test('administrator invite, revoke, removal, re-invite, protected accounts and activity history', async ({ page, newObservedContext }) => {
  test.setTimeout(240000);
  await page.context().grantPermissions(['clipboard-write']);
  const db = getTestPrisma(), context = await newObservedContext();
  try {
    await login(page);
    const owner = await db.user.findUniqueOrThrow({ where: { email: ownerEmail } });
    await page.goto('/en/staff/' + owner.id);
    await page.getByRole('button', { name: 'More actions: ' + owner.username, exact: true }).click();
    await expect(page.getByRole('menuitem', { name: /^Remove administrator/ })).toBeDisabled();
    await expect(page.getByText('The owner created during installation cannot be removed, and you cannot remove yourself.', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await captureStaffPage(page, 'detail', 'owner', owner.username);
    await invite(page, staffEmail, 'e2e-admin');
    await page.getByRole('link', { name: new RegExp('e2e-admin.*' + staffEmail) }).click();
    await expect(page.getByRole('button', { name: 'Copy invitation link', exact: true })).toBeVisible();
    const detail = page.url();
    await captureStaffPage(page, 'detail', 'invited', 'e2e-admin');
    await page.goto('/en/staff');
    await captureStaffPage(page, 'list', 'populated', '管理员');
    await page.getByRole('row', { name: new RegExp('e2e-admin.*' + staffEmail) }).click();
    const account = await db.user.findUniqueOrThrow({ where: { email: staffEmail } });
    await db.authToken.updateMany({ where: { userId: account.id, purpose: 'STAFF_INVITE', consumedAt: null }, data: { expiresAt: new Date(Date.now() - 86400000) } });
    await page.reload();
    await expect(page.getByRole('button', { name: 'Copy new invitation link', exact: true })).toBeVisible();
    await captureStaffPage(page, 'detail', 'expired', 'e2e-admin');
    const link = await copyInvite(page, true);
    const invited = await context.newPage();
    await accept(invited, link);
    await expect(invited.getByText('Your account is ready.', { exact: true })).toBeVisible();
    await login(invited, staffEmail, 'StaffPassword123!');
    await page.goto(detail);
    await expect(page.getByRole('region', { name: 'Activity', exact: true }).getByText('Accepted the invitation and set a password', { exact: true })).toBeVisible();
    await captureStaffPage(page, 'detail', 'active', 'e2e-admin');
    await invited.goto('/en/staff/' + account.id);
    await invited.getByRole('button', { name: 'More actions: e2e-admin', exact: true }).click();
    await expect(invited.getByRole('menuitem', { name: /^Remove administrator/ })).toBeDisabled();
    await invited.keyboard.press('Escape');
    await page.getByRole('button', { name: 'More actions: e2e-admin', exact: true }).click();
    await page.getByRole('menuitem', { name: /^Remove administrator/ }).click();
    await page.getByRole('alertdialog', { name: 'Remove administrator “e2e-admin”?', exact: true }).getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Re-invite', exact: true })).toBeVisible();
    await expect(invited).toHaveURL(/\/en\/auth\/login/);
    await captureStaffPage(page, 'detail', 'removed', 'e2e-admin');
    const duplicate = await invite(page, staffEmail, 'e2e-admin');
    await expect(duplicate.getByText('This email belongs to a removed administrator. Re-invite them from their detail page.', { exact: true })).toBeVisible();
    await duplicate.getByRole('button', { name: 'Cancel', exact: true }).click();
    const customer = await invite(page, customerEmail, 'Customer');
    await expect(customer.getByText('This email belongs to a customer. Use a different email to invite an administrator.', { exact: true })).toBeVisible();
    await customer.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.goto(detail);
    await page.getByRole('button', { name: 'Re-invite', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Copy invitation link', exact: true })).toBeVisible();
    const newLink = await copyInvite(page);
    await accept(invited, link);
    await expect(invited.getByText('Invalid invite token.', { exact: true })).toBeVisible();
    await accept(invited, newLink);
    await expect(invited.getByText('Your account is ready.', { exact: true })).toBeVisible();
    await page.reload();
    const activity = page.getByRole('region', { name: 'Activity', exact: true });
    await expect(activity.getByText('Invited as an administrator', { exact: true })).toHaveCount(1);
    await expect(activity.getByText('Accepted the invitation and set a password', { exact: true })).toHaveCount(2);
    await expect(activity.getByText('Removed', { exact: true })).toHaveCount(1);
    await expect(activity.getByText('Re-invited as an administrator', { exact: true })).toHaveCount(1);
    const revokedEmail = 'revoked@e2e.example';
    await invite(page, revokedEmail, 'e2e-revoked');
    await page.getByRole('link', { name: new RegExp('e2e-revoked.*' + revokedEmail) }).click();
    const revokedLink = await copyInvite(page);
    await page.getByRole('button', { name: 'More actions: e2e-revoked', exact: true }).click();
    await page.getByRole('menuitem', { name: /^Revoke invitation/ }).click();
    await page.getByRole('alertdialog', { name: 'Remove administrator “e2e-revoked”?', exact: true }).getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Re-invite', exact: true })).toBeVisible();
    await accept(invited, revokedLink);
    await expect(invited.getByText('Invalid invite token.', { exact: true })).toBeVisible();
  } finally { await context.close(); await disconnectDatabase(); }
});
