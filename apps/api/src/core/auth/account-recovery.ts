import { ApiError, knownPrismaOperation } from '@/utils/api-errors';
import { Prisma } from '@prisma/client';
import { prisma } from '@/config/database';
import { env } from '@/config/env';
import { issueAuthToken, consumeAuthToken, hashAuthToken } from './auth-token';
import { createNotification } from '@/core/notifications/service';
import { PasswordUtils } from '@/utils/password';
import { normalizeNotificationLocale } from '@/core/notifications/service';
import { AuditService } from '@/core/audit/service';
import { setTimeout as delay } from 'node:timers/promises';

export function passwordResetLink(token: string, app: 'storefront' | 'admin' = 'storefront', locale?: string | null): string {
  const base = app === 'admin' ? env.ADMIN_URL : env.STOREFRONT_URL;
  const pathname = app === 'admin' ? `/${normalizeNotificationLocale(locale) || 'en'}/auth/reset-password` : `/${normalizeNotificationLocale(locale) || 'en'}/reset-password`;
  return `${base.replace(/\/$/, '')}${pathname}?token=${encodeURIComponent(token)}`;
}

export function staffInviteLink(token: string, locale?: string | null): string {
  return `${env.ADMIN_URL.replace(/\/$/, '')}/${normalizeNotificationLocale(locale) || 'en'}/auth/accept-invite?token=${encodeURIComponent(token)}`;
}

export async function requestPasswordReset(email: string, app: 'storefront' | 'admin' = 'storefront'): Promise<void> {
  const started = performance.now();
  try {
    const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user || !user.isActive || user.role !== (app === 'admin' ? 'ADMIN' : 'USER') || user.removedAt) return;
    await prisma.$transaction(async (tx) => {
      const token = await issueAuthToken(tx, user.id, 'PASSWORD_RESET');
      await createNotification(tx, 'password_reset', user.id, user.email, { name: user.username }, {
        secret: { link: passwordResetLink(token, app, user.locale) }, relatedType: 'user', relatedId: user.id,
      });
    });
  } finally {
    // Keep successful known and unknown lookups in the same response timing class.
    await delay(Math.max(0, 500 - (performance.now() - started)));
  }
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const password = await PasswordUtils.hash(newPassword);
  await prisma.$transaction(async (tx) => {
    const row = await consumeAuthToken(tx, token, 'PASSWORD_RESET');
    const account = await tx.user.findUniqueOrThrow({ where: { id: row.userId }, select: { role: true } });
    if (account.role === 'ADMIN' && newPassword.length < 8) throw new ApiError('VALIDATION_ERROR');
    await tx.user.update({ where: { id: row.userId }, data: { password, sessionVersion: { increment: 1 } } });
    await tx.authToken.updateMany({
      where: { userId: row.userId, purpose: 'PASSWORD_RESET', consumedAt: null },
      data: { consumedAt: new Date() },
    });
  });
}

export async function lookupRecoveryToken(token: string, purpose: 'STAFF_INVITE' | 'PASSWORD_RESET') {
  const reject = () => new ApiError(purpose === 'STAFF_INVITE' ? 'INVALID_INVITE_TOKEN' : 'INVALID_RESET_TOKEN');
  const row = await prisma.authToken.findUnique({
    where: { tokenHash: hashAuthToken(token) },
    include: { user: { select: { email: true, role: true, isActive: true, removedAt: true } } },
  });
  if (!row || row.purpose !== purpose || row.consumedAt || row.expiresAt <= new Date() || row.attempts >= 5) throw reject();
  if (purpose === 'STAFF_INVITE') {
    if (row.user.role !== 'ADMIN' || row.user.isActive || row.user.removedAt) throw reject();
    const system = await prisma.systemSettings.findUnique({ where: { id: 'system' }, select: { settings: true } });
    const settings = system?.settings as Record<string, unknown> | null;
    return { email: row.user.email, storeName: typeof settings?.['branding.platform_name'] === 'string' ? settings['branding.platform_name'] : '' };
  }
  return { valid: true };
}

export async function acceptStaffInvite(token: string, passwordInput: string): Promise<void> {
  const password = await PasswordUtils.hash(passwordInput);
  await prisma.$transaction(async (tx) => {
    const candidate = await tx.authToken.findUnique({ where: { tokenHash: hashAuthToken(token) }, select: { userId: true, purpose: true } });
    if (!candidate || candidate.purpose !== 'STAFF_INVITE') throw new ApiError('INVALID_INVITE_TOKEN');
    await tx.$queryRaw(Prisma.sql`SELECT id FROM public.users WHERE id = ${candidate.userId} FOR UPDATE`);
    const row = await consumeAuthToken(tx, token, 'STAFF_INVITE');
    const user = await tx.user.findUnique({ where: { id: row.userId } });
    if (!user || user.role !== 'ADMIN' || user.isActive || user.removedAt) throw new ApiError('INVALID_INVITE_TOKEN');
    if (passwordInput.length < 8) throw new ApiError('VALIDATION_ERROR');
    await tx.user.update({ where: { id: row.userId, role: 'ADMIN' }, data: { password, emailVerified: true, isActive: true, sessionVersion: { increment: 1 } } });
    await AuditService.writeStaffAudit(tx, { staffUserId: user.id, staffEmail: user.email, staffUsername: user.username,
      actorUserId: user.id, actorEmail: user.email, actorUsername: user.username, action: 'ADMIN_INVITE_ACCEPTED' });
  });
}

export class AccountRecoveryService {
  static async generateCustomerResetLink(userId: string, actorUserId: string): Promise<string> {
    return prisma.$transaction(async (tx) => {
      const user = await knownPrismaOperation(() => tx.user.findUniqueOrThrow({ where: { id: userId } }), { notFound: 'NOT_FOUND' });
      if (user.role === 'ADMIN') throw new ApiError('NOT_FOUND');
      const actor = await knownPrismaOperation(() => tx.user.findUniqueOrThrow({ where: { id: actorUserId } }), { notFound: 'NOT_FOUND' });
      const token = await issueAuthToken(tx, user.id, 'PASSWORD_RESET');
      await AuditService.writeStaffAudit(tx, {
        staffUserId: user.id, staffEmail: user.email, staffUsername: user.username,
        actorUserId: actor.id, actorEmail: actor.email, actorUsername: actor.username,
        action: 'CUSTOMER_PASSWORD_RESET_LINK_GENERATED',
      });
      return passwordResetLink(token, 'storefront', user.locale);
    });
  }

  static async generateStaffInviteLink(userId: string): Promise<string> {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM public.users WHERE id = ${userId} FOR UPDATE`);
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user || user.role !== 'ADMIN' || user.removedAt || user.isActive) throw new ApiError('INVITE_NOT_AVAILABLE');
      return staffInviteLink(await issueAuthToken(tx, userId, 'STAFF_INVITE'), user.locale);
    });
  }
}
