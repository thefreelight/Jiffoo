/**
 * Admin User Routes
 */

import { FastifyInstance } from 'fastify';
import { AdminUserService } from './service';
import { authMiddleware, requireAdmin } from '@/core/auth/middleware';
import { sendSuccess, sendError } from '@/utils/response';
import { adminUserSchemas } from './schemas';

export async function adminUserRoutes(fastify: FastifyInstance) {
  // Apply auth middleware to all admin user routes (before schema validation)
  fastify.addHook('onRequest', authMiddleware);
  fastify.addHook('onRequest', requireAdmin);

  // Get users list
  fastify.get('/', {
    schema: {
      tags: ['admin-users'],
      summary: 'Get users list',
      description: 'Get paginated list of all users (admin only)',
      security: [{ bearerAuth: [] }],
      ...adminUserSchemas.listUsers,
    }
  }, async (request, reply) => {
    try {
      const { page, limit, search } = request.query as any;
      const result = await AdminUserService.getUsers(page, limit, search);
      return sendSuccess(reply, result);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Get global user stats
  fastify.get('/stats', {
    schema: {
      tags: ['admin-users'],
      summary: 'Get user stats',
      description: 'Get global user statistics for admin customers page',
      security: [{ bearerAuth: [] }],
      ...adminUserSchemas.getUserStats,
    }
  }, async (_request, reply) => {
    try {
      const result = await AdminUserService.getUserStats();
      return sendSuccess(reply, result);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Get user by ID
  fastify.get('/:id', {
    schema: {
      tags: ['admin-users'],
      summary: 'Get user by ID',
      description: 'Get detailed information about a specific user',
      security: [{ bearerAuth: [] }],
      ...adminUserSchemas.getUser,
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const user = await AdminUserService.getUserById(id);
      if (!user) {
        return sendError(reply, 404, 'NOT_FOUND', 'User not found');
      }
      return sendSuccess(reply, user);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Create user
  fastify.post('/', {
    schema: {
      tags: ['admin-users'],
      summary: 'Create user',
      description: 'Create a new user account (admin only)',
      security: [{ bearerAuth: [] }],
      ...adminUserSchemas.createUser,
    }
  }, async (request, reply) => {
    try {
      const user = await AdminUserService.createUser(request.body as any);
      return sendSuccess(reply, user, undefined, 201);
    } catch (error: any) {
      return sendError(reply, 400, 'BAD_REQUEST', error.message);
    }
  });

  // Update user
  fastify.put('/:id', {
    schema: {
      tags: ['admin-users'],
      summary: 'Update user',
      description: 'Update user information (admin only)',
      security: [{ bearerAuth: [] }],
      ...adminUserSchemas.updateUser,
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const user = await AdminUserService.updateUser(id, request.body as any);
      return sendSuccess(reply, user);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Delete user
  fastify.delete('/:id', {
    schema: {
      tags: ['admin-users'],
      summary: 'Delete user',
      description: 'Delete a user account (admin only)',
      security: [{ bearerAuth: [] }],
      ...adminUserSchemas.deleteUser,
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const result = await AdminUserService.deleteUser(id);
      return sendSuccess(reply, {
        userId: id,
        deleted: result.deleted,
      }, 'User permanently deleted');
    } catch (error: any) {
      if (error.code === 'P2025' || error.message === 'User not found') {
        return sendError(reply, 404, 'NOT_FOUND', 'User not found');
      }
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Reset password
  fastify.post('/:id/reset-password', {
    schema: {
      tags: ['admin-users'],
      summary: 'Reset user password',
      description: 'Reset password for a specific user (admin only)',
      security: [{ bearerAuth: [] }],
      ...adminUserSchemas.resetPassword,
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const { newPassword } = request.body as any;
      await AdminUserService.resetPassword(id, newPassword);
      return sendSuccess(reply, {
        userId: id,
        passwordReset: true,
        resetAt: new Date().toISOString(),
      }, 'Password reset successfully');
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });
}
