import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { env } from '@/config/env';
import { sendError, sendSuccess } from '@/utils/response';
import { AdminCatalogImportService, type CatalogImportBatchInput } from './service';

function readImportToken(request: FastifyRequest): string {
  const direct = request.headers['x-catalog-import-token'];
  if (typeof direct === 'string' && direct.trim()) return direct.trim();

  const auth = request.headers.authorization;
  if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }

  return '';
}

function ensureImportAuth(request: FastifyRequest, reply: FastifyReply): boolean {
  const configured = env.CATALOG_IMPORT_TOKEN?.trim();
  if (!configured) {
    void sendError(reply, 503, 'CATALOG_IMPORT_DISABLED', 'Catalog import token is not configured');
    return false;
  }

  const provided = readImportToken(request);
  if (!provided || provided !== configured) {
    void sendError(reply, 401, 'UNAUTHORIZED', 'Invalid catalog import token');
    return false;
  }

  return true;
}

export async function adminCatalogImportRoutes(fastify: FastifyInstance) {
  fastify.post<{
    Body: CatalogImportBatchInput;
  }>(
    '/sync-batch',
    {
      schema: {
        tags: ['admin-catalog-import'],
        summary: 'Import external catalog batch',
        description: 'Upsert categories, products, variants and external links from an integration provider',
        body: {
          type: 'object',
          required: ['provider', 'installationId', 'storeId'],
          properties: {
            provider: { type: 'string', minLength: 1 },
            installationId: { type: 'string', minLength: 1 },
            storeId: { type: 'string', minLength: 1 },
            runId: { type: 'string' },
            categories: {
              type: 'array',
              items: {
                type: 'object',
                required: ['externalCode', 'name'],
                properties: {
                  externalCode: { type: 'string' },
                  name: { type: 'string' },
                  slug: { type: 'string' },
                  description: { type: 'string' },
                  parentExternalCode: { type: 'string' },
                  level: { type: 'integer' },
                  sortOrder: { type: 'integer' },
                  isActive: { type: 'boolean' },
                  externalHash: { type: 'string' },
                },
              },
            },
            products: {
              type: 'array',
              items: {
                type: 'object',
                required: ['externalProductCode', 'name', 'variants'],
                properties: {
                  externalProductCode: { type: 'string' },
                  name: { type: 'string' },
                  slug: { type: 'string' },
                  description: { type: 'string' },
                  categoryExternalCode: { type: 'string' },
                  productType: { type: 'string' },
                  requiresShipping: { type: 'boolean' },
                  images: { type: 'array', items: { type: 'string' } },
                  typeData: { type: 'object', additionalProperties: true },
                  isActive: { type: 'boolean' },
                  externalHash: { type: 'string' },
                  variants: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['externalVariantCode', 'name', 'basePrice', 'baseStock'],
                      properties: {
                        externalVariantCode: { type: 'string' },
                        name: { type: 'string' },
                        skuCode: { type: 'string' },
                        basePrice: { type: 'number' },
                        baseStock: { type: 'integer' },
                        sortOrder: { type: 'integer' },
                        isActive: { type: 'boolean' },
                        attributes: { type: 'object', additionalProperties: true },
                        externalHash: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      if (!ensureImportAuth(request, reply)) return;

      try {
        const payload = request.body as CatalogImportBatchInput;
        const result = await AdminCatalogImportService.importBatch(payload);
        return sendSuccess(reply, result, undefined, 200);
      } catch (error: any) {
        if (error?.message?.includes('Store not found')) {
          return sendError(reply, 400, 'VALIDATION_ERROR', error.message);
        }
        return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error?.message || 'Catalog import failed');
      }
    }
  );
}
