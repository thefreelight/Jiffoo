import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { createTestApp } from '../helpers/create-test-app';
import { createTestUser, deleteAllTestUsers } from '../helpers/auth';
import { getTestPrisma } from '../helpers/db';
import { hashAuthToken, issueAuthToken } from '@/core/auth/auth-token';
import { env, envSchema } from '@/config/env';
import { PasswordUtils } from '@/utils/password';
import { generateCustomerResetLink, staffInviteLink } from '@/core/auth/account-recovery';

describe('Account recovery', () => {
  const prisma = getTestPrisma();
  let app: FastifyInstance;

  async function user() {
    return createTestUser({ email: `recovery-${randomUUID()}@example.com`, password: 'OldPassword123!' });
  }

  async function notificationLink(userId: string) {
    const item = await prisma.notification.findFirstOrThrow({
      where: { recipientUserId: userId, type: 'password_reset' },
      orderBy: { createdAt: 'desc' },
    });
    return (item.secretJson as { link: string }).link;
  }

  beforeAll(async () => { app = await createTestApp(); });
  afterAll(async () => { await deleteAllTestUsers(); await app.close(); });
  beforeEach(async () => { await deleteAllTestUsers(); });

  it('returns identical forgot responses and queues only the known account with storefront or Admin links', async () => {
    const account = await user();
    const unknown = await app.inject({
      method: 'POST', url: '/api/v1/auth/forgot-password',
      payload: { email: `missing-${randomUUID()}@example.com` },
    });
    const known = await app.inject({
      method: 'POST', url: '/api/v1/auth/forgot-password', payload: { email: account.email },
    });
    expect(known.statusCode).toBe(200);
    expect(known.json()).toEqual(unknown.json());
    const storefront = await notificationLink(account.id);
    expect(new URL(storefront).pathname).toBe('/en/reset-password');
    expect(storefront.startsWith(env.STOREFRONT_URL)).toBe(true);
    const token = new URL(storefront).searchParams.get('token')!;
    const row = await prisma.authToken.findUniqueOrThrow({ where: { tokenHash: hashAuthToken(token) } });
    expect(row.expiresAt.getTime() - row.createdAt.getTime()).toBeGreaterThan(60 * 60 * 1000 - 1000);
    expect(JSON.stringify(row)).not.toContain(token);
    expect(await prisma.notification.count({ where: { type: 'password_reset' } })).toBe(1);

    const admin = await app.inject({
      method: 'POST', url: '/api/v1/auth/forgot-password',
      payload: { email: account.email, app: 'admin' },
    });
    expect(admin.statusCode).toBe(200);
    const adminLink = await notificationLink(account.id);
    expect(adminLink.startsWith(env.ADMIN_URL)).toBe(true);
    expect(adminLink).toContain('/auth/reset-password?token=');
    expect((await prisma.authToken.findUniqueOrThrow({ where: { id: row.id } })).consumedAt).not.toBeNull();
  });

  it('K uses the customer locale for self-service and Admin reset links without changing staff links', async () => {
    const account = await user();
    const actor = await user();
    await prisma.user.update({ where: { id: account.id }, data: { locale: 'zh-Hant' } });
    const request = await app.inject({ method: 'POST', url: '/api/v1/auth/forgot-password', payload: { email: account.email } });
    expect(request.statusCode).toBe(200);
    expect(new URL(await notificationLink(account.id)).pathname).toBe('/zh-Hant/reset-password');
    const generated = await generateCustomerResetLink(account.id, actor.id);
    expect(new URL(generated).pathname).toBe('/zh-Hant/reset-password');
    expect(new URL(generated).searchParams.get('token')).toBeTruthy();
    expect(new URL(staffInviteLink('staff-token', 'zh-Hant')).pathname).toBe('/zh-Hant/auth/accept-invite');
    expect(new URL(staffInviteLink('staff-token', 'zh-Hant')).origin).toBe(new URL(env.ADMIN_URL).origin);
  });

  it('resets the password once and rejects reuse and expiry', async () => {
    const account = await user();
    await app.inject({ method: 'POST', url: '/api/v1/auth/forgot-password', payload: { email: account.email } });
    const token = new URL(await notificationLink(account.id)).searchParams.get('token')!;
    const reset = () => app.inject({
      method: 'POST', url: '/api/v1/auth/reset-password',
      payload: { token, newPassword: 'NewPassword123!' },
    });
    expect((await reset()).statusCode).toBe(200);
    expect((await reset()).statusCode).toBe(400);
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: account.id } });
    expect(await PasswordUtils.verify('NewPassword123!', updated.password)).toBe(true);
    expect(await PasswordUtils.verify('OldPassword123!', updated.password)).toBe(false);
    await app.inject({ method: 'POST', url: '/api/v1/auth/forgot-password', payload: { email: account.email } });
    const expired = new URL(await notificationLink(account.id)).searchParams.get('token')!;
    await prisma.authToken.update({
      where: { tokenHash: hashAuthToken(expired) }, data: { expiresAt: new Date(Date.now() - 1) },
    });
    expect((await app.inject({
      method: 'POST', url: '/api/v1/auth/reset-password',
      payload: { token: expired, newPassword: 'AnotherPassword123!' },
    })).statusCode).toBe(400);
  });

  it('allows exactly one concurrent reset to consume the same token', async () => {
    const account = await user();
    await app.inject({ method: 'POST', url: '/api/v1/auth/forgot-password', payload: { email: account.email } });
    const token = new URL(await notificationLink(account.id)).searchParams.get('token')!;
    const responses = await Promise.all([1, 2].map(() => app.inject({
      method: 'POST', url: '/api/v1/auth/reset-password',
      payload: { token, newPassword: 'ConcurrentPassword123!' },
    })));
    expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 400]);
  });

  it('keeps verification and invitation tokens independent and accepts an invitation within 72 hours', async () => {
    const account = await user();
    await prisma.user.update({ where: { id: account.id }, data: { role: 'ADMIN', isActive: false, emailVerified: false } });
    const [verify, invite] = await prisma.$transaction(async (tx) => [
      await issueAuthToken(tx, account.id, 'EMAIL_VERIFICATION', '123456'),
      await issueAuthToken(tx, account.id, 'STAFF_INVITE'),
    ]);
    const invitation = await prisma.authToken.findUniqueOrThrow({ where: { tokenHash: hashAuthToken(invite) } });
    expect(invitation.expiresAt.getTime() - invitation.createdAt.getTime()).toBeGreaterThan(72 * 60 * 60 * 1000 - 1000);
    expect((await prisma.authToken.findUniqueOrThrow({ where: { tokenHash: hashAuthToken(verify) } })).consumedAt).toBeNull();
    const accepted = await app.inject({
      method: 'POST', url: '/api/v1/auth/accept-invite',
      payload: { token: invite, password: 'InvitedPassword123!' },
    });
    expect(accepted.statusCode).toBe(200);
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: account.id } });
    expect(updated.emailVerified).toBe(true);
    expect(updated.isActive).toBe(true);
    expect(updated.role).toBe('ADMIN');
    expect(await PasswordUtils.verify('InvitedPassword123!', updated.password)).toBe(true);
    expect((await prisma.authToken.findUniqueOrThrow({ where: { id: invitation.id } })).consumedAt).not.toBeNull();
    expect((await app.inject({
      method: 'POST', url: '/api/v1/auth/accept-invite',
      payload: { token: invite, password: 'AnotherPassword123!' },
    })).statusCode).toBe(400);
    const expired = await prisma.$transaction((tx) => issueAuthToken(tx, account.id, 'STAFF_INVITE'));
    await prisma.authToken.update({
      where: { tokenHash: hashAuthToken(expired) }, data: { expiresAt: new Date(Date.now() - 1) },
    });
    expect((await app.inject({
      method: 'POST', url: '/api/v1/auth/accept-invite',
      payload: { token: expired, password: 'AnotherPassword123!' },
    })).statusCode).toBe(400);
  });

  it('requires ADMIN_URL in production and has no guest endpoint', async () => {
    expect(envSchema.safeParse({
      ...process.env, NODE_ENV: 'production', DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/jiffoo_core_test',
      JWT_SECRET: 'recovery-secret', STOREFRONT_URL: 'https://store.example', ADMIN_URL: undefined,
    }).success).toBe(false);
    expect((await app.inject({ method: 'POST', url: '/api/v1/auth/guest', payload: { installationId: randomUUID() } })).statusCode).toBe(404);
  });
});
