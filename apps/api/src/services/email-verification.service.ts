/**
 * Email Verification Service
 *
 * Handles user email verification tokens and notification sending.
 * Sends through the installed email plugin and fails explicitly when delivery
 * cannot be accepted.
 */

import crypto from 'crypto';
import { prisma } from '@/config/database';
import { env } from '@/config/env';
import { TransactionalEmailService } from './transactional-email.service';

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
   * Send verification email to user
   */
  static async sendVerificationEmail(
    userId: string,
    email: string,
    username: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const token = this.generateToken();
      const code = this.generateCode();
      const expiry = this.getCodeExpiry();

      await prisma.user.update({
        where: { id: userId },
        data: {
          verificationToken: this.encodeCodeToken(token, code),
          verificationTokenExpiry: expiry,
        },
      });

      const verificationUrl = `${env.NEXT_PUBLIC_SHOP_URL}/verify-email?token=${token}`;

      await TransactionalEmailService.send({
        aggregateId: userId,
        to: email,
        subject: 'Verify your email address',
        html: this.getVerificationEmailHtml(username, code, verificationUrl),
        text: this.getVerificationEmailText(username, code, verificationUrl),
        eventType: 'user.email_verification',
        metadata: { userId },
      });

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to send verification email',
      };
    }
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
   * Resend verification email to a user
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
   * Send a staff invitation email.
   *
   * Reuses the email-verification token flow: verifying the link both
   * confirms the address and activates the staff account. Best-effort like
   * sendVerificationEmail — succeeds silently when no provider is configured.
   */
  static async sendStaffInvitationEmail(
    userId: string,
    email: string,
    username: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const token = this.generateToken();
      const expiry = this.getTokenExpiry();

      await prisma.user.update({
        where: { id: userId },
        data: {
          verificationToken: token,
          verificationTokenExpiry: expiry,
        },
      });

      const verificationUrl = `${env.NEXT_PUBLIC_SHOP_URL}/verify-email?token=${token}`;

      await TransactionalEmailService.send({
        aggregateId: userId,
        to: email,
        subject: 'You have been invited to the Jiffoo admin team',
        html: this.getStaffInvitationEmailHtml(username, verificationUrl),
        text: this.getStaffInvitationEmailText(username, verificationUrl),
        eventType: 'staff.invitation',
        metadata: { userId },
      });

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to send staff invitation email',
      };
    }
  }

  private static getStaffInvitationEmailHtml(name: string, verificationUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Admin Team Invitation</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #111;">You're invited</h1>
          <p>Hi ${name},</p>
          <p>You have been granted staff access to the Jiffoo admin dashboard. Verify your email address to activate your account.</p>
          <p style="margin: 24px 0;">
            <a href="${verificationUrl}" style="background-color: #111; color: #fff; padding: 12px 20px; text-decoration: none; border-radius: 4px;">
              Activate Account
            </a>
          </p>
          <p>If the button does not work, copy and paste this link into your browser:</p>
          <p style="word-break: break-all;">${verificationUrl}</p>
          <p>This link expires in 24 hours.</p>
        </body>
      </html>
    `;
  }

  private static getStaffInvitationEmailText(name: string, verificationUrl: string): string {
    return `Hi ${name},\n\nYou have been granted staff access to the Jiffoo admin dashboard. Activate your account:\n${verificationUrl}\n\nThis link expires in 24 hours.`;
  }

  private static getVerificationEmailHtml(name: string, code: string, verificationUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #111;">Welcome to Jiffoo</h1>
          <p>Hi ${name},</p>
          <p>Use this verification code to activate your account:</p>
          <p style="font-size: 32px; font-weight: 700; letter-spacing: 8px; margin: 24px 0;">${code}</p>
          <p>This code expires in ${this.CODE_TTL_MINUTES} minutes.</p>
          <p>You can also verify with the secure link below.</p>
          <p style="margin: 24px 0;">
            <a href="${verificationUrl}" style="background-color: #111; color: #fff; padding: 12px 20px; text-decoration: none; border-radius: 4px;">
              Verify Email
            </a>
          </p>
          <p>If the button does not work, copy and paste this link into your browser:</p>
          <p style="word-break: break-all;">${verificationUrl}</p>
          <p>This link expires in ${this.CODE_TTL_MINUTES} minutes.</p>
        </body>
      </html>
    `;
  }

  private static getVerificationEmailText(name: string, code: string, verificationUrl: string): string {
    return `Hi ${name},\n\nYour verification code is ${code}. It expires in ${this.CODE_TTL_MINUTES} minutes.\n\nYou can also verify your email with this link:\n${verificationUrl}`;
  }
}
