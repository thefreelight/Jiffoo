import type { FastifyInstance } from 'fastify';
import { createSuccessResponseSchema, createTypedCreateResponses, createTypedReadResponses, errorResponseSchema } from '@/types/common-dto';
import { sendSuccess } from '@/utils/response';
import { ApiError, sendMappedError } from '@/utils/api-errors';
import { AccountRecoveryService } from '@/core/auth/account-recovery';
import { StaffManagementService, type StaffFilter } from './service';

const adminSchema = {
  type: 'object', additionalProperties: false,
  properties: { id: { type: 'string' }, email: { type: 'string', format: 'email' }, username: { type: 'string' },
    avatar: { type: 'string', nullable: true }, isActive: { type: 'boolean' }, emailVerified: { type: 'boolean' },
    status: { type: 'string', enum: ['active', 'invited', 'removed'] }, removedAt: { type: 'string', format: 'date-time', nullable: true },
    inviteExpiresAt: { type: 'string', format: 'date-time', nullable: true }, isInstallAdmin: { type: 'boolean' },
    createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' },
  }, required: ['id', 'email', 'username', 'avatar', 'isActive', 'emailVerified', 'status', 'removedAt', 'inviteExpiresAt', 'isInstallAdmin', 'createdAt', 'updatedAt'],
} as const;
const pageSchema = {
  type: 'object', required: ['items', 'page', 'limit', 'total', 'totalPages', 'statusCounts'],
  properties: { items: { type: 'array', items: adminSchema }, page: { type: 'integer' }, limit: { type: 'integer' },
    total: { type: 'integer' }, totalPages: { type: 'integer' },
    statusCounts: { type: 'object', required: ['all', 'active', 'invited', 'removed'], properties: { all: { type: 'integer' }, active: { type: 'integer' }, invited: { type: 'integer' }, removed: { type: 'integer' } } },
  },
} as const;

