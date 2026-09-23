/**
 * Auth Routes
 *
 * Authentication routes for the self-hosted Core.
 */

import { FastifyInstance } from 'fastify';
import { AuthService } from './service';
import { authMiddleware, requireAdmin } from './middleware';
import { prisma } from '@/config/database';
import { PasswordUtils } from '@/utils/password';
import { sendSuccess, sendError } from '@/utils/response';
import { authSchemas } from './schemas';
import { EmailVerificationService } from '@/services/email-verification.service';
import { completeBootstrapPasswordRotation, getPublicAuthBootstrapStatus } from './bootstrap';
import { acceptStaffInvite, requestPasswordReset, resetPassword } from './account-recovery';
import { rateLimitMiddleware } from './rate-limit-middleware';
import { JwtUtils } from '@/utils/jwt';
import { createSuccessResponseSchema, createTypedUpdateResponses, errorResponseSchema } from '@/types/common-dto';

export async function authRoutes(fastify: FastifyInstance) {
  const acknowledgementSchema = {
    type: 'object', properties: { requested: { type: 'boolean' } }, required: ['requested'],
  } as const;
  const completionSchema = {
    type: 'object', properties: { completed: { type: 'boolean' } }, required: ['completed'],
  } as const;

  fastify.post('/forgot-password', {
    preHandler: [rateLimitMiddleware],
    schema: {
      tags: ['auth'], summary: 'Request a password reset',
      body: {
        type: 'object', required: ['email'], additionalProperties: false,
        properties: {
          email: { type: 'string', format: 'email' },
          app: { type: 'string', enum: ['storefront', 'admin'] },
        },
      },
      response: {
        200: createSuccessResponseSchema(acknowledgementSchema),
        400: errorResponseSchema,
        429: {
          type: 'object',
          properties: { success: { type: 'boolean', enum: [false] }, error: { type: 'string' } },
          required: ['success', 'error'],
        },
        500: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { email, app = 'storefront' } = request.body as { email: string; app?: 'storefront' | 'admin' };
    await requestPasswordReset(email, app);
    return sendSuccess(reply, { requested: true }, 'If the account exists, a reset link has been requested');
  });

  fastify.post('/reset-password', {
    schema: {
      tags: ['auth'], summary: 'Reset password with a one-time token',
      body: {
        type: 'object', required: ['token', 'newPassword'], additionalProperties: false,
        properties: {
          token: { type: 'string', minLength: 1 },
          newPassword: { type: 'string', minLength: 6 },
        },
      },
      response: createTypedUpdateResponses(completionSchema),
    },
  }, async (request, reply) => {
    const { token, newPassword } = request.body as { token: string; newPassword: string };
    try {
      await resetPassword(token, newPassword);
      return sendSuccess(reply, { completed: true });
    } catch {
      return sendError(reply, 400, 'INVALID_RESET_TOKEN', 'Invalid or expired reset token');
    }
  });

  fastify.post('/accept-invite', {
    schema: {
      tags: ['auth'], summary: 'Accept a staff invitation',
      body: {
        type: 'object', required: ['token', 'password'], additionalProperties: false,
        properties: {
          token: { type: 'string', minLength: 1 },
          password: { type: 'string', minLength: 6 },
        },
      },
      response: createTypedUpdateResponses(completionSchema),
    },
  }, async (request, reply) => {
    const { token, password } = request.body as { token: string; password: string };
    try {
      await acceptStaffInvite(token, password);
      return sendSuccess(reply, { completed: true });
    } catch {
      return sendError(reply, 400, 'INVALID_INVITE_TOKEN', 'Invalid or expired invitation');
    }
  });

  // Public login configuration
  fastify.get('/login-config', {
    schema: {
      tags: ['auth'],
      summary: 'Get public login configuration',
      description: 'Returns unauthenticated login-page configuration such as demo-mode visibility',
      ...authSchemas.loginConfig,
    }
  }, async (_request, reply) => {
    try {
      const result = await AuthService.getLoginConfig();
      return sendSuccess(reply, result);
    } catch (error: any) {
      return sendError(reply, 500, 'LOGIN_CONFIG_FAILED', error.message || 'Failed to load login configuration');
    }
  });

  // Register
  fastify.post('/register', {
    schema: {
      tags: ['auth'],
      summary: 'Register new user',
      description: 'Create a new user account and receive authentication tokens',
      ...authSchemas.register,
    }
  }, async (request, reply) => {
    try {
      const { email, username, password, locale } = request.body as { email: string; username: string; password: string; locale?: 'en' | 'zh-Hans' | 'zh-Hant' };
      const result = await AuthService.register({ email, username, password, locale }, request.headers['accept-language']);
      return sendSuccess(reply, result, 'Registration successful', 201);
    } catch (error: any) {
      if (error.code === 'EMAIL_NOT_VERIFIED') {
        return sendError(reply, 409, 'EMAIL_NOT_VERIFIED', error.message);
      }
      return sendError(reply, 400, 'REGISTRATION_FAILED', error.message);
    }
  });

  // Login
  fastify.post('/login', {
    schema: {
      tags: ['auth'],
      summary: 'User login',
      description: 'Authenticate user and receive access and refresh tokens',
      ...authSchemas.login,
    }
  }, async (request, reply) => {
    try {
      const { identifier, email, password } = request.body as any;
      const result = await AuthService.login(identifier ? { identifier, password } : { email, password });
      return sendSuccess(reply, result);
    } catch (error: any) {
      if (error.message === 'Account is inactive') {
        return sendError(reply, 403, 'ACCOUNT_INACTIVE', error.message);
      }
      return sendError(reply, 401, 'LOGIN_FAILED', error.message);
    }
  });

  fastify.get('/bootstrap-status', {
    schema: {
      tags: ['auth'],
      summary: 'Get bootstrap credential status',
      description: 'Returns whether bootstrap/demo credentials should be shown on the login page.',
      ...authSchemas.bootstrapStatus,
    }
  }, async (_request, reply) => {
    try {
      const status = await getPublicAuthBootstrapStatus();
      return sendSuccess(reply, status);
    } catch (error: any) {
      return sendError(reply, 500, 'BOOTSTRAP_STATUS_ERROR', error.message || 'Failed to load bootstrap status');
    }
  });

  // Get current user
  fastify.get('/me', {
    onRequest: [authMiddleware],
    schema: {
      tags: ['auth'],
      summary: 'Get current user info',
      description: 'Get authenticated user profile information',
      security: [{ bearerAuth: [] }],
      ...authSchemas.me,
    }
  }, async (request, reply) => {
    try {
      const user = await AuthService.getCurrentUser(request.user!.id);
      return sendSuccess(reply, user); // Directly return UserProfile, no nesting
    } catch (error: any) {
      return sendError(reply, 401, 'UNAUTHORIZED', error.message);
    }
  });

  // Refresh token
  fastify.post('/refresh', {
    // No authMiddleware needed, relying on refresh_token verification
    schema: {
      tags: ['auth'],
      summary: 'Refresh access token',
      description: 'Use a refresh token to obtain a new access token',
      ...authSchemas.refresh,
    }
  }, async (request, reply) => {
    try {
      const { refresh_token } = request.body as any;
      if (!refresh_token) {
        throw new Error('Refresh token is required');
      }
      const result = await AuthService.refreshSession(refresh_token);
      return sendSuccess(reply, result);
    } catch (error: any) {
      if (error.code === 'SESSION_REVOKED') {
        return sendError(reply, 401, 'SESSION_REVOKED', error.message);
      }
      if (error.message === 'Account is inactive') {
        return sendError(reply, 403, 'ACCOUNT_INACTIVE', error.message);
      }
      return sendError(reply, 401, 'REFRESH_FAILED', error.message);
    }
  });

  // Logout (client-side token removal)
  fastify.post('/logout', {
    schema: {
      tags: ['auth'],
      summary: 'User logout',
      description: 'Logout user (client-side token removal)',
      ...authSchemas.logout,
    }
  }, async (_request, reply) => {
    return sendSuccess(reply, {
      loggedOut: true,
      timestamp: new Date().toISOString(),
    }, 'Logged out successfully');
  });

  // Verify email
  fastify.get('/verify-email', {
    schema: {
      tags: ['auth'],
      summary: 'Verify email address',
      querystring: {
        type: 'object',
        properties: {
          token: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { token } = request.query as any;
      if (!token) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'TOKEN_REQUIRED',
            message: 'Verification token is required'
          }
        });
      }

      const result = await EmailVerificationService.verifyToken(token);

      if (!result.success) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'VERIFICATION_FAILED',
            message: result.error || 'Failed to verify email'
          }
        });
      }

      return reply.send({
        success: true,
        data: null,
        message: 'Email verified successfully'
      });
    } catch (error: any) {
      return reply.code(500).send({
        success: false,
        error: {
          code: 'VERIFICATION_ERROR',
          message: error.message
        }
      });
    }
  });

  fastify.post('/verify-email/code', {
    schema: {
      tags: ['auth'],
      summary: 'Verify email address with a six-digit code',
      body: {
        type: 'object',
        required: ['email', 'code'],
        properties: {
          email: { type: 'string', format: 'email' },
          code: { type: 'string', pattern: '^\\d{6}$' },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { email, code } = request.body as { email: string; code: string };
      const result = await EmailVerificationService.verifyCode(email, code);
      if (!result.success) return sendError(reply, 400, 'VERIFICATION_FAILED', result.error || 'Failed to verify email');
      return sendSuccess(reply, null, 'Email verified successfully');
    } catch (error: any) {
      return sendError(reply, 500, 'VERIFICATION_ERROR', error.message);
    }
  });

  // Resend verification email
  fastify.post('/resend-verification', {
    schema: {
      tags: ['auth'],
      summary: 'Resend verification email',
      body: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { email } = request.body as any;
      if (!email) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'EMAIL_REQUIRED',
            message: 'Email address is required'
          }
        });
      }

      const result = await EmailVerificationService.resendVerificationEmail(email);

      if (!result.success) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'VERIFICATION_NOT_AVAILABLE',
            message: result.error || 'Verification could not be requested'
          }
        });
      }

      return reply.send({
        success: true,
        data: null,
        message: 'Verification requested'
      });
    } catch (error: any) {
      return reply.code(500).send({
        success: false,
        error: {
          code: 'RESEND_ERROR',
          message: error.message
        }
      });
    }
  });

  // Change password
  fastify.post('/change-password', {
    onRequest: [authMiddleware],
    schema: {
      tags: ['auth'],
      summary: 'Change password',
      description: 'Change current user password (requires authentication)',
      security: [{ bearerAuth: [] }],
      ...authSchemas.changePassword,
    }
  }, async (request, reply) => {
    try {
      const { currentPassword, newPassword } = request.body as any;
      const user = await prisma.user.findUnique({
        where: { id: request.user!.id }
      });

      if (!user) {
        return sendError(reply, 404, 'USER_NOT_FOUND', 'User not found');
      }

      const isValid = await PasswordUtils.verify(currentPassword, user.password);
      if (!isValid) {
        return sendError(reply, 400, 'INVALID_PASSWORD', 'Current password is incorrect');
      }

      const hashedPassword = await PasswordUtils.hash(newPassword);
      const updated = await prisma.$transaction((tx) => tx.user.update({
        where: { id: user.id },
        data: { password: hashedPassword, sessionVersion: { increment: 1 } },
      }));

      await completeBootstrapPasswordRotation(user.email);

      return sendSuccess(reply, {
        passwordChanged: true,
        changedAt: new Date().toISOString(),
        access_token: JwtUtils.sign({
          userId: updated.id, email: updated.email, role: updated.role, sv: updated.sessionVersion,
        }),
        refresh_token: JwtUtils.signRefresh({ userId: updated.id, sv: updated.sessionVersion }),
      }, 'Password changed successfully');
    } catch (error: any) {
      return sendError(reply, 500, 'CHANGE_PASSWORD_FAILED', error.message);
    }
  });
}
