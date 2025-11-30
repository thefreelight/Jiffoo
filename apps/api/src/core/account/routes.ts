import { FastifyInstance } from 'fastify';
import { AccountService } from './service';
import { UpdateProfileSchema } from './types';
import { authMiddleware } from '@/core/auth/middleware';

/**
 * 用户个人账户路由 - 精简版
 * 路径前缀: /api/account
 * 权限要求: 认证用户
 * 功能：专注于个人资料管理
 */
export async function accountRoutes(fastify: FastifyInstance) {
  
  /**
   * 获取个人资料
   * GET /api/account/profile
   */
  fastify.get('/profile', {
    preHandler: [authMiddleware],
    schema: {
      tags: ['account'],
      summary: 'Get User Profile',
      description: 'Get current user profile information',
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
   * 更新个人资料
   * PUT /api/account/profile
   */
  fastify.put('/profile', {
    preHandler: [authMiddleware],
    schema: {
      tags: ['account'],
      summary: 'Update User Profile',
      description: 'Update current user profile information',
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
