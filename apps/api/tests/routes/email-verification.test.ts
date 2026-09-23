import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import { createTestUser, deleteAllTestUsers } from '../helpers/auth';
import { getTestPrisma } from '../helpers/db';
import { hashAuthToken } from '@/core/auth/auth-token';
import { EmailVerificationService } from '@/services/email-verification.service';
import { randomUUID } from 'node:crypto';

describe('Email Verification Endpoints', () => {
  let app: FastifyInstance;
  const prisma = getTestPrisma();

  async function unverifiedUser() {
    return createTestUser({ email: `verify-${randomUUID()}@example.com`, emailVerified: false });
  }

  async function latestToken(userId: string) {
    const notification = await prisma.notification.findFirst({
      where: { recipientUserId: userId, type: 'email_verification' }, orderBy: { createdAt: 'desc' },
    });
    const secret = notification?.secretJson as { link?: string; code?: string } | null;
    expect(secret?.link).toBeTruthy();
    return { token: new URL(secret!.link!).searchParams.get('token')!, code: secret!.code! };
  }

  beforeAll(async () => { app = await createTestApp(); });
  afterAll(async () => { await deleteAllTestUsers(); await app.close(); });
  beforeEach(async () => { await deleteAllTestUsers(); });

  it('verifies a token within 24 hours and consumes its hashed row', async () => {
    const user = await unverifiedUser();
    expect((await EmailVerificationService.sendVerificationEmail(user.id, user.email, user.username)).success).toBe(true);
    const { token } = await latestToken(user.id);
    const row = await prisma.authToken.findUniqueOrThrow({ where: { tokenHash: hashAuthToken(token) } });
    expect(row.expiresAt.getTime() - row.createdAt.getTime()).toBeGreaterThan(24 * 60 * 60 * 1000 - 1000);
    expect(JSON.stringify(row)).not.toContain(token);

    const response = await app.inject({ method: 'GET', url: `/api/v1/auth/verify-email?token=${token}` });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ success: true, message: 'Email verified successfully' });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerified).toBe(true);
    expect((await prisma.authToken.findUniqueOrThrow({ where: { id: row.id } })).consumedAt).not.toBeNull();
    const again = await app.inject({ method: 'GET', url: `/api/v1/auth/verify-email?token=${token}` });
    expect(again.statusCode).toBe(400);
    expect(again.json().error.code).toBe('VERIFICATION_FAILED');
    const resend = await app.inject({
      method: 'POST', url: '/api/v1/auth/resend-verification', payload: { email: user.email },
    });
    expect(resend.statusCode).toBe(400);
    expect(resend.json().error.message).toContain('already verified');
  });

  it('rejects missing, empty, and invalid tokens', async () => {
    const missing = await app.inject({ method: 'GET', url: '/api/v1/auth/verify-email' });
    expect(missing.statusCode).toBe(400);
    expect(missing.json().error.code).toBe('TOKEN_REQUIRED');
    expect((await app.inject({ method: 'GET', url: '/api/v1/auth/verify-email?token=' })).statusCode).toBe(400);
    const invalid = await app.inject({ method: 'GET', url: '/api/v1/auth/verify-email?token=invalid' });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json().error.code).toBe('VERIFICATION_FAILED');
  });

  it('rejects an expired token', async () => {
    const user = await unverifiedUser();
    await EmailVerificationService.sendVerificationEmail(user.id, user.email, user.username);
    const { token } = await latestToken(user.id);
    await prisma.authToken.update({ where: { tokenHash: hashAuthToken(token) }, data: { expiresAt: new Date(Date.now() - 1) } });
    const response = await app.inject({ method: 'GET', url: `/api/v1/auth/verify-email?token=${token}` });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.message).toContain('expired');
  });

  it('resends a new token and invalidates only the previous verification token', async () => {
    const user = await unverifiedUser();
    await EmailVerificationService.sendVerificationEmail(user.id, user.email, user.username);
    const first = (await latestToken(user.id)).token;
    const response = await app.inject({ method: 'POST', url: '/api/v1/auth/resend-verification', payload: { email: user.email } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ success: true, message: 'Verification requested' });
    const second = (await latestToken(user.id)).token;
    expect(second).not.toBe(first);
    expect((await prisma.authToken.findUniqueOrThrow({ where: { tokenHash: hashAuthToken(first) } })).consumedAt).not.toBeNull();
    const secondRow = await prisma.authToken.findUniqueOrThrow({ where: { tokenHash: hashAuthToken(second) } });
    expect(secondRow.consumedAt).toBeNull();
    expect(secondRow.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect((await app.inject({ method: 'GET', url: `/api/v1/auth/verify-email?token=${first}` })).statusCode).toBe(400);
    expect((await app.inject({ method: 'GET', url: `/api/v1/auth/verify-email?token=${second}` })).statusCode).toBe(200);
  });

  it('rejects resend for missing or already verified accounts', async () => {
    const verified = await createTestUser({ email: `verified-${randomUUID()}@example.com`, emailVerified: true });
    for (const email of ['missing@example.com', verified.email, '', 'not-a-valid-email']) {
      expect((await app.inject({ method: 'POST', url: '/api/v1/auth/resend-verification', payload: { email } })).statusCode).toBe(400);
    }
    expect((await app.inject({ method: 'POST', url: '/api/v1/auth/resend-verification', payload: {} })).statusCode).toBe(400);
  });
});