export async function adminStaffRoutes(fastify: FastifyInstance) {
  const params = { type: 'object', required: ['userId'], additionalProperties: false, properties: { userId: { type: 'string', minLength: 1 } } };
  const filters = { search: { type: 'string' }, status: { type: 'string', enum: ['all', 'active', 'invited', 'removed'] } };
  const paging = { page: { type: 'integer', minimum: 1, default: 1 }, limit: { type: 'integer', enum: [20, 50, 100], default: 20 } };
  const errors = { 400: errorResponseSchema, 401: errorResponseSchema, 403: errorResponseSchema, 404: errorResponseSchema, 409: errorResponseSchema, 429: errorResponseSchema, 500: errorResponseSchema, 503: errorResponseSchema };
  const security = [{ bearerAuth: [] }];
  fastify.get('/', { schema: { tags: ['admin-staff'], security,
    querystring: { type: 'object', additionalProperties: false, properties: { ...filters, ...paging } },
    response: { ...createTypedReadResponses(pageSchema), ...errors } },
  }, async (request, reply) => {
    try { const { page = 1, limit = 20, ...filter } = request.query as StaffFilter & { page?: number; limit?: number }; return sendSuccess(reply, await StaffManagementService.listStaff(page, limit, filter)); }
    catch (error) { return sendMappedError(reply, error); }
  });
  fastify.get('/:userId/neighbors', { schema: { tags: ['admin-staff'], security, params,
    querystring: { type: 'object', additionalProperties: false, properties: filters },
    response: { ...createTypedReadResponses({ type: 'object', required: ['position', 'total', 'previousId', 'nextId'], properties: {
      position: { type: 'integer', nullable: true }, total: { type: 'integer' }, previousId: { type: 'string', nullable: true }, nextId: { type: 'string', nullable: true },
    } }), ...errors } },
  }, async (request, reply) => {
    try { return sendSuccess(reply, await StaffManagementService.neighbors((request.params as { userId: string }).userId, request.query as StaffFilter)); }
    catch (error) { return sendMappedError(reply, error); }
  });
  fastify.get('/:userId', { schema: { tags: ['admin-staff'], security, params, response: { ...createTypedReadResponses(adminSchema), ...errors } } }, async (request, reply) => {
    try { const user = await StaffManagementService.getStaffByUserId((request.params as { userId: string }).userId); if (!user) throw new ApiError('NOT_FOUND'); return sendSuccess(reply, user); }
    catch (error) { return sendMappedError(reply, error); }
  });
  fastify.get('/:userId/audit', { schema: { tags: ['admin-staff'], security, params,
    querystring: { type: 'object', additionalProperties: false, properties: paging },
    response: { ...createTypedReadResponses({ type: 'object', required: ['items', 'page', 'limit', 'total', 'totalPages'], properties: {
      page: { type: 'integer' }, limit: { type: 'integer' }, total: { type: 'integer' }, totalPages: { type: 'integer' },
      items: { type: 'array', items: { type: 'object', required: ['id', 'staffUserId', 'staffEmail', 'action', 'createdAt'], properties: {
        id: { type: 'string' }, staffUserId: { type: 'string' }, staffEmail: { type: 'string' }, staffUsername: { type: 'string', nullable: true },
        actorUserId: { type: 'string', nullable: true }, actorEmail: { type: 'string', nullable: true }, actorUsername: { type: 'string', nullable: true },
        action: { type: 'string' }, createdAt: { type: 'string', format: 'date-time' },
        metadata: { type: 'object', nullable: true, additionalProperties: true, properties: { reinvite: { type: 'boolean' } } },
      } } },
    } }), ...errors } },
  }, async (request, reply) => {
    try { const { page = 1, limit = 20 } = request.query as { page?: number; limit?: number }; return sendSuccess(reply, await StaffManagementService.getStaffAuditLogs((request.params as { userId: string }).userId, page, limit)); }
    catch (error) { return sendMappedError(reply, error); }
  });
  fastify.post('/', { schema: { tags: ['admin-staff'], security,
    body: { type: 'object', required: ['email', 'username'], additionalProperties: false, properties: { email: { type: 'string', format: 'email' }, username: { type: 'string', minLength: 1, maxLength: 50 }, role: false } },
    response: { ...createTypedCreateResponses(adminSchema), ...errors } },
  }, async (request, reply) => {
    try { return sendSuccess(reply, await StaffManagementService.createStaff(request.user!.id, request.body as { email: string; username: string }), undefined, 201); }
    catch (error) { return sendMappedError(reply, error); }
  });
  fastify.delete('/:userId', { schema: { tags: ['admin-staff'], security, params,
    response: { 200: createSuccessResponseSchema({ type: 'object', required: ['userId', 'removed'], properties: { userId: { type: 'string' }, removed: { type: 'boolean' } } }), ...errors } },
  }, async (request, reply) => {
    try { return sendSuccess(reply, await StaffManagementService.removeStaff(request.user!.id, (request.params as { userId: string }).userId)); }
    catch (error) { return sendMappedError(reply, error); }
  });
  fastify.post('/:userId/reinvite', { schema: { tags: ['admin-staff'], security, params, response: { ...createTypedCreateResponses(adminSchema), ...errors } } }, async (request, reply) => {
    try { return sendSuccess(reply, await StaffManagementService.reinviteStaff(request.user!.id, (request.params as { userId: string }).userId), undefined, 201); }
    catch (error) { return sendMappedError(reply, error); }
  });
  fastify.post('/:userId/invite', { schema: { tags: ['admin-staff'], security, params,
    response: { 200: createSuccessResponseSchema({ type: 'object', required: ['userId', 'queued'], properties: { userId: { type: 'string' }, queued: { type: 'boolean' } } }), ...errors } },
  }, async (request, reply) => {
    try { return sendSuccess(reply, await StaffManagementService.resendStaffInvite((request.params as { userId: string }).userId)); }
    catch (error) { return sendMappedError(reply, error); }
  });
  fastify.post('/:userId/invite-link', { schema: { tags: ['admin-staff'], security, params,
    response: { ...createTypedCreateResponses({ type: 'object', required: ['link'], properties: { link: { type: 'string', format: 'uri' } } }), ...errors } },
  }, async (request, reply) => {
    try { return sendSuccess(reply, { link: await AccountRecoveryService.generateStaffInviteLink((request.params as { userId: string }).userId) }, undefined, 201); }
    catch (error) { return sendMappedError(reply, error); }
  });
}
