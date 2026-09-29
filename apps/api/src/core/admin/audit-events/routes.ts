import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/config/database';
import { sendError, sendSuccess } from '@/utils/response';
import { filtersSchema, pageSchema, querySchema, responses, strictQueryValidator } from './schemas';

type Query = {
  actorId?: string; action?: string; targetType?: string; from?: string; to?: string;
  page?: number; limit?: number;
};
const actorFields = { id: true, email: true, username: true, isActive: true } as const;
const metadata = { tags: ['admin-audit-events'], security: [{ bearerAuth: [] }] };

export async function adminAuditEventRoutes(fastify: FastifyInstance) {
  fastify.get<{ Querystring: Query }>('/', {
    validatorCompiler: strictQueryValidator,
    schema: { ...metadata, querystring: querySchema, response: responses(pageSchema) },
  }, async (request, reply) => {
    const { actorId, action, targetType, from, to, page = 1, limit = 20 } = request.query;
    if (from && to && new Date(from) > new Date(to)) {
      return sendError(reply, 400, 'INVALID_TIME_RANGE', 'From must not be later than to');
    }
    const where: Prisma.AdminAuditEventWhereInput = {
      ...(actorId ? { actorId } : {}), ...(action ? { action } : {}),
      ...(targetType ? { targetType } : {}),
      ...((from || to) ? { createdAt: {
        ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}),
      } } : {}),
    };
    const [records, total] = await Promise.all([
      prisma.adminAuditEvent.findMany({
        where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit, take: limit,
      }),
      prisma.adminAuditEvent.count({ where }),
    ]);
    const users = await prisma.user.findMany({
      where: { id: { in: [...new Set(records.map((item) => item.actorId))] } }, select: actorFields,
    });
    const actors = new Map(users.map((user) => [user.id, user]));
    const items = records.map(({ actorId: id, ...record }) => ({ ...record, actor: actors.get(id) ?? null }));
    return sendSuccess(reply, { items, page, limit, total, totalPages: Math.ceil(total / limit) });
  });

  fastify.get('/filters', {
    validatorCompiler: strictQueryValidator,
    schema: {
      ...metadata, querystring: { type: 'object', properties: {}, additionalProperties: false },
      response: responses(filtersSchema),
    },
  }, async (_request, reply) => {
    const [actions, targetTypes, actorIds] = await Promise.all([
      prisma.adminAuditEvent.findMany({ distinct: ['action'], select: { action: true }, orderBy: { action: 'asc' } }),
      prisma.adminAuditEvent.findMany({ distinct: ['targetType'], select: { targetType: true }, orderBy: { targetType: 'asc' } }),
      prisma.adminAuditEvent.findMany({ distinct: ['actorId'], select: { actorId: true } }),
    ]);
    const actors = await prisma.user.findMany({
      where: { id: { in: actorIds.map((item) => item.actorId) } }, select: actorFields,
      orderBy: [{ email: 'asc' }, { id: 'asc' }],
    });
    return sendSuccess(reply, {
      actions: actions.map((item) => item.action),
      targetTypes: targetTypes.map((item) => item.targetType), actors,
    });
  });
}
