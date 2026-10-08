import { sendMappedError } from '@/utils/api-errors';
import { FastifyInstance } from 'fastify';
import { AccountService } from './service';
import { UpdateEmailSchema, UpdateProfileSchema } from './types';
import { authMiddleware } from '@/core/auth/middleware';
import { sendSuccess, sendError } from '@/utils/response';
import { UploadService, UploadValidationError } from '@/core/upload/service';
import { prisma } from '@/config/database';
import { PasswordUtils } from '@/utils/password';
import { StaffManagementError } from '@/core/admin/staff-management/service';
import {
  uploadResultSchema,
  createTypedCrudResponses,
  createTypedReadResponses,
  createTypedUpdateResponses,
  errorResponseSchema,
} from '@/types/common-dto';

const userProfileSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    email: { type: 'string' },
    username: { type: 'string' },
    avatar: { type: ['string', 'null'] },
    locale: { type: ['string', 'null'], enum: ['en', 'zh-Hans', 'zh-Hant', null] },
    role: { type: 'string' },
    isActive: { type: 'boolean' },
    emailVerified: { type: 'boolean' },
    orderCount: { type: 'number' },
    totalOrders: { type: 'number' },
    totalSpent: { type: 'number' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
    languagePreferences: {
      type: ['object', 'null'],
      properties: {
        preferredLanguage: { type: 'string' },
        timezone: { type: 'string' },
        dateFormat: { type: 'string' },
        timeFormat: { type: 'string' },
        numberFormat: { type: 'string' },
        currencyFormat: { type: 'string' },
      },
      required: ['preferredLanguage', 'timezone', 'dateFormat', 'timeFormat', 'numberFormat', 'currencyFormat'],
      additionalProperties: false,
    },
  },
  required: ['id', 'email', 'username', 'avatar', 'locale', 'role', 'isActive', 'emailVerified', 'orderCount', 'totalOrders', 'totalSpent', 'createdAt', 'updatedAt'],
  additionalProperties: false,
} as const;

/**
 * User Account Routes
 * Path prefix: /api/account
 * Permission: Authenticated users
 * Features: Focused on personal profile management
 */
export async function accountRoutes(fastify: FastifyInstance) {
  // Apply auth middleware to all account routes (before schema validation)
  fastify.addHook('onRequest', authMiddleware);

  fastify.get('', {
    schema: {
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    try {
      const profile = await AccountService.getProfile(request.user!.id);
      const account = {
        id: profile.id,
        name: profile.username,
        displayName: profile.username,
        email: profile.email,
        phone: null,
        membership: profile.role === 'ADMIN' ? 'Admin' : 'Member',
        accountType: 'customer',
      };
      return sendSuccess(reply, { account, profile: account });
    } catch (error) { return sendMappedError(reply, error); }
  });

  fastify.delete('', {
    schema: {
      tags: ['account'],
      summary: 'Delete account after password confirmation',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['currentPassword'],
        additionalProperties: false,
        properties: { currentPassword: { type: 'string', minLength: 1 } },
      },
      response: { ...createTypedUpdateResponses({
        type: 'object',
        properties: {
          deleted: { type: 'boolean' }, userId: { type: 'string' },
          unboundCardIds: { type: 'array', items: { type: 'string' } },
          message: { type: 'string' },
        },
        required: ['deleted', 'userId', 'unboundCardIds', 'message'],
      }), 409: errorResponseSchema },
    },
  }, async (request, reply) => {
    try {
      const userId = request.user!.id;
      await AccountService.deleteAccount(userId, (request.body as { currentPassword: string }).currentPassword);
      return sendSuccess(reply, {
        deleted: true,
        userId,
        unboundCardIds: [],
        message: 'Your account deletion request was completed.',
      });
    } catch (error) { return sendMappedError(reply, error); }
  });

  /**
   * Get user profile
   * GET /api/account/profile
   */
  fastify.get('/profile', {
    schema: {
      tags: ['account'],
      summary: 'Get User Profile',
      description: 'Get current user profile information',
      security: [{ bearerAuth: [] }],
      response: createTypedReadResponses(userProfileSchema),
    }
  }, async (request, reply) => {
    try {
      const profile = await AccountService.getProfile(request.user!.id);
      return sendSuccess(reply, profile);
    } catch (error) { return sendMappedError(reply, error); }
  });

  /**
   * Update user profile
   * PUT /api/account/profile
   */
  fastify.put('/profile', {
    schema: {
      tags: ['account'],
      summary: 'Update User Profile',
      description: 'Update current user profile information',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          username: { type: 'string', minLength: 3, maxLength: 50 },
          avatar: { type: 'string' },
          locale: { type: 'string', enum: ['en', 'zh-Hans', 'zh-Hant'] },
        }
      },
      response: createTypedUpdateResponses(userProfileSchema),
    }
  }, async (request, reply) => {
    try {
      const updateData = UpdateProfileSchema.parse(request.body);
      const updatedProfile = await AccountService.updateProfile(
        request.user!.id,
        updateData
      );
      return sendSuccess(reply, updatedProfile, 'Profile updated successfully');
    } catch (error) { return sendMappedError(reply, error); }
  });

  /**
   * Update account email
   * PUT /api/account/email
   */
  fastify.put('/email', {
    schema: {
      tags: ['account'],
      summary: 'Update account email',
      description: 'Update current user email, requires current password confirmation',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['newEmail', 'currentPassword'],
        properties: {
          newEmail: { type: 'string', format: 'email' },
          currentPassword: { type: 'string', minLength: 1 },
        },
      },
      response: createTypedUpdateResponses(userProfileSchema),
    }
  }, async (request, reply) => {
    try {
      const updateData = UpdateEmailSchema.parse(request.body);
      const updatedProfile = await AccountService.updateEmail(request.user!.id, updateData);
      return sendSuccess(reply, updatedProfile, 'Email updated. Verify your new address using the verification instructions.');
    } catch (error) { return sendMappedError(reply, error); }
  });

  /**
   * Upload avatar
   * POST /api/account/avatar
   */
  fastify.post('/avatar', {
    onRequest: [authMiddleware],
    schema: {
      tags: ['account'],
      summary: 'Upload Avatar',
      description: 'Upload user avatar image, supports JPEG, PNG, WebP formats, max 5MB',
      security: [{ bearerAuth: [] }],
      consumes: ['multipart/form-data'],
      response: createTypedCrudResponses(uploadResultSchema),
    }
  }, async (request, reply) => {
    try {
      const data = await request.file();

      if (!data) {
        return sendError(reply, 400, 'BAD_REQUEST', 'No file uploaded');
      }

      const result = await UploadService.uploadAvatar(data);
      return sendSuccess(reply, result);
    } catch (error) {
      if (error instanceof UploadValidationError) {
        return sendError(reply, 400, 'VALIDATION_ERROR', error.message, error.details);
      }
      return sendMappedError(reply, error);
    }
  });




}
