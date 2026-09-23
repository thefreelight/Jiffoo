import crypto from 'node:crypto';
import { prisma } from '@/config/database';
import { createNotification, verificationLink, type NotificationTransaction } from '@/core/notifications/service';
import { consumeAuthToken, hashVerificationCode, issueAuthToken } from '@/core/auth/auth-token';
import { staffInviteLink } from '@/core/auth/account-recovery';

export class EmailVerificationService {
  static generateCode(): string {
    return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  static async sendVerificationEmail(userId: string, email: string, username: string): Promise<{ success: boolean; error?: string }> {
    try {
      await prisma.$transaction((tx) => this.createVerification(tx, userId, email, username));
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to queue verification' };
    }
  }

  static async createVerification(tx: NotificationTransaction, userId: string, email: string, username: string, resentFromId?: string): Promise<void> {
    const code = this.generateCode();
    const token = await issueAuthToken(tx, userId, 'EMAIL_VERIFICATION', code);
    await createNotification(tx, 'email_verification', userId, email, { name: username }, {
      secret: { link: verificationLink(token), code },
      relatedType: 'user', relatedId: userId, resentFromId,
    });
  }

  static async verifyToken(token: string): Promise<{ success: boolean; error?: string }> {
    try {
      await prisma.$transaction(async (tx) => {
        const row = await consumeAuthToken(tx, token, 'EMAIL_VERIFICATION');
        const updated = await tx.user.updateMany({ where: { id: row.userId, emailVerified: false }, data: { emailVerified: true } });
        if (updated.count !== 1) throw new Error('Email is already verified');
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to verify email' };
    }
  }

  static async verifyCode(email: string, code: string): Promise<{ success: boolean; error?: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !/^\d{6}$/.test(code.trim())) {
      return { success: false, error: 'Invalid email or verification code' };
    }
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) return { success: false, error: 'Invalid email or verification code' };
    if (user.emailVerified) return { success: false, error: 'Email is already verified' };
    const row = await prisma.authToken.findFirst({
      where: { userId: user.id, purpose: 'EMAIL_VERIFICATION', consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!row || row.expiresAt <= new Date() || row.attempts >= 5 || !row.codeHash) {
      return { success: false, error: 'Verification code has expired' };
    }
    const expected = hashVerificationCode(row.tokenHash, code.trim());
    if (!crypto.timingSafeEqual(Buffer.from(row.codeHash, 'hex'), Buffer.from(expected, 'hex'))) {
      const result = await prisma.authToken.updateMany({
        where: { id: row.id, consumedAt: null, attempts: row.attempts },
        data: { attempts: { increment: 1 }, ...(row.attempts >= 4 ? { consumedAt: new Date() } : {}) },
      });
      if (result.count !== 1) return { success: false, error: 'Invalid email or verification code' };
      return { success: false, error: row.attempts >= 4 ? 'Too many attempts. Request a new verification code' : 'Invalid email or verification code' };
    }
    try {
      await prisma.$transaction(async (tx) => {
        const claimed = await tx.authToken.updateMany({
          where: { id: row.id, consumedAt: null, expiresAt: { gt: new Date() }, attempts: { lt: 5 } },
          data: { consumedAt: new Date() },
        });
        if (claimed.count !== 1) throw new Error('Invalid email or verification code');
        await tx.user.update({ where: { id: user.id }, data: { emailVerified: true } });
      });
      return { success: true };
    } catch {
      return { success: false, error: 'Invalid email or verification code' };
    }
  }

  static async resendVerificationEmail(email: string): Promise<{ success: boolean; error?: string }> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return { success: false, error: 'User not found' };
    if (user.emailVerified) return { success: false, error: 'Email is already verified' };
    return this.sendVerificationEmail(user.id, user.email, user.username);
  }

  static async sendStaffInvitationEmail(userId: string, email: string, username: string): Promise<{ success: boolean; error?: string }> {
    try {
      await prisma.$transaction((tx) => this.createStaffInvitation(tx, userId, email, username));
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to queue invitation' };
    }
  }

  static async createStaffInvitation(tx: NotificationTransaction, userId: string, email: string, username: string, resentFromId?: string): Promise<void> {
    const token = await issueAuthToken(tx, userId, 'STAFF_INVITE');
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { locale: true } });
    await createNotification(tx, 'staff_invite', userId, email, { name: username }, {
      secret: { link: staffInviteLink(token, user.locale) },
      relatedType: 'user', relatedId: userId, resentFromId,
    });
  }
}
