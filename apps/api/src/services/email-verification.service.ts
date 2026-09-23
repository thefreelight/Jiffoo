/**
 * Email Verification Service
 *
 * Handles user email verification tokens and queues persisted notifications.
 */

import crypto from 'crypto';
import { prisma } from '@/config/database';
import { env } from '@/config/env';
import { createNotification, verificationLink, type NotificationTransaction } from '@/core/notifications/service';

export class EmailVerificationService {
  private static readonly CODE_TTL_MINUTES = 10;
  private static readonly MAX_CODE_ATTEMPTS = 5;
  private static readonly CODE_TOKEN_PREFIX = 'v1';

  /**
   * Generate a cryptographically secure verification token
   */
  static generateToken(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Calculate token expiry time (24 hours from now)
   */
  static getTokenExpiry(): Date {
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + 24);
    return expiry;
  }

  static generateCode(): string {
    return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  private static getCodeExpiry(): Date {
    return new Date(Date.now() + this.CODE_TTL_MINUTES * 60 * 1000);
  }

  private static hashCode(token: string, code: string): string {
    return crypto.createHmac('sha256', env.JWT_SECRET).update(`${token}:${code}`).digest('hex');
  }

  private static encodeCodeToken(token: string, code: string, attempts = 0): string {
    return [this.CODE_TOKEN_PREFIX, token, this.hashCode(token, code), attempts].join(':');
  }

  private static decodeCodeToken(value: string | null): { token: string; codeHash: string; attempts: number } | null {
    if (!value) return null;
    const [prefix, token, codeHash, attemptsValue] = value.split(':');
    const attempts = Number(attemptsValue);
    if (prefix !== this.CODE_TOKEN_PREFIX || !token || !/^[a-f0-9]{64}$/.test(codeHash || '') || !Number.isInteger(attempts) || attempts < 0) {
      return null;
    }
    return { token, codeHash, attempts };
  }

  /**
   * Queue verification notification for a user
   */
  static async sendVerificationEmail(
    userId: string,
    email: string,
    username: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await prisma.$transaction((tx) => this.createVerification(tx, userId, email, username));
      return { success: true };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to queue verification email',
      };
    }
  }

  static async createVerification(tx: NotificationTransaction, userId: string, email: string, username: string, resentFromId?: string): Promise<void> {
    const token = this.generateToken();
    const code = this.generateCode();
    await tx.user.update({
      where: { id: userId },
      data: { verificationToken: this.encodeCodeToken(token, code), verificationTokenExpiry: this.getCodeExpiry() },
    });
    await createNotification(tx, 'email_verification', userId, email, { name: username }, {
      secret: { link: verificationLink(token), code },
      relatedType: 'user', relatedId: userId, resentFromId,
    });
  }

  /**
   * Verify email token and mark user as verified
   */
  static async verifyToken(token: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!token) {
        throw new Error('Verification token is required');
      }

      let user = await prisma.user.findFirst({
        where: { verificationToken: token },
      });

      if (!user) {
        user = await prisma.user.findFirst({
          where: { verificationToken: { startsWith: `${this.CODE_TOKEN_PREFIX}:${token}:` } },
        });
      }

      if (!user) {
        throw new Error('Invalid verification token');
      }

      if (user.emailVerified) {
        return {
          success: false,
          error: 'Email is already verified',
        };
      }

      if (!user.verificationTokenExpiry || user.verificationTokenExpiry < new Date()) {
        throw new Error('Verification token has expired');
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
          verificationToken: null,
          verificationTokenExpiry: null,
        },
      });

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to verify email',
      };
    }
  }

  static async verifyCode(email: string, code: string): Promise<{ success: boolean; error?: string }> {
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const normalizedCode = code.trim();
      if (!normalizedEmail) throw new Error('Email address is required');
      if (!/^\d{6}$/.test(normalizedCode)) throw new Error('Verification code must be 6 digits');

      const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (!user) throw new Error('Invalid email or verification code');
      if (user.emailVerified) throw new Error('Email is already verified');
      if (!user.verificationTokenExpiry || user.verificationTokenExpiry < new Date()) throw new Error('Verification code has expired');

      const stored = this.decodeCodeToken(user.verificationToken);
      if (!stored) throw new Error('Request a new verification code');
      const expectedHash = this.hashCode(stored.token, normalizedCode);
      const matches = crypto.timingSafeEqual(Buffer.from(stored.codeHash, 'hex'), Buffer.from(expectedHash, 'hex'));

      if (!matches) {
        const attempts = stored.attempts + 1;
        await prisma.user.update({
          where: { id: user.id },
          data: attempts >= this.MAX_CODE_ATTEMPTS
            ? { verificationToken: null, verificationTokenExpiry: null }
            : { verificationToken: [this.CODE_TOKEN_PREFIX, stored.token, stored.codeHash, attempts].join(':') },
        });
        if (attempts >= this.MAX_CODE_ATTEMPTS) throw new Error('Too many attempts. Request a new verification code');
        throw new Error('Invalid email or verification code');
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true, verificationToken: null, verificationTokenExpiry: null },
      });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to verify email' };
    }
  }

  /**
   * Queue a fresh verification notification for a user
   */
  static async resendVerificationEmail(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        throw new Error('User not found');
      }

      if (user.emailVerified) {
        throw new Error('Email is already verified');
      }

      return await this.sendVerificationEmail(user.id, user.email, user.username);
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to resend verification email',
      };
    }
  }

  /**
   * Queue a staff invitation notification.
   */
  static async sendStaffInvitationEmail(
    userId: string,
    email: string,
    username: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await prisma.$transaction((tx) => this.createStaffInvitation(tx, userId, email, username));
      return { success: true };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to queue staff invitation',
      };
    }
  }

  static async createStaffInvitation(tx: NotificationTransaction, userId: string, email: string, username: string, resentFromId?: string): Promise<void> {
    const token = this.generateToken();
    await tx.user.update({
      where: { id: userId },
      data: { verificationToken: token, verificationTokenExpiry: this.getTokenExpiry() },
    });
    await createNotification(tx, 'staff_invite', userId, email, { name: username }, {
      secret: { link: verificationLink(token) },
      relatedType: 'user', relatedId: userId, resentFromId,
    });
  }

}
