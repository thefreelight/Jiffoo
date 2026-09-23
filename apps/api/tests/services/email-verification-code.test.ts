import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/config/database';
import { createTestUser, deleteAllTestUsers } from '../helpers/auth';
import { EmailVerificationService } from '@/services/email-verification.service';

describe('EmailVerificationService code flow', () => {
  beforeEach(async () => { await deleteAllTestUsers(); });
  afterAll(async () => { await deleteAllTestUsers(); });

  async function issue() {
    const user = await createTestUser({ email: `code-${randomUUID()}@example.com`, emailVerified: false });
    expect((await EmailVerificationService.sendVerificationEmail(user.id, user.email, user.username)).success).toBe(true);
    const notification = await prisma.notification.findFirstOrThrow({
      where: { recipientUserId: user.id, type: 'email_verification' },
      orderBy: { createdAt: 'desc' },
    });
    const { code, link } = notification.secretJson as { code: string; link: string };
    const row = await prisma.authToken.findFirstOrThrow({
      where: { userId: user.id, purpose: 'EMAIL_VERIFICATION', consumedAt: null },
    });
    return { user, row, code, link };
  }

  it('stores a code digest and queues the six-digit code only in secret content', async () => {
    const { row, code, link } = await issue();
    expect(code).toMatch(/^\d{6}$/);
    expect(row.codeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(row)).not.toContain(code);
    expect(JSON.stringify(row)).not.toContain(new URL(link).searchParams.get('token'));
  });

  it('verifies the emailed code and consumes its token', async () => {
    const { user, row, code } = await issue();
    expect(await EmailVerificationService.verifyCode(user.email, code)).toEqual({ success: true });
    expect((await prisma.authToken.findUniqueOrThrow({ where: { id: row.id } })).consumedAt).not.toBeNull();
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerified).toBe(true);
  });

  it('locks the code after five wrong attempts', async () => {
    const { user, row, code } = await issue();
    const wrong = code === '000000' ? '999999' : '000000';
    for (let attempt = 0; attempt < 5; attempt++) {
      expect((await EmailVerificationService.verifyCode(user.email, wrong)).success).toBe(false);
    }
    expect((await prisma.authToken.findUniqueOrThrow({ where: { id: row.id } })).attempts).toBe(5);
    expect((await EmailVerificationService.verifyCode(user.email, code)).success).toBe(false);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerified).toBe(false);
  });

  it('rejects an expired code', async () => {
    const { user, row, code } = await issue();
    await prisma.authToken.update({ where: { id: row.id }, data: { expiresAt: new Date(Date.now() - 1) } });
    const wrong = code === '000000' ? '999999' : '000000';
    expect(await EmailVerificationService.verifyCode(user.email, wrong)).toEqual({
      success: false, error: 'Verification code has expired',
    });
    expect((await prisma.authToken.findUniqueOrThrow({ where: { id: row.id } })).attempts).toBe(0);
  });
});
