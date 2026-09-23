import { prisma } from '@/config/database';
import { env } from '@/config/env';
import { issueAuthToken, consumeAuthToken } from './auth-token';
import { createNotification } from '@/core/notifications/service';
import { PasswordUtils } from '@/utils/password';
import { normalizeNotificationLocale } from '@/core/notifications/service';

export function passwordResetLink(token: string, app: 'storefront' | 'admin' = 'storefront', locale?: string | null): string {
  const base = app === 'admin' ? env.ADMIN_URL : env.STOREFRONT_URL;
  const pathname = app === 'admin' ? `/${normalizeNotificationLocale(locale) || 'en'}/auth/reset-password` : '/reset-password';
  return `${base.replace(/\/$/, '')}${pathname}?token=${encodeURIComponent(token)}`;
}

export function staffInviteLink(token: string, locale?: string | null): string {
  return `${env.ADMIN_URL.replace(/\/$/, '')}/${normalizeNotificationLocale(locale) || 'en'}/auth/accept-invite?token=${encodeURIComponent(token)}`;
}

export async function requestPasswordReset(email: string, app: 'storefront' | 'admin' = 'storefront'): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user || !user.isActive) return;
  await prisma.$transaction(async (tx) => {
    const token = await issueAuthToken(tx, user.id, 'PASSWORD_RESET');
    await createNotification(tx, 'password_reset', user.id, user.email, { name: user.username }, {
      secret: { link: passwordResetLink(token, app, user.locale) }, relatedType: 'user', relatedId: user.id,
    });
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const password = await PasswordUtils.hash(newPassword);
  await prisma.$transaction(async (tx) => {
    const row = await consumeAuthToken(tx, token, 'PASSWORD_RESET');
    await tx.user.update({ where: { id: row.userId }, data: { password } });
    await tx.authToken.updateMany({
      where: { userId: row.userId, purpose: 'PASSWORD_RESET', consumedAt: null },
      data: { consumedAt: new Date() },
    });
  });
}

export async function acceptStaffInvite(token: string, passwordInput: string): Promise<void> {
  const password = await PasswordUtils.hash(passwordInput);
  await prisma.$transaction(async (tx) => {
    const row = await consumeAuthToken(tx, token, 'STAFF_INVITE');
    await tx.user.update({ where: { id: row.userId }, data: { password, emailVerified: true } });
  });
}

export async function generateCustomerResetLink(userId: string, actorUserId: string): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const actor = await tx.user.findUniqueOrThrow({ where: { id: actorUserId } });
    const token = await issueAuthToken(tx, user.id, 'PASSWORD_RESET');
    await tx.adminStaffAuditLog.create({
      data: {
        staffUserId: user.id, staffEmail: user.email, staffUsername: user.username,
        actorUserId: actor.id, actorEmail: actor.email, actorUsername: actor.username,
        action: 'CUSTOMER_PASSWORD_RESET_LINK_GENERATED',
      },
    });
    return passwordResetLink(token, 'storefront', user.locale);
  });
}

export async function generateStaffInviteLink(userId: string): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const member = await tx.adminMembership.findUnique({ where: { userId }, include: { user: true } });
    if (!member || member.user.emailVerified) throw new Error('Staff invitation not available');
    return staffInviteLink(await issueAuthToken(tx, userId, 'STAFF_INVITE'), member.user.locale);
  });
}
