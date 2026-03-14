/**
 * Email Verification Service
 *
 * Handles user email verification tokens and notification sending.
 * Uses a best-effort email send strategy to avoid hard failures when
 * mail credentials are not configured.
 */

import crypto from 'crypto';
import { prisma } from '@/config/database';
import { env } from '@/config/env';

export class EmailVerificationService {
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
      const expiry = this.getTokenExpiry();

      await prisma.user.update({
        where: { id: userId },
        data: {
          verificationToken: token,
          verificationTokenExpiry: expiry,
        },
      });

      const verificationUrl = `${env.NEXT_PUBLIC_SHOP_URL}/verify-email?token=${token}`;

      // If no email provider is configured, treat as success to avoid blocking signup.
      if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
        if (env.NODE_ENV !== 'test') {
          console.warn('Email provider not configured; skipping verification email send.');
        }
        return { success: true };
      }

      // Lazy import to avoid hard dependency in test environments.
      const { Resend } = await import('resend');
      const resend = new Resend(env.RESEND_API_KEY);
      const fromName = env.EMAIL_FROM_NAME || 'Jiffoo';
      const fromAddress = `${fromName} <${env.EMAIL_FROM}>`;

      const result = await resend.emails.send({
        from: fromAddress,
        to: email,
        subject: 'Verify your email address',
        html: this.getVerificationEmailHtml(username, verificationUrl),
        text: this.getVerificationEmailText(username, verificationUrl),
      });

      if (!result.data) {
        return {
          success: false,
          error: result.error?.message || 'Failed to send verification email',
        };
      }

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

      const user = await prisma.user.findFirst({
        where: { verificationToken: token },
      });

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

  private static getVerificationEmailHtml(name: string, verificationUrl: string): string {
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
          <p>Please verify your email address to activate your account.</p>
          <p style="margin: 24px 0;">
            <a href="${verificationUrl}" style="background-color: #111; color: #fff; padding: 12px 20px; text-decoration: none; border-radius: 4px;">
              Verify Email
            </a>
          </p>
          <p>If the button does not work, copy and paste this link into your browser:</p>
          <p style="word-break: break-all;">${verificationUrl}</p>
          <p>This link expires in 24 hours.</p>
        </body>
      </html>
    `;
  }

  private static getVerificationEmailText(name: string, verificationUrl: string): string {
    return `Hi ${name},\n\nPlease verify your email address:\n${verificationUrl}\n\nThis link expires in 24 hours.`;
  }
}
