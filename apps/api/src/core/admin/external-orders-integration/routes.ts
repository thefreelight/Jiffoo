import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { env } from '@/config/env';
import { ExternalOrderService } from '@/core/external-orders/service';
import { sendError, sendSuccess } from '@/utils/response';

type SupplierOrderStatusItem = {
  provider: string;
  installationId: string;
  externalOrderRef?: string | null;
  externalOrderName?: string | null;
  externalStatus?: string | null;
  productCode?: string | null;
  planId?: string | null;
  qrCodeContent?: string | null;
  cardUid?: string | null;
  rawResponse?: Record<string, unknown> | null;
};

function readIntegrationToken(request: FastifyRequest): string {
  const direct = request.headers['x-catalog-import-token'];
  if (typeof direct === 'string' && direct.trim()) return direct.trim();

  const auth = request.headers.authorization;
  if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }

  return '';
}

function ensureIntegrationAuth(request: FastifyRequest, reply: FastifyReply): boolean {
  const configured = env.CATALOG_IMPORT_TOKEN?.trim();
  if (!configured) {
    void sendError(reply, 503, 'EXTERNAL_ORDER_SYNC_DISABLED', 'Integration token is not configured');
    return false;
  }

  const provided = readIntegrationToken(request);
  if (!provided || provided !== configured) {
    void sendError(reply, 401, 'UNAUTHORIZED', 'Invalid integration token');
    return false;
  }

  return true;
}

export async function adminExternalOrdersIntegrationRoutes(fastify: FastifyInstance) {
  fastify.post<{
    Body: {
      updates?: SupplierOrderStatusItem[];
    };
  }>(
    '/sync-status',
    {
      schema: {
        tags: ['admin-external-orders'],
        summary: 'Apply supplier push status updates',
        description: 'Apply supplier push callbacks to external order links and order item fulfillment status',
        body: {
          type: 'object',
          required: ['updates'],
          properties: {
            updates: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'object',
                required: ['provider', 'installationId'],
                properties: {
                  provider: { type: 'string', minLength: 1 },
                  installationId: { type: 'string', minLength: 1 },
                  externalOrderRef: { type: 'string' },
                  externalOrderName: { type: 'string' },
                  externalStatus: { type: 'string' },
                  productCode: { type: 'string' },
                  planId: { type: 'string' },
                  qrCodeContent: { type: 'string' },
                  cardUid: { type: 'string' },
                  rawResponse: { type: 'object', additionalProperties: true },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      if (!ensureIntegrationAuth(request, reply)) return;

      const updates = Array.isArray(request.body?.updates) ? request.body.updates : [];
      if (updates.length === 0) {
        return sendError(reply, 400, 'VALIDATION_ERROR', 'updates must contain at least one item');
      }

      try {
        let matched = 0;
        for (const update of updates) {
          matched += await ExternalOrderService.applySupplierPushStatus(update);
        }
        return sendSuccess(reply, { matched, received: updates.length }, undefined, 200);
      } catch (error: any) {
        return sendError(reply, 400, 'VALIDATION_ERROR', error?.message || 'Failed to apply supplier push status');
      }
    }
  );
}

