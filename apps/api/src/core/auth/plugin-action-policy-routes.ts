import type { FastifyInstance } from 'fastify';
import { prisma } from '@/config/database';
import { verifiedRequestSession } from './middleware';
import { requirePluginPolicyAuthority, setPluginActionGrant } from './plugin-action-authorization';
import { ApiError, sendMappedError } from '@/utils/api-errors';
import { sendSuccess } from '@/utils/response';
import { createTypedReadResponses, createTypedUpdateResponses, errorResponseSchema } from '@/types/common-dto';

export async function pluginActionPolicyRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (_request, reply) => { reply.header('Cache-Control', 'no-store'); });
  const value = { type: 'string', minLength: 1, maxLength: 128 } as const;
  const params = { type: 'object', required: ['installationId', 'principalId', 'action'], additionalProperties: false, properties: { installationId: value, principalId: value, action: value } } as const;
  const keyProperties = { installationId: value, principalId: value, action: value };
  const grantSchema = { type: 'object', additionalProperties: false, required: ['installationId', 'principalId', 'action', 'granted'], properties: { ...keyProperties, granted: { type: 'boolean' } } };
  const response = { ...createTypedUpdateResponses(grantSchema), 409: errorResponseSchema };
  const listResponse = { ...createTypedReadResponses({ type: 'object', additionalProperties: false, required: ['items'], properties: { items: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['installationId', 'principalId', 'action'], properties: keyProperties } } } }), 400: errorResponseSchema };
  for (const method of ['PUT', 'DELETE'] as const) app.route<{ Params: { installationId: string; principalId: string; action: string } }>({
    method, url: '/grants/:installationId/:principalId/:action', schema: { tags: ['admin-plugin-policy'], summary: method === 'PUT' ? 'Grant an administrator plugin action' : 'Revoke an administrator plugin action', security: [{ bearerAuth: [] }], params, response },
    handler: async (request, reply) => {
      try {
        const session = verifiedRequestSession(request);
        if (!session) throw new ApiError('UNAUTHORIZED');
        const result = await prisma.$transaction(async tx => {
          await tx.$queryRaw`SELECT id FROM public.users WHERE id = ${session.userId} FOR SHARE`;
          const live = await tx.user.findUnique({ where: { id: session.userId }, select: { sessionVersion: true } });
          if (live?.sessionVersion !== session.sessionVersion) throw new ApiError('SESSION_REVOKED');
          return setPluginActionGrant(tx, session.userId, { ...request.params, granted: method === 'PUT' });
        }, { timeout: 5000 });
        return sendSuccess(reply, result);
      } catch (error) { return sendMappedError(reply, error); }
    },
  });
  app.get<{ Querystring: { installationId: string; principalId: string } }>('/grants', {
    schema: { tags: ['admin-plugin-policy'], summary: 'Read administrator plugin action grants', security: [{ bearerAuth: [] }], querystring: { type: 'object', required: ['installationId', 'principalId'], additionalProperties: false, properties: { installationId: value, principalId: value } }, response: listResponse },
  }, async (request, reply) => {
    try {
      const session = verifiedRequestSession(request);
      if (!session) throw new ApiError('UNAUTHORIZED');
      const result = await prisma.$transaction(async tx => {
        await requirePluginPolicyAuthority(tx, session.userId);
        const live = await tx.user.findUniqueOrThrow({ where: { id: session.userId }, select: { sessionVersion: true } });
        if (live.sessionVersion !== session.sessionVersion) throw new ApiError('SESSION_REVOKED');
        return { items: await tx.pluginActionGrant.findMany({ where: request.query, select: { installationId: true, principalId: true, action: true }, take: 100, orderBy: { action: 'asc' } }) };
      }, { timeout: 5000 });
      return sendSuccess(reply, result);
    } catch (error) { return sendMappedError(reply, error); }
  });
}
