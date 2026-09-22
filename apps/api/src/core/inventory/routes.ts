import { FastifyInstance } from 'fastify';
import { prisma } from '@/config/database';
import { InventoryService } from './service';
import { sendError, sendSuccess } from '@/utils/response';
import { authMiddleware, requirePermission } from '@/core/auth/middleware';
import { ADMIN_PERMISSIONS } from '@shared/security';

export async function adminInventoryRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', authMiddleware);
  fastify.get('/', { preHandler: [requirePermission(ADMIN_PERMISSIONS.INVENTORY_READ)] }, async (request, reply) => {
    const { page = 1, limit = 20 } = request.query as { page?: number; limit?: number };
    return sendSuccess(reply, await InventoryService.listStock(Number(page), Number(limit)));
  });

  fastify.post('/set', { preHandler: [requirePermission(ADMIN_PERMISSIONS.INVENTORY_WRITE)] }, async (request, reply) => {
    const { variantId, quantity } = request.body as { variantId?: string; quantity?: number };
    if (!variantId || !Number.isInteger(quantity) || quantity < 0) {
      return sendError(reply, 400, 'VALIDATION_ERROR', 'variantId and a non-negative integer quantity are required');
    }
    try {
      await InventoryService.setStock(prisma, variantId, quantity);
      return sendSuccess(reply, { variantId, stock: quantity });
    } catch (error: any) {
      return sendError(reply, 404, 'NOT_FOUND', error.message);
    }
  });

  fastify.post('/adjustments', {
    preHandler: [requirePermission(ADMIN_PERMISSIONS.INVENTORY_WRITE)],
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
    },
  }, async (request, reply) => {
    const body = request.body as { variantId: string; quantity: number; type: string; reason?: string; notes?: string; userId?: string };
    if (!Number.isInteger(body.quantity) || body.quantity === 0) {
      return sendError(reply, 400, 'VALIDATION_ERROR', 'variantId, type, and a non-zero integer quantity are required');
    }
    try {
      return sendSuccess(reply, await InventoryService.adjustStock(body.variantId, body.quantity, body), undefined, 201);
    } catch (error: any) {
      return sendError(reply, 404, 'NOT_FOUND', error.message);
    }
  });
}
