import { FastifyInstance } from 'fastify';
import { authMiddleware, requirePermission } from '@/core/auth/middleware';
import { ADMIN_PERMISSIONS } from 'shared';
import { sendError, sendSuccess } from '@/utils/response';
import { StaffManagementError, StaffManagementService } from './service';

function mapStaffError(error: unknown, reply: any) {
  if (error instanceof StaffManagementError) {
    return sendError(reply, error.statusCode, error.code, error.message);
  }

  return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error instanceof Error ? error.message : 'Staff management failed');
}

export async function adminStaffRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', authMiddleware);

  fastify.get('/roles', {
    preHandler: [requirePermission(ADMIN_PERMISSIONS.STAFF_READ)],
    schema: {
      tags: ['admin-staff'],
      summary: 'List default admin roles',
      security: [{ bearerAuth: [] }],
    },
  }, async (_request, reply) => {
    return sendSuccess(reply, StaffManagementService.getRoleCatalog());
  });

  fastify.get('/permissions', {
    preHandler: [requirePermission(ADMIN_PERMISSIONS.STAFF_READ)],
    schema: {
      tags: ['admin-staff'],
      summary: 'List permission catalog',
      security: [{ bearerAuth: [] }],
    },
  }, async (_request, reply) => {
    return sendSuccess(reply, StaffManagementService.getPermissionCatalog());
  });

  fastify.get('/', {
    preHandler: [requirePermission(ADMIN_PERMISSIONS.STAFF_READ)],
    schema: {
      tags: ['admin-staff'],
      summary: 'List staff members',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          search: { type: 'string' },
          role: { type: 'string' },
          status: { type: 'string', enum: ['ACTIVE', 'SUSPENDED'] },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { page, limit, search, role, status } = request.query as {
        page?: number;
        limit?: number;
        search?: string;
        role?: string;
        status?: string;
      };

      const result = await StaffManagementService.listStaff(page, limit, { search, role, status });
      return sendSuccess(reply, result);
    } catch (error) {
      return mapStaffError(error, reply);
    }
  });

  fastify.get('/:userId', {
    preHandler: [requirePermission(ADMIN_PERMISSIONS.STAFF_READ)],
    schema: {
      tags: ['admin-staff'],
      summary: 'Get staff member detail',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    try {
      const { userId } = request.params as { userId: string };
      const result = await StaffManagementService.getStaffByUserId(userId);
      if (!result) {
        return sendError(reply, 404, 'NOT_FOUND', 'Staff membership not found');
      }

      return sendSuccess(reply, result);
    } catch (error) {
      return mapStaffError(error, reply);
    }
  });

  fastify.get('/:userId/audit', {
    preHandler: [requirePermission(ADMIN_PERMISSIONS.STAFF_READ)],
    schema: {
      tags: ['admin-staff'],
      summary: 'List staff audit log entries',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { userId } = request.params as { userId: string };
      const { page, limit } = request.query as { page?: number; limit?: number };
      const result = await StaffManagementService.getStaffAuditLogs(userId, page, limit);
      return sendSuccess(reply, result);
    } catch (error) {
      return mapStaffError(error, reply);
    }
  });

  fastify.post('/:userId/invite', {
    preHandler: [requirePermission(ADMIN_PERMISSIONS.STAFF_WRITE)],
    schema: {
      tags: ['admin-staff'],
      summary: 'Resend staff invitation email',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    try {
      const { userId } = request.params as { userId: string };
      const result = await StaffManagementService.resendStaffInvite(
        {
          userId: request.user!.id,
          permissions: request.user!.permissions ?? [],
          isOwner: request.user!.isOwner ?? false,
        },
        userId,
      );
      return sendSuccess(reply, result);
    } catch (error) {
      return mapStaffError(error, reply);
    }
  });

  fastify.post('/', {
    preHandler: [requirePermission(ADMIN_PERMISSIONS.STAFF_WRITE)],
    schema: {
      tags: ['admin-staff'],
      summary: 'Create or grant staff access',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    try {
      const result = await StaffManagementService.createStaff(
        {
          userId: request.user!.id,
          permissions: request.user!.permissions ?? [],
          isOwner: request.user!.isOwner ?? false,
        },
        request.body as any,
      );
      return sendSuccess(reply, result, undefined, 201);
    } catch (error) {
      return mapStaffError(error, reply);
    }
  });

  fastify.patch('/:userId', {
    preHandler: [requirePermission(ADMIN_PERMISSIONS.STAFF_WRITE)],
    schema: {
      tags: ['admin-staff'],
      summary: 'Update staff role and permissions',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    try {
      const { userId } = request.params as { userId: string };
      const result = await StaffManagementService.updateStaff(
        {
          userId: request.user!.id,
          permissions: request.user!.permissions ?? [],
          isOwner: request.user!.isOwner ?? false,
        },
        userId,
        request.body as any,
      );
      return sendSuccess(reply, result);
    } catch (error) {
      return mapStaffError(error, reply);
    }
  });

  fastify.delete('/:userId', {
    preHandler: [requirePermission(ADMIN_PERMISSIONS.STAFF_WRITE)],
    schema: {
      tags: ['admin-staff'],
      summary: 'Remove staff access',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    try {
      const { userId } = request.params as { userId: string };
      const result = await StaffManagementService.removeStaff(
        {
          userId: request.user!.id,
          permissions: request.user!.permissions ?? [],
          isOwner: request.user!.isOwner ?? false,
        },
        userId,
      );
      return sendSuccess(reply, result);
    } catch (error) {
      return mapStaffError(error, reply);
    }
  });
}
