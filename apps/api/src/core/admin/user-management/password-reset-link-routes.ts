import type { FastifyInstance } from 'fastify';
import { ADMIN_PERMISSIONS } from 'shared';
import { authMiddleware, requirePermission } from '@/core/auth/middleware';
import { generateCustomerResetLink } from '@/core/auth/account-recovery';
import { createTypedCreateResponses, errorResponseSchema } from '@/types/common-dto';
import { sendError, sendSuccess } from '@/utils/response';

const linkSchema = {
  type: 'object',
  properties: { link: { type: 'string', format: 'uri' } },
  required: ['link'],
  additionalProperties: false,
} as const;

export async function customerPasswordResetLinkRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', authMiddleware);
  fastify.post('/:id/password-reset-link', {
    preHandler: [requirePermission(ADMIN_PERMISSIONS.CUSTOMERS_CREDENTIALS_RESET)],
    schema: {
      tags: ['admin-customers'], security: [{ bearerAuth: [] }],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      response: { ...createTypedCreateResponses(linkSchema), 404: errorResponseSchema },
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const link = await generateCustomerResetLink(id, request.user!.id);
      return sendSuccess(reply, { link }, 'Reset link generated', 201);
    } catch {
      return sendError(reply, 404, 'NOT_FOUND', 'Customer not found');
    }
  });
}
