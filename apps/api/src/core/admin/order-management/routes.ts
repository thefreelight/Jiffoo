/**
 * Admin Order Routes
 */

import { FastifyInstance } from 'fastify';
import { AdminOrderService } from './service';
import { authMiddleware, requireAdmin } from '@/core/auth/middleware';
import { storeContextMiddleware } from '@/middleware/store-context';
import { sendSuccess, sendError } from '@/utils/response';
import { adminOrderSchemas } from './schemas';
import { mapAdminOrderRouteError } from '@/utils/route-error-mapper';

export async function adminOrderRoutes(fastify: FastifyInstance) {
  // Apply auth middleware to all admin order routes (before schema validation)
  fastify.addHook('onRequest', authMiddleware);
  fastify.addHook('onRequest', requireAdmin);
  fastify.addHook('onRequest', storeContextMiddleware);

  // Get orders list
  fastify.get('/', {
    schema: {
      tags: ['admin-orders'],
      summary: 'Get orders list',
      description: 'Get paginated list of all orders (admin only)',
      security: [{ bearerAuth: [] }],
      ...adminOrderSchemas.listOrders,
    }
  }, async (request, reply) => {
    try {
      const { page, limit, status, search } = request.query as any;
      const storeId = request.storeContext?.id;
      const result = await AdminOrderService.getOrders(page, limit, status, search, storeId);
      return sendSuccess(reply, result);
    } catch (error: unknown) {
      const mapped = mapAdminOrderRouteError(error, {
        defaultStatus: 500,
        defaultCode: 'INTERNAL_SERVER_ERROR',
        defaultMessage: 'Failed to fetch orders',
      });
      return sendError(reply, mapped.status, mapped.code, mapped.message, mapped.details);
    }
  });

  // Get global order stats
  fastify.get('/stats', {
    schema: {
      tags: ['admin-orders'],
      summary: 'Get order stats',
      description: 'Get global order statistics for admin orders page',
      security: [{ bearerAuth: [] }],
      ...adminOrderSchemas.getOrderStats,
    }
  }, async (_request, reply) => {
    try {
      const result = await AdminOrderService.getOrderStats();
      return sendSuccess(reply, result);
    } catch (error: unknown) {
      const mapped = mapAdminOrderRouteError(error, {
        defaultStatus: 500,
        defaultCode: 'INTERNAL_SERVER_ERROR',
        defaultMessage: 'Failed to fetch order stats',
      });
      return sendError(reply, mapped.status, mapped.code, mapped.message, mapped.details);
    }
  });

  // Get order by ID
  fastify.get('/:id', {
    schema: {
      tags: ['admin-orders'],
      summary: 'Get order by ID',
      description: 'Get detailed order information (admin only)',
      security: [{ bearerAuth: [] }],
      ...adminOrderSchemas.getOrder,
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const order = await AdminOrderService.getOrderById(id);
      if (!order) {
        return sendError(reply, 404, 'NOT_FOUND', 'Order not found');
      }
      return sendSuccess(reply, order);
    } catch (error: unknown) {
      const mapped = mapAdminOrderRouteError(error, {
        defaultStatus: 500,
        defaultCode: 'INTERNAL_SERVER_ERROR',
        defaultMessage: 'Failed to get order',
      });
      return sendError(reply, mapped.status, mapped.code, mapped.message, mapped.details);
    }
  });

  // Update order status
  fastify.put('/:id/status', {
    schema: {
      tags: ['admin-orders'],
      summary: 'Update order status',
      description: 'Update the status of an order (admin only)',
      security: [{ bearerAuth: [] }],
      ...adminOrderSchemas.updateStatus,
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const { status } = request.body as any;
      const order = await AdminOrderService.updateOrderStatus(id, status);
      return sendSuccess(reply, order);
    } catch (error: unknown) {
      const mapped = mapAdminOrderRouteError(error, {
        defaultStatus: 500,
        defaultCode: 'INTERNAL_SERVER_ERROR',
        defaultMessage: 'Failed to update order status',
      });
      return sendError(reply, mapped.status, mapped.code, mapped.message, mapped.details);
    }
  });

  // Ship order
  fastify.post('/:id/ship', {
    schema: {
      tags: ['admin-orders'],
      summary: 'Ship order with tracking info',
      description: 'Mark order as shipped and add tracking information (admin only)',
      security: [{ bearerAuth: [] }],
      ...adminOrderSchemas.shipOrder,
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const data = request.body as any;
      const result = await AdminOrderService.shipOrder(id, data);
      return sendSuccess(reply, result);
    } catch (error: unknown) {
      const mapped = mapAdminOrderRouteError(error, {
        defaultStatus: 500,
        defaultCode: 'INTERNAL_SERVER_ERROR',
        defaultMessage: 'Failed to ship order',
      });
      return sendError(reply, mapped.status, mapped.code, mapped.message, mapped.details);
    }
  });

  // Refund order
  fastify.post('/:id/refund', {
    schema: {
      tags: ['admin-orders'],
      summary: 'Refund order (full or partial)',
      description: 'Process refund for an order (admin only)',
      security: [{ bearerAuth: [] }],
      ...adminOrderSchemas.refundOrder,
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const data = request.body as any;
      // Explicitly pick only allowed fields, ensuring amount is not passed even if present in raw body
      const refund = await AdminOrderService.refundOrder(id, {
        reason: data.reason,
        idempotencyKey: data.idempotencyKey
      });
      return sendSuccess(reply, refund);
    } catch (error: unknown) {
      const mapped = mapAdminOrderRouteError(error, {
        defaultStatus: 500,
        defaultCode: 'INTERNAL_SERVER_ERROR',
        defaultMessage: 'Failed to refund order',
      });
      return sendError(reply, mapped.status, mapped.code, mapped.message, mapped.details);
    }
  });

  // Cancel order
  fastify.post('/:id/cancel', {
    schema: {
      tags: ['admin-orders'],
      summary: 'Cancel order',
      description: 'Cancel an order with reason (admin only)',
      security: [{ bearerAuth: [] }],
      ...adminOrderSchemas.cancelOrder,
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const data = request.body as any;
      const order = await AdminOrderService.cancelOrder(id, data);
      return sendSuccess(reply, order);
    } catch (error: unknown) {
      const mapped = mapAdminOrderRouteError(error, {
        defaultStatus: 500,
        defaultCode: 'INTERNAL_SERVER_ERROR',
        defaultMessage: 'Failed to cancel order',
      });
      return sendError(reply, mapped.status, mapped.code, mapped.message, mapped.details);
    }
  });
}
