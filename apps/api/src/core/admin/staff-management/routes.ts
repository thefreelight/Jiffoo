import type { FastifyInstance } from 'fastify';
import { createSuccessResponseSchema, createTypedCreateResponses, createTypedReadResponses, errorResponseSchema } from '@/types/common-dto';
import { sendError, sendSuccess } from '@/utils/response';
import { generateStaffInviteLink } from '@/core/auth/account-recovery';
import { StaffManagementError, StaffManagementService } from './service';

const adminSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' }, email: { type: 'string' }, username: { type: 'string' },
    role: { type: 'string' }, isActive: { type: 'boolean' }, emailVerified: { type: 'boolean' },
    isInstallAdmin: { type: 'boolean' },
  },
  required: ['id', 'email', 'username', 'role', 'isActive', 'emailVerified', 'isInstallAdmin'],
} as const;

const pageSchema = {
  type: 'object',
  properties: {
    items: { type: 'array', items: adminSchema },
    page: { type: 'integer' }, limit: { type: 'integer' },
    total: { type: 'integer' }, totalPages: { type: 'integer' },
  },
  required: ['items', 'page', 'limit', 'total', 'totalPages'],
} as const;

function handleError(error: unknown, reply: any) {
  if (error instanceof StaffManagementError) {
    return sendError(reply, error.statusCode, error.code, error.message);
  }
  throw error;
}

export async function adminStaffRoutes(fastify: FastifyInstance) {
  fastify.get('/', {
    schema: { tags: ['admin-staff'], security: [{ bearerAuth: [] }], response: createTypedReadResponses(pageSchema) },
  }, async (request, reply) => {
    const { page = 1, limit = 20, search } = request.query as { page?: number; limit?: number; search?: string };
    return sendSuccess(reply, await StaffManagementService.listStaff(Number(page), Number(limit), { search }));
  });

  fastify.get('/:userId', {
    schema: { tags: ['admin-staff'], security: [{ bearerAuth: [] }], response: createTypedReadResponses(adminSchema) },
  }, async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const user = await StaffManagementService.getStaffByUserId(userId);
    return user ? sendSuccess(reply, user) : sendError(reply, 404, 'NOT_FOUND', 'Administrator not found');
  });

  fastify.get('/:userId/audit', {
    schema: { tags: ['admin-staff'], security: [{ bearerAuth: [] }], response: createTypedReadResponses({
      type: 'object', properties: { items: { type: 'array', items: { type: 'object', additionalProperties: true } }, page: { type: 'integer' }, limit: { type: 'integer' }, total: { type: 'integer' }, totalPages: { type: 'integer' } },
    }) },
  }, async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const { page = 1, limit = 20 } = request.query as { page?: number; limit?: number };
    return sendSuccess(reply, await StaffManagementService.getStaffAuditLogs(userId, Number(page), Number(limit)));
  });

  fastify.post('/', {
    schema: {
      tags: ['admin-staff'], security: [{ bearerAuth: [] }],
      body: { type: 'object', required: ['email', 'username'], additionalProperties: false,
        properties: { email: { type: 'string', format: 'email' }, username: { type: 'string', minLength: 1 }, role: false } },
      response: createTypedCreateResponses(adminSchema),
    },
  }, async (request, reply) => {
    try {
      return sendSuccess(reply, await StaffManagementService.createStaff(request.user!.id, request.body as { email: string; username: string }), undefined, 201);
    } catch (error) {
      return handleError(error, reply);
    }
  });

  fastify.delete('/:userId', {
    schema: {
      tags: ['admin-staff'], security: [{ bearerAuth: [] }],
      response: { 200: createSuccessResponseSchema({ type: 'object', properties: { userId: { type: 'string' }, removed: { type: 'boolean' } } }),
        401: errorResponseSchema, 403: errorResponseSchema, 404: errorResponseSchema, 409: errorResponseSchema, 500: errorResponseSchema },
    },
  }, async (request, reply) => {
    try {
      return sendSuccess(reply, await StaffManagementService.removeStaff(request.user!.id, (request.params as { userId: string }).userId));
    } catch (error) {
      return handleError(error, reply);
    }
  });

  fastify.post('/:userId/invite', {
    schema: { tags: ['admin-staff'], security: [{ bearerAuth: [] }],
      response: { 200: createSuccessResponseSchema({ type: 'object', properties: { userId: { type: 'string' }, queued: { type: 'boolean' } } }),
        401: errorResponseSchema, 403: errorResponseSchema, 409: errorResponseSchema, 500: errorResponseSchema } },
  }, async (request, reply) => {
    try {
      return sendSuccess(reply, await StaffManagementService.resendStaffInvite((request.params as { userId: string }).userId));
    } catch (error) {
      return handleError(error, reply);
    }
  });

  fastify.post('/:userId/invite-link', {
    schema: { tags: ['admin-staff'], security: [{ bearerAuth: [] }],
      response: { ...createTypedCreateResponses({ type: 'object', properties: { link: { type: 'string' } } }) } },
  }, async (request, reply) => {
    try {
      return sendSuccess(reply, { link: await generateStaffInviteLink((request.params as { userId: string }).userId) }, undefined, 201);
    } catch {
      return sendError(reply, 409, 'INVITE_NOT_AVAILABLE', 'Invitation not available');
    }
  });
}
