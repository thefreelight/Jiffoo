import { FastifyInstance } from 'fastify';
import { AuthService } from './service';
import { LoginSchema, RegisterSchema } from './types';
import { authMiddleware } from './middleware';
import { EmailHelper } from '@/core/email-gateway/email-helper';
import { env } from '@/config/env';
import { PasswordUtils } from '@/utils/password';
import { prisma } from '@/config/database';

// ============================================
// 邀请码辅助函数
// ============================================

/**
 * 生成唯一邀请码
 */
async function generateReferralCode(): Promise<string> {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  let isUnique = false;

  while (!isUnique) {
    code = '';
    for (let i = 0; i < 8; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    const existing = await prisma.user.findUnique({
      where: { referralCode: code }
    });

    if (!existing) {
      isUnique = true;
    }
  }

  return code;
}

/**
 * 通过邀请码获取用户ID
 */
async function getUserIdByReferralCode(code: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { referralCode: code },
    select: { id: true }
  });

  return user?.id || null;
}

export async function authRoutes(fastify: FastifyInstance) {
  // Register
  fastify.post('/register', {
    schema: {
      tags: ['auth'],
      summary: 'Register new user',
      body: {
        type: 'object',
        required: ['email', 'username', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          username: { type: 'string', minLength: 3 },
          password: { type: 'string', minLength: 6 },
          referralCode: { type: 'string' },
          avatar: { type: 'string' }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', additionalProperties: true },
            message: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            message: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      // 验证请求数据
      const validatedData = RegisterSchema.parse(request.body);

      // 获取租户ID（从请求头、域名或其他方式）
      const tenantIdHeader = request.headers['x-tenant-id'] as string;
      const tenantId = tenantIdHeader ? parseInt(tenantIdHeader, 10) :
        (request as any).tenantContext?.tenantId;

      if (!tenantId || tenantId === 0) {
        return reply.status(400).send({
          success: false,
          error: 'Missing tenant context',
          message: 'Tenant ID is required for registration (super admin registration not allowed)'
        });
      }

      // 🆕 获取邀请码（可选）
      const referralCode = (request.body as any).referralCode;

      const result = await AuthService.register(validatedData, tenantId, referralCode);

      // 🆕 生成6位数验证码并发送注册验证邮件（异步，不阻塞注册流程）
      const verificationCode = EmailHelper.generateVerificationCode();

      // 从result中获取用户ID（需要修改AuthService返回用户信息）
      // 临时方案：查询刚创建的用户
      const newUser = await fastify.prisma.user.findFirst({
        where: {
          email: validatedData.email,
          tenantId
        }
      });

      if (newUser) {
        // 将验证码存储到Redis，设置10分钟过期时间
        await fastify.redis.setex(
          `verification:${newUser.id}`,
          600, // 10分钟 = 600秒
          verificationCode
        );

        fastify.log.info(`📧 Verification code generated for user ${newUser.id}: ${verificationCode}`);

        // 🔧 使用用户实际的邮箱地址
        EmailHelper.sendRegistrationVerificationEmail(
          fastify,
          tenantId,
          {
            to: validatedData.email, // 使用用户注册的邮箱
            username: validatedData.username,
            verificationCode
          }
        ).catch(error => {
          fastify.log.error({ err: error }, 'Failed to send registration email (non-blocking)');
        });
      }

      return reply.status(201).send({
        success: true,
        data: result,
        message: 'Registration successful. Please check your email to verify your account.'
      });
    } catch (error) {
      // 如果是 Zod 验证错误
      if (error instanceof Error && error.name === 'ZodError') {
        return reply.status(400).send({
          success: false,
          error: 'Validation failed',
          message: 'Invalid request data',
          details: (error as any).errors
        });
      }

      return reply.status(400).send({
        success: false,
        error: 'Registration failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Login
  fastify.post('/login', {
    schema: {
      tags: ['auth'],
      summary: 'User login',
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', additionalProperties: true },
            message: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            message: { type: 'string' }
          }
        },
        401: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            message: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      // 添加调试日志
      fastify.log.info({ body: request.body }, 'Login request received');

      // 验证请求数据
      const validatedData = LoginSchema.parse(request.body);
      fastify.log.info({ data: validatedData }, 'Validated login data');

      // 获取租户ID（超级管理员登录时可为空）
      const tenantIdHeader = request.headers['x-tenant-id'] as string;
      const tenantId = tenantIdHeader ? parseInt(tenantIdHeader, 10) :
        (request as any).tenantContext?.tenantId;

      const result = await AuthService.login(validatedData, tenantId);
      return reply.send({
        success: true,
        data: result,
        message: 'Login successful'
      });
    } catch (error) {
      // 添加错误日志
      fastify.log.error({ err: error }, 'Login error');

      // 如果是 Zod 验证错误
      if (error instanceof Error && error.name === 'ZodError') {
        return reply.status(400).send({
          success: false,
          error: 'Validation failed',
          message: 'Invalid request data',
          details: (error as any).errors
        });
      }

      return reply.status(401).send({
        success: false,
        error: 'Login failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get current user profile - 统一的 /api/auth/me 端点
  fastify.get('/me', {
    preHandler: [authMiddleware],
    schema: {
      tags: ['auth'],
      summary: 'Get current user profile',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                username: { type: 'string' },
                role: { type: 'string' },
                avatar: { type: 'string' }
              }
            },
            message: { type: 'string' }
          }
        },
        '4xx': {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            message: { type: 'string' }
          }
        },
        '5xx': {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const userProfile = await AuthService.getUserProfile(
        request.user!.userId,
        request.user!.tenantId
      );

      return reply.send({
        success: true,
        data: userProfile,
        message: 'User profile retrieved successfully'
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });



  // 登出 - 清除httpOnly cookies
  fastify.post('/logout', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: true
      }
    }
  }, async (_request, reply) => {
    try {
      const result = await AuthService.logout();

      return reply.send({
        success: true,
        data: result,
        message: 'Logged out successfully'
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Token刷新
  fastify.post('/refresh', {
    schema: {
      tags: ['auth'],
      summary: 'Refresh access token',
      body: {
        type: 'object',
        required: ['refresh_token'],
        properties: {
          refresh_token: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', additionalProperties: true },
            message: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            message: { type: 'string' }
          }
        },
        401: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            message: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { refresh_token } = request.body as { refresh_token: string };

      if (!refresh_token) {
        return reply.status(400).send({
          success: false,
          error: 'Missing refresh token',
          message: 'Refresh token is required'
        });
      }

      const result = await AuthService.refreshToken(refresh_token);

      return reply.send({
        success: true,
        data: result,
        message: 'Token refreshed successfully'
      });
    } catch (error) {
      return reply.status(401).send({
        success: false,
        error: 'Token refresh failed',
        message: error instanceof Error ? error.message : 'Invalid refresh token'
      });
    }
  });

  // 🆕 忘记密码 - 发送重置邮件
  fastify.post('/forgot-password', {
    schema: {
      tags: ['auth'],
      summary: 'Request password reset',
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        },
        '4xx': {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            message: { type: 'string' }
          }
        },
        '5xx': {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { email } = request.body as { email: string };

      if (!email) {
        return reply.status(400).send({
          success: false,
          error: 'Missing email',
          message: 'Email is required'
        });
      }

      // 获取租户ID
      const tenantIdHeader = request.headers['x-tenant-id'] as string;
      const tenantId = tenantIdHeader ? parseInt(tenantIdHeader, 10) : undefined;

      if (!tenantId || tenantId === 0) {
        return reply.status(400).send({
          success: false,
          error: 'Missing tenant context',
          message: 'Tenant ID is required'
        });
      }

      // 查找用户
      const user = await fastify.prisma.user.findFirst({
        where: {
          email,
          tenantId
        }
      });

      // 即使用户不存在，也返回成功（安全考虑，不泄露用户是否存在）
      if (!user) {
        fastify.log.info(`Password reset requested for non-existent email: ${email}`);
        return reply.send({
          success: true,
          message: 'If the email exists, a password reset link has been sent.'
        });
      }

      // 生成6位数重置验证码
      const resetCode = EmailHelper.generateVerificationCode();

      // 将验证码存储到Redis，设置10分钟过期时间
      await fastify.redis.setex(
        `reset:${user.id}`,
        600, // 10分钟 = 600秒
        resetCode
      );

      fastify.log.info(`🔑 Reset code generated for user ${user.id}: ${resetCode}`);

      // 🔧 发送密码重置邮件到用户的实际邮箱（异步，不阻塞）
      EmailHelper.sendPasswordResetEmail(
        fastify,
        tenantId,
        {
          to: user.email, // 使用用户的实际邮箱
          username: user.username,
          resetCode
        }
      ).catch(error => {
        fastify.log.error({ err: error }, 'Failed to send password reset email (non-blocking)');
      });

      return reply.send({
        success: true,
        message: 'If the email exists, a password reset link has been sent.'
      });
    } catch (error) {
      fastify.log.error({ err: error }, 'Forgot password error');
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        message: 'Failed to process password reset request'
      });
    }
  });

  // 🆕 发送注册验证码（用于还不存在的用户）
  fastify.post('/send-registration-code', {
    schema: {
      tags: ['auth'],
      summary: 'Send registration verification code',
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        },
        '4xx': {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            message: { type: 'string' }
          }
        },
        '5xx': {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { email } = request.body as { email: string };

      if (!email) {
        return reply.status(400).send({
          success: false,
          error: 'Missing required fields',
          message: 'Email is required'
        });
      }

      // 获取租户ID
      const tenantIdHeader = request.headers['x-tenant-id'] as string;
      const tenantId = tenantIdHeader ? parseInt(tenantIdHeader, 10) : undefined;

      if (!tenantId || tenantId === 0) {
        return reply.status(400).send({
          success: false,
          error: 'Missing tenant context',
          message: 'Tenant ID is required'
        });
      }

      // 检查用户是否已存在
      const existingUser = await fastify.prisma.user.findFirst({
        where: {
          email,
          tenantId
        }
      });

      if (existingUser) {
        return reply.status(400).send({
          success: false,
          error: 'User already exists',
          message: 'This email is already registered. Please login instead.'
        });
      }

      // 为了防止滥用，使用邮箱作为key存储临时验证码
      // 格式: temp_verification:{email}
      const tempKey = `temp_verification:${email}`;
      const existingCode = await fastify.redis.get(tempKey);
      const ttl = existingCode ? await fastify.redis.ttl(tempKey) : 0;

      if (existingCode && ttl > 540) { // 如果还有超过9分钟（540秒）
        return reply.status(429).send({
          success: false,
          error: 'Too many requests',
          message: `Please wait ${Math.ceil((ttl - 540) / 60)} minute(s) before requesting a new code.`
        });
      }

      // 生成验证码
      const verificationCode = EmailHelper.generateVerificationCode();

      // 存储到Redis（使用邮箱作为key，因为用户还不存在）
      await fastify.redis.setex(
        tempKey,
        600, // 10分钟 = 600秒
        verificationCode
      );

      fastify.log.info(`📧 Registration verification code generated for email ${email}: ${verificationCode}`);

      // 🔧 发送邮件
      EmailHelper.sendRegistrationVerificationEmail(
        fastify,
        tenantId,
        {
          to: email,
          username: email.split('@')[0], // 使用邮箱前缀作为临时用户名
          verificationCode
        }
      ).catch(error => {
        fastify.log.error({ err: error }, 'Failed to send registration verification email');
      });

      return reply.send({
        success: true,
        message: 'Verification code has been sent to your email.'
      });
    } catch (error) {
      fastify.log.error({ err: error }, 'Send registration code error');
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        message: 'Failed to send verification code'
      });
    }
  });

  // 🆕 重新发送验证码
  fastify.post('/resend-verification-code', {
    schema: {
      tags: ['auth'],
      summary: 'Resend verification code',
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        },
        '4xx': {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            message: { type: 'string' }
          }
        },
        '5xx': {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { email } = request.body as { email: string };

      if (!email) {
        return reply.status(400).send({
          success: false,
          error: 'Missing required fields',
          message: 'Email is required'
        });
      }

      // 获取租户ID
      const tenantIdHeader = request.headers['x-tenant-id'] as string;
      const tenantId = tenantIdHeader ? parseInt(tenantIdHeader, 10) : undefined;

      if (!tenantId || tenantId === 0) {
        return reply.status(400).send({
          success: false,
          error: 'Missing tenant context',
          message: 'Tenant ID is required'
        });
      }

      // 查找用户
      const user = await fastify.prisma.user.findFirst({
        where: {
          email,
          tenantId
        }
      });

      if (!user) {
        // 为了安全，不透露用户是否存在
        return reply.send({
          success: true,
          message: 'If the email exists, a new verification code has been sent.'
        });
      }

      // 检查是否有未过期的验证码（防止频繁发送）
      const existingCode = await fastify.redis.get(`verification:${user.id}`);
      const ttl = existingCode ? await fastify.redis.ttl(`verification:${user.id}`) : 0;

      if (existingCode && ttl > 540) { // 如果还有超过9分钟（540秒）
        return reply.status(429).send({
          success: false,
          error: 'Too many requests',
          message: `Please wait ${Math.ceil((ttl - 540) / 60)} minute(s) before requesting a new code.`
        });
      }

      // 生成新的验证码
      const verificationCode = EmailHelper.generateVerificationCode();

      // 存储到Redis
      await fastify.redis.setex(
        `verification:${user.id}`,
        600,
        verificationCode
      );

      fastify.log.info(`📧 New verification code generated for user ${user.id}: ${verificationCode}`);

      // 🔧 发送邮件到用户的实际邮箱
      EmailHelper.sendRegistrationVerificationEmail(
        fastify,
        tenantId,
        {
          to: user.email, // 使用用户的实际邮箱
          username: user.username,
          verificationCode
        }
      ).catch(error => {
        fastify.log.error({ err: error }, 'Failed to resend verification email');
      });

      return reply.send({
        success: true,
        message: 'A new verification code has been sent to your email.'
      });
    } catch (error) {
      fastify.log.error({ err: error }, 'Resend verification code error');
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        message: 'Failed to resend verification code'
      });
    }
  });

  // 🆕 验证邮箱（使用验证码）
  fastify.post('/verify-email', {
    schema: {
      tags: ['auth'],
      summary: 'Verify email with code',
      body: {
        type: 'object',
        required: ['email', 'code'],
        properties: {
          email: { type: 'string', format: 'email' },
          code: { type: 'string', minLength: 6, maxLength: 6 },
          referralCode: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object', additionalProperties: true }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            message: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { email, code } = request.body as { email: string; code: string };

      if (!email || !code) {
        return reply.status(400).send({
          success: false,
          error: 'Missing required fields',
          message: 'Email and verification code are required'
        });
      }

      // 验证验证码格式（6位数字）
      if (!/^\d{6}$/.test(code)) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid code',
          message: 'Verification code must be 6 digits'
        });
      }

      // 获取租户ID
      const tenantIdHeader = request.headers['x-tenant-id'] as string;
      const tenantId = tenantIdHeader ? parseInt(tenantIdHeader, 10) : undefined;

      if (!tenantId || tenantId === 0) {
        return reply.status(400).send({
          success: false,
          error: 'Missing tenant context',
          message: 'Tenant ID is required'
        });
      }

      // 查找用户
      let user = await fastify.prisma.user.findFirst({
        where: {
          email,
          tenantId
        }
      });

      let storedCode: string | null = null;

      if (user) {
        // 用户已存在，检查 verification:{userId} key
        storedCode = await fastify.redis.getString(`verification:${user.id}`);
      } else {
        // 用户不存在，检查 temp_verification:{email} key（用于注册流程）
        storedCode = await fastify.redis.getString(`temp_verification:${email}`);
      }

      if (!storedCode) {
        return reply.status(400).send({
          success: false,
          error: 'Code expired',
          message: 'The verification code has expired. Please request a new one.'
        });
      }

      if (storedCode !== code) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid code',
          message: 'The verification code is incorrect. Please check and try again.'
        });
      }

      // 如果用户不存在，需要创建用户
      if (!user) {
        // 生成用户名（使用邮箱前缀）
        let username = email.split('@')[0];

        // 检查用户名是否已存在，如果存在则添加随机后缀
        let existingUser = await fastify.prisma.user.findFirst({
          where: {
            username,
            tenantId
          }
        });

        if (existingUser) {
          username = `${username}_${Math.random().toString(36).substring(7)}`;
        }

        // 🆕 生成邀请码
        const referralCode = await generateReferralCode();

        // 🆕 获取邀请码（如果有）
        const inviteCode = (request.body as any).referralCode;
        let invitedBy: string | undefined;
        if (inviteCode) {
          invitedBy = await getUserIdByReferralCode(inviteCode) || undefined;
        }

        // 创建新用户
        user = await fastify.prisma.user.create({
          data: {
            email,
            username,
            password: '', // 邮箱验证注册不需要密码
            tenantId,
            role: 'USER',
            isActive: true,
            referralCode, // 🆕 自动生成邀请码
            invitedBy // 🆕 记录邀请人
          }
        });

        // 🆕 如果有邀请人，更新邀请人的统计
        if (invitedBy) {
          await fastify.prisma.user.update({
            where: { id: invitedBy },
            data: {
              totalReferrals: { increment: 1 }
            }
          });
        }

        fastify.log.info(`📝 New user created via email verification: ${user.id}`);
      }

      // 更新用户邮箱验证状态（如果有这个字段）
      // await fastify.prisma.user.update({
      //   where: { id: user.id },
      //   data: { emailVerified: true }
      // });

      // 删除已使用的验证码（处理两种情况）
      await fastify.redis.del(`verification:${user.id}`);
      await fastify.redis.del(`temp_verification:${email}`);

      fastify.log.info(`Email verified successfully for user: ${user.id}`);

      // 🆕 生成JWT token并登录用户
      const { JwtUtils } = await import('@/utils/jwt');
      const token = JwtUtils.sign(
        {
          userId: user.id,
          email: user.email,
          tenantId: user.tenantId,
          role: user.role,
        },
        '7d'
      );

      // 返回token和用户信息
      return reply.send({
        success: true,
        message: 'Email verified successfully. You are now logged in.',
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            role: user.role,
            avatar: user.avatar,
            tenantId: user.tenantId,
          }
        }
      });
    } catch (error) {
      fastify.log.error({ err: error }, 'Verify email error');
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        message: 'Failed to verify email'
      });
    }
  });

  // 🆕 重置密码（使用验证码）
  fastify.post('/reset-password', {
    schema: {
      tags: ['auth'],
      summary: 'Reset password with code',
      body: {
        type: 'object',
        required: ['email', 'code', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          code: { type: 'string', minLength: 6, maxLength: 6 },
          password: { type: 'string', minLength: 6 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            message: { type: 'string' }
          }
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            message: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { email, code, password } = request.body as { email: string; code: string; password: string };

      if (!email || !code || !password) {
        return reply.status(400).send({
          success: false,
          error: 'Missing required fields',
          message: 'Email, verification code, and password are required'
        });
      }

      // 验证密码长度
      if (password.length < 6) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid password',
          message: 'Password must be at least 6 characters'
        });
      }

      // 验证验证码格式（6位数字）
      if (!/^\d{6}$/.test(code)) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid code',
          message: 'Verification code must be 6 digits'
        });
      }

      // 获取租户ID
      const tenantIdHeader = request.headers['x-tenant-id'] as string;
      const tenantId = tenantIdHeader ? parseInt(tenantIdHeader, 10) : undefined;

      if (!tenantId || tenantId === 0) {
        return reply.status(400).send({
          success: false,
          error: 'Missing tenant context',
          message: 'Tenant ID is required'
        });
      }

      // 查找用户
      const user = await fastify.prisma.user.findFirst({
        where: {
          email,
          tenantId
        }
      });

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: 'User not found',
          message: 'No user found with this email address'
        });
      }

      // 从Redis验证验证码
      const storedCode = await fastify.redis.get(`reset:${user.id}`);

      if (!storedCode) {
        return reply.status(400).send({
          success: false,
          error: 'Code expired',
          message: 'The verification code has expired. Please request a new one.'
        });
      }

      if (storedCode !== code) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid code',
          message: 'The verification code is incorrect. Please check and try again.'
        });
      }

      // 更新用户密码
      const hashedPassword = await PasswordUtils.hash(password);
      await fastify.prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword }
      });

      // 删除已使用的验证码
      await fastify.redis.del(`reset:${user.id}`);

      fastify.log.info(`Password reset successful for user: ${user.id}`);

      return reply.send({
        success: true,
        message: 'Password has been reset successfully. You can now login with your new password.'
      });
    } catch (error) {
      fastify.log.error({ err: error }, 'Reset password error');
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        message: 'Failed to reset password'
      });
    }
  });


}
