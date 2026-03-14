import { FastifyInstance } from 'fastify';
import { AccountService } from './service';
import { UpdateEmailSchema, UpdateProfileSchema } from './types';
import { authMiddleware } from '@/core/auth/middleware';
import { sendSuccess, sendError } from '@/utils/response';
import { UploadService } from '@/core/upload/service';
import { mapAccountRouteError } from '@/utils/route-error-mapper';
import {
  uploadResultSchema,
  createTypedCrudResponses,
  createTypedReadResponses,
  createTypedUpdateResponses,
} from '@/types/common-dto';

const userProfileSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    email: { type: 'string' },
    username: { type: 'string' },
    avatar: { type: ['string', 'null'] },
    role: { type: 'string' },
    isActive: { type: 'boolean' },
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
  required: ['id', 'email', 'username', 'avatar', 'role', 'isActive', 'orderCount', 'totalOrders', 'totalSpent', 'createdAt', 'updatedAt'],
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
    } catch (error: unknown) {
      const mapped = mapAccountRouteError(error, {
        defaultStatus: 500,
        defaultCode: 'INTERNAL_SERVER_ERROR',
        defaultMessage: 'Failed to get profile',
      });
      return sendError(reply, mapped.status, mapped.code, mapped.message, mapped.details);
    }
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
          avatar: { type: 'string' }
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
    } catch (error: unknown) {
      const mapped = mapAccountRouteError(error, {
        defaultStatus: 500,
        defaultCode: 'INTERNAL_SERVER_ERROR',
        defaultMessage: 'Failed to update profile',
      });
      return sendError(reply, mapped.status, mapped.code, mapped.message, mapped.details);
    }
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
      return sendSuccess(reply, updatedProfile, 'Email updated successfully');
    } catch (error: unknown) {
      const mapped = mapAccountRouteError(error, {
        defaultStatus: 500,
        defaultCode: 'INTERNAL_SERVER_ERROR',
        defaultMessage: 'Failed to update email',
      });
      return sendError(reply, mapped.status, mapped.code, mapped.message, mapped.details);
    }
  });

  /**
   * Upload avatar
   * POST /api/account/avatar
   */
  fastify.post('/avatar', {
    preHandler: [authMiddleware],
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

      const result = await UploadService.uploadProductImage(data);
      return sendSuccess(reply, result);
    } catch (error: unknown) {
      const mapped = mapAccountRouteError(error, {
        defaultStatus: 500,
        defaultCode: 'INTERNAL_SERVER_ERROR',
        defaultMessage: 'Upload failed',
      });
      return sendError(reply, mapped.status, mapped.code, mapped.message, mapped.details);
    }
  });




}
