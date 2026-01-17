/**
 * Admin User Routes
 */

import { FastifyInstance } from 'fastify';
import { AdminUserService } from './service';
import { authMiddleware, requireAdmin } from '@/core/auth/middleware';

export async function adminUserRoutes(fastify: FastifyInstance) {
  // Apply auth middleware to all admin user routes (before schema validation)
  fastify.addHook('onRequest', authMiddleware);
  fastify.addHook('onRequest', requireAdmin);

  // Get users list
  fastify.get('/', {
    schema: {
      tags: ['admin-users'],
      summary: 'Get users list',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 10 },
          search: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { page, limit, search } = request.query as any;
      const result = await AdminUserService.getUsers(page, limit, search);
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // Get user by ID
  fastify.get('/:id', {
    schema: {
      tags: ['admin-users'],
      summary: 'Get user by ID',
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const user = await AdminUserService.getUserById(id);
      if (!user) {
        return reply.code(404).send({ success: false, error: 'User not found' });
      }
      return reply.send({ success: true, data: user });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // Create user
  fastify.post('/', {
    schema: {
      tags: ['admin-users'],
      summary: 'Create user',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 },
          username: { type: 'string' },
          role: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const user = await AdminUserService.createUser(request.body as any);
      return reply.code(201).send({ success: true, data: user });
    } catch (error: any) {
      return reply.code(400).send({ success: false, error: error.message });
    }
  });

  // Update user
  fastify.put('/:id', {
    schema: {
      tags: ['admin-users'],
      summary: 'Update user',
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const user = await AdminUserService.updateUser(id, request.body as any);
      return reply.send({ success: true, data: user });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // Delete user
  fastify.delete('/:id', {
    schema: {
      tags: ['admin-users'],
      summary: 'Delete user',
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      await AdminUserService.deleteUser(id);
      return reply.send({ success: true, message: 'User deleted' });
    } catch (error: any) {
      if (error.code === 'P2025' || error.message === 'User not found') {
        return reply.code(404).send({ success: false, error: 'User not found' });
      }
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // Reset password
  fastify.post('/:id/reset-password', {
    schema: {
      tags: ['admin-users'],
      summary: 'Reset user password',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['newPassword'],
        properties: {
          newPassword: { type: 'string', minLength: 6 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const { newPassword } = request.body as any;
      await AdminUserService.resetPassword(id, newPassword);
      return reply.send({ success: true, message: 'Password reset successfully' });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });
}
