/**
 * Email Helper Functions
 *
 * 提供便捷的邮件发送函数，用于系统邮件（注册验证、密码重置等）
 */

import { FastifyInstance } from 'fastify';
import { EmailGatewayService } from './service';
import { env } from '@/config/env';

export class EmailHelper {
  /**
   * 生成6位数验证码
   */
  static generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * 发送注册验证邮件（6位数验证码）
   */
  static async sendRegistrationVerificationEmail(
    fastify: FastifyInstance,
    tenantId: number,
    data: {
      to: string;
      username: string;
      verificationCode: string;
    }
  ) {
    try {
      // 获取租户信息
      const tenant = await fastify.prisma.tenant.findUnique({
        where: { id: tenantId }
      });

      if (!tenant) {
        throw new Error('Tenant not found');
      }

      // 发送邮件（使用模板）
      const result = await EmailGatewayService.sendEmail(
        fastify,
        tenantId,
        {
          to: data.to,
          from: env.EMAIL_FROM,           // 使用环境变量的发件人邮箱
          fromName: env.EMAIL_FROM_NAME,  // 使用环境变量的发件人名称
          replyTo: env.EMAIL_REPLY_TO,    // 使用环境变量的回复邮箱
          templateSlug: 'registration-verification',
          templateVariables: {
            companyName: tenant.companyName,
            username: data.username,
            verificationCode: data.verificationCode,
            year: new Date().getFullYear().toString()
          }
        }
      );

      fastify.log.info(`✅ Registration verification email sent to ${data.to}`);
      return result;
    } catch (error) {
      fastify.log.error({ err: error }, 'Failed to send registration verification email');
      // 不抛出错误，避免影响注册流程
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * 发送密码重置邮件（6位数验证码）
   */
  static async sendPasswordResetEmail(
    fastify: FastifyInstance,
    tenantId: number,
    data: {
      to: string;
      username: string;
      resetCode: string;
    }
  ) {
    try {
      // 获取租户信息
      const tenant = await fastify.prisma.tenant.findUnique({
        where: { id: tenantId }
      });

      if (!tenant) {
        throw new Error('Tenant not found');
      }

      // 发送邮件（使用模板）
      const result = await EmailGatewayService.sendEmail(
        fastify,
        tenantId,
        {
          to: data.to,
          from: env.EMAIL_FROM,           // 使用环境变量的发件人邮箱
          fromName: env.EMAIL_FROM_NAME,  // 使用环境变量的发件人名称
          replyTo: env.EMAIL_REPLY_TO,    // 使用环境变量的回复邮箱
          templateSlug: 'password-reset',
          templateVariables: {
            companyName: tenant.companyName,
            username: data.username,
            resetCode: data.resetCode,
            year: new Date().getFullYear().toString()
          }
        }
      );

      fastify.log.info(`✅ Password reset email sent to ${data.to}`);
      return result;
    } catch (error) {
      fastify.log.error({ err: error }, 'Failed to send password reset email');
      // 不抛出错误，避免影响密码重置流程
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * 发送测试邮件（用于测试邮件功能）
   */
  static async sendTestEmail(
    fastify: FastifyInstance,
    tenantId: number,
    to: string
  ) {
    try {
      const tenant = await fastify.prisma.tenant.findUnique({
        where: { id: tenantId }
      });

      const result = await EmailGatewayService.sendEmail(
        fastify,
        tenantId,
        {
          to,
          from: env.EMAIL_FROM,           // 使用环境变量的发件人邮箱
          fromName: env.EMAIL_FROM_NAME,  // 使用环境变量的发件人名称
          replyTo: env.EMAIL_REPLY_TO,    // 使用环境变量的回复邮箱
          subject: `Test Email from ${tenant?.companyName || 'Jiffoo Mall'}`,
          html: `
            <h1>Test Email</h1>
            <p>This is a test email from ${tenant?.companyName || 'Jiffoo Mall'}.</p>
            <p>If you received this email, your email configuration is working correctly!</p>
            <p>Sent at: ${new Date().toISOString()}</p>
          `,
          text: `Test Email\n\nThis is a test email from ${tenant?.companyName || 'Jiffoo Mall'}.\n\nIf you received this email, your email configuration is working correctly!\n\nSent at: ${new Date().toISOString()}`
        }
      );

      fastify.log.info(`✅ Test email sent to ${to}`);
      return result;
    } catch (error) {
      fastify.log.error({ err: error }, 'Failed to send test email');
      throw error;
    }
  }
}

