import { sendMappedError } from '@/utils/api-errors';
/**
 * Admin User Routes
 */

import { FastifyInstance } from 'fastify';
import { AdminUserService, CustomerManagementError } from './service';
import { sendSuccess, sendError } from '@/utils/response';
import { adminUserSchemas } from './schemas';
import { sendKnownError } from '@/utils/api-errors';
import { createCustomerExport } from './export';
import type { CustomerQuery, CustomerSelection } from './list-query';
import { getLocaleFromRequest } from '@/utils/i18n';

export async function adminUserRoutes(fastify: FastifyInstance) {
  fastify.get('/:id/neighbors', {
    schema: { tags: ['admin-users'], summary: 'Get adjacent customers in the current list', security: [{ bearerAuth: [] }], ...adminUserSchemas.neighbors },
  }, async (request, reply) => {
    try { return sendSuccess(reply, await AdminUserService.getUserNeighbors((request.params as { id: string }).id, request.query as CustomerQuery)); }
    catch (error) { return sendMappedError(reply, error); }
  });
  fastify.post('/export', {
    schema: { tags: ['admin-users'], summary: 'Export selected customers as CSV', security: [{ bearerAuth: [] }], ...adminUserSchemas.exportCustomers },
  }, async (request, reply) => {
    try {
      const body = request.body as CustomerQuery & { selection: CustomerSelection };
      const result = await createCustomerExport(body.selection, body, getLocaleFromRequest(undefined, request.headers['accept-language']));
      return reply.type('text/csv; charset=utf-8').header('Content-Disposition', `attachment; filename="${result.filename}"`).send(result.stream);
    } catch (error) { return sendMappedError(reply, error); }
  });
  // Apply auth middleware to all admin user routes (before schema validation)

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
      const result = await AdminUserService.getUsers(request.query as CustomerQuery);
      return sendSuccess(reply, result);
    } catch (error) { return sendMappedError(reply, error); }
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
    } catch (error) { return sendMappedError(reply, error); }
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
    } catch (error) { return sendMappedError(reply, error); }
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
    } catch (error) { return sendMappedError(reply, error); }
  });

  // Update user
  fastify.put('/:id', {
    preValidation: async request => {
      const body = request.body as Record<string, unknown> | null;
      if (body && Object.keys(body).some(key => !['username', 'isActive', 'role'].includes(key))) {
        throw new CustomerManagementError('Only name and active status can be changed', 'BAD_REQUEST', 400);
      }
    },
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
      const user = await AdminUserService.updateUser(id, request.body as any, request.user!.id);
      return sendSuccess(reply, user);
    } catch (error) { return sendMappedError(reply, error); }
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
      const result = await AdminUserService.deleteUser(id, request.user!.id);
      return sendSuccess(reply, {
        userId: id,
        deleted: result.deleted,
      }, 'User permanently deleted');
    } catch (error) { return sendMappedError(reply, error); }
  });

}
