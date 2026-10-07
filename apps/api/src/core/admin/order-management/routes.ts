import { sendMappedError } from '@/utils/api-errors';
/**
 * Admin Order Routes
 */

import { FastifyInstance } from 'fastify';
import { AdminOrderService } from './service';
import { sendSuccess, sendError } from '@/utils/response';
import { adminOrderSchemas } from './schemas';

export async function adminOrderRoutes(fastify: FastifyInstance) {
  // Apply auth middleware to all admin order routes (before schema validation)

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
      const result = await AdminOrderService.getOrders(page, limit, status, search);
      return sendSuccess(reply, result);
    } catch (error) { return sendMappedError(reply, error); }
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
    } catch (error) { return sendMappedError(reply, error); }
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
    } catch (error) { return sendMappedError(reply, error); }
  });

  fastify.post('/:id/record-manual-payment', {
    schema: {
      tags: ['admin-orders'],
      summary: 'Record a manual payment',
      description: 'Mark a pending manual payment as paid (admin only)',
      security: [{ bearerAuth: [] }],
      ...adminOrderSchemas.recordManualPayment,
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { reference } = (request.body || {}) as { reference?: string };
      const order = await AdminOrderService.recordManualPayment(id, request.user!.id, reference);
      return sendSuccess(reply, order);
    } catch (error) { return sendMappedError(reply, error); }
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
    } catch (error) { return sendMappedError(reply, error); }
  });

  fastify.post('/:id/deliver', {
    schema: {
      tags: ['admin-orders'],
      summary: 'Mark order delivered',
      security: [{ bearerAuth: [] }],
      ...adminOrderSchemas.deliverOrder,
    },
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      return sendSuccess(reply, await AdminOrderService.deliverOrder(id));
    } catch (error) { return sendMappedError(reply, error); }
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
    } catch (error) { return sendMappedError(reply, error); }
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
    } catch (error) { return sendMappedError(reply, error); }
  });
}
