import { FastifyInstance } from 'fastify';
import { UserService, UpdateProfileRequest, ChangePasswordRequest } from './service';
import { authMiddleware } from '@/core/auth/middleware';

export async function userProfileRoutes(fastify: FastifyInstance) {
  // Get user profile
  fastify.get('/profile', {
    preHandler: [authMiddleware],
    schema: {
      tags: ['user'],
      summary: 'Get user profile',
      description: 'Get the current user profile information',
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
                role: { type: 'string' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
                languagePreference: {
                  type: 'object',
                  properties: {
                    preferredLanguage: { type: 'string' },
                    timezone: { type: 'string' },
                    dateFormat: { type: 'string' },
                    timeFormat: { type: 'string' },
                    numberFormat: { type: 'string' },
                    currencyFormat: { type: 'string' },
                  }
                }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const profile = await UserService.getProfile(request.user!.userId);
      
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

  // Update user profile
  fastify.put('/profile', {
    preHandler: [authMiddleware],
    schema: {
      tags: ['user'],
      summary: 'Update user profile',
      description: 'Update user profile information',
      body: {
        type: 'object',
        properties: {
          username: { type: 'string', minLength: 3, maxLength: 50 },
          avatar: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const updatedProfile = await UserService.updateProfile(
        request.user!.userId,
        request.body as UpdateProfileRequest
      );
      
      return reply.send({
        success: true,
        data: updatedProfile
      });
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: 'Failed to update profile',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Change password
  fastify.post('/profile/change-password', {
    preHandler: [authMiddleware],
    schema: {
      tags: ['user'],
      summary: 'Change password',
      description: 'Change user password',
      body: {
        type: 'object',
        required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: { type: 'string', minLength: 6 },
          newPassword: { type: 'string', minLength: 6 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const result = await UserService.changePassword(
        request.user!.userId,
        request.body as ChangePasswordRequest
      );
      
      return reply.send({
        success: true,
        message: result.message
      });
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: 'Failed to change password',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get user orders
  fastify.get('/orders', {
    preHandler: [authMiddleware],
    schema: {
      tags: ['user'],
      summary: 'Get user orders',
      description: 'Get user order history with pagination',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { page = 1, limit = 10 } = request.query as any;
      const result = await UserService.getUserOrders(
        request.user!.userId,
        Number(page),
        Number(limit)
      );
      
      return reply.send({
        success: true,
        data: result
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to get orders',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get user order statistics
  fastify.get('/orders/stats', {
    preHandler: [authMiddleware],
    schema: {
      // tags: ['user'],
      // summary: 'Get user order statistics',
      // description: 'Get user order statistics and summary'
    }
  }, async (request, reply) => {
    try {
      const stats = await UserService.getUserOrderStats(request.user!.userId);
      
      return reply.send({
        success: true,
        data: stats
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to get order statistics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Update language preferences
  fastify.put('/profile/language-preferences', {
    preHandler: [authMiddleware],
    schema: {
      tags: ['user'],
      summary: 'Update language preferences',
      description: 'Update user language and localization preferences',
      body: {
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
  }, async (request, reply) => {
    try {
      const preferences = await UserService.updateLanguagePreferences(
        request.user!.userId,
        request.body as any
      );
      
      return reply.send({
        success: true,
        data: preferences
      });
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: 'Failed to update language preferences',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
