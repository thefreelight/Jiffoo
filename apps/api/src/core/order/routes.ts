/**
 * Order Routes (Multi-Store Version)
 */

import { FastifyInstance } from 'fastify';
import { OrderService } from './service';
import { authMiddleware } from '@/core/auth/middleware';
import { storeContextMiddleware } from '@/middleware/store-context';
import { sendSuccess, sendError } from '@/utils/response';
import { orderSchemas } from './schemas';

export async function orderRoutes(fastify: FastifyInstance) {
  // Apply auth and store context middleware to all order routes (before schema validation)
  fastify.addHook('onRequest', authMiddleware);
  fastify.addHook('onRequest', storeContextMiddleware);

  // Create order
  fastify.post('/', {
    schema: {
      tags: ['orders'],
      summary: 'Create order',
      description: 'Create a new order from the shopping cart or specified items',
      security: [{ bearerAuth: [] }],
      ...orderSchemas.createOrder,
    }
  }, async (request, reply) => {
    try {
      const payload = request.body as any;
      const order = await OrderService.createOrder(
        request.user!.id,
        payload
      );
      const statusCode =
        Array.isArray(payload?.discountCodes) && payload.discountCodes.length > 0 ? 200 : 201;
      return sendSuccess(reply, order, undefined, statusCode);
    } catch (error: any) {
      return sendError(reply, 400, 'BAD_REQUEST', error.message);
    }
  });

  // Get user orders
  fastify.get('/', {
    schema: {
      tags: ['orders'],
      summary: 'Get user orders',
      description: 'Get paginated list of orders for the current user',
      security: [{ bearerAuth: [] }],
      ...orderSchemas.listOrders,
    }
  }, async (request, reply) => {
    try {
      const { page, limit, status } = request.query as any;
      const result = await OrderService.getUserOrders(
        request.user!.id,
        page,
        limit,
        status
      );
      return sendSuccess(reply, result);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Get order by ID
  fastify.get('/:id', {
    schema: {
      tags: ['orders'],
      summary: 'Get order by ID',
      description: 'Get detailed information about a specific order',
      security: [{ bearerAuth: [] }],
      ...orderSchemas.getOrder,
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const order = await OrderService.getOrderById(id, request.user!.id);
      if (!order) {
        return sendError(reply, 404, 'NOT_FOUND', 'Order not found');
      }
      return sendSuccess(reply, order);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Cancel order
  fastify.post('/:id/cancel', {
    schema: {
      tags: ['orders'],
      summary: 'Cancel order',
      description: 'Cancel a pending order with a reason',
      security: [{ bearerAuth: [] }],
      ...orderSchemas.cancelOrder,
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const { cancelReason } = request.body as any;
      const order = await OrderService.cancelOrder(id, request.user!.id, cancelReason);
      return sendSuccess(reply, order);
    } catch (error: any) {
      if (error?.message === 'Order not found') {
        return sendError(reply, 404, 'NOT_FOUND', 'Order not found');
      }
      return sendError(reply, 400, 'BAD_REQUEST', error.message);
    }
  });
}
