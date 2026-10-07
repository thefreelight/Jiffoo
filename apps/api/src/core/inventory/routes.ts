import { sendMappedError } from '@/utils/api-errors';
import { FastifyInstance } from 'fastify';
import { prisma } from '@/config/database';
import { InventoryService } from './service';
import { sendError, sendSuccess } from '@/utils/response';
import { emitEvent } from '@/infra/events/emit';
import { productSnapshot } from '@/infra/events/snapshots';
import { createSuccessResponseSchema, errorResponseSchema } from '@/types/common-dto';

export async function adminInventoryRoutes(fastify: FastifyInstance) {
  fastify.get('/', async (request, reply) => {
    const { page = 1, limit = 20 } = request.query as { page?: number; limit?: number };
    return sendSuccess(reply, await InventoryService.listStock(Number(page), Number(limit)));
  });

  fastify.post('/set', {
    schema: {
      body: {
        type: 'object',
        required: ['variantId', 'quantity'],
        properties: {
          variantId: { type: 'string', minLength: 1 },
          quantity: { type: 'integer', minimum: 0 },
        },
      },
      response: {
        200: createSuccessResponseSchema({
          type: 'object',
          required: ['variantId', 'stock'],
          properties: { variantId: { type: 'string' }, stock: { type: 'integer' } },
        }),
        400: errorResponseSchema,
        401: errorResponseSchema,
        403: errorResponseSchema,
        404: errorResponseSchema,
        500: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { variantId, quantity } = request.body as { variantId?: string; quantity?: number };
    if (!variantId || !Number.isInteger(quantity) || quantity < 0) {
      return sendError(reply, 400, 'VALIDATION_ERROR', 'variantId and a non-negative integer quantity are required');
    }
    try {
      await InventoryService.setStockById(variantId, quantity);
      return sendSuccess(reply, { variantId, stock: quantity });
    } catch (error) { return sendMappedError(reply, error); }
  });

  fastify.post('/adjustments', {
    schema: {
      body: {
        type: 'object',
        required: ['variantId', 'type', 'quantity'],
        properties: {
          variantId: { type: 'string' },
          type: { type: 'string', enum: ['purchase', 'return', 'damaged', 'loss', 'correction', 'manual', 'initial'] },
          quantity: { type: 'integer' },
          reason: { type: 'string' },
          notes: { type: 'string' },
          userId: { type: 'string' },
        },
      },
      response: {
        201: createSuccessResponseSchema({
          type: 'object',
          required: ['id', 'stock', 'productId'],
          properties: {
            id: { type: 'string' }, stock: { type: 'integer' }, productId: { type: 'string' },
          },
        }),
        400: errorResponseSchema,
        401: errorResponseSchema,
        403: errorResponseSchema,
        404: errorResponseSchema,
        500: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const body = request.body as { variantId: string; quantity: number; type: string; reason?: string; notes?: string; userId?: string };
    if (!Number.isInteger(body.quantity) || body.quantity === 0) {
      return sendError(reply, 400, 'VALIDATION_ERROR', 'variantId, type, and a non-zero integer quantity are required');
    }
    try {
      return sendSuccess(reply, await InventoryService.adjustStock(body.variantId, body.quantity, body), undefined, 201);
    } catch (error) { return sendMappedError(reply, error); }
  });
}
