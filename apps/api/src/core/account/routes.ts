import { FastifyInstance } from 'fastify';
import { AccountService } from './service';
import { UpdateProfileSchema } from './types';
import { authMiddleware } from '@/core/auth/middleware';

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
                avatar: { type: 'string' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
                languagePreferences: {
                  type: 'object',
                  properties: {
                    preferredLanguage: { type: 'string' },
                    timezone: { type: 'string' },
                    dateFormat: { type: 'string' },
                    timeFormat: { type: 'string' },
                    numberFormat: { type: 'string' },
                    currencyFormat: { type: 'string' }
                  }
                }
              }
            }
          }
        },
        401: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [false] },
            error: { type: 'string' }
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
      const profile = await AccountService.getProfile(request.user!.userId);

      return reply.send({
        success: true,
        data: profile
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to get profile',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
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
                avatar: { type: 'string' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' }
              }
            },
            message: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [false] },
            error: { type: 'string' },
            message: { type: 'string' }
          }
        },
        401: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [false] },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const updateData = UpdateProfileSchema.parse(request.body);
      const updatedProfile = await AccountService.updateProfile(
        request.user!.userId,
        updateData
      );

      return reply.send({
        success: true,
        data: updatedProfile,
        message: 'Profile updated successfully'
      });
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: 'Failed to update profile',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });




}
