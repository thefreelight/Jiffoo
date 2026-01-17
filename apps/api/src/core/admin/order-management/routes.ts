/**
 * Admin Order Routes
 */

import { FastifyInstance } from 'fastify';
import { AdminOrderService } from './service';
import { authMiddleware, requireAdmin } from '@/core/auth/middleware';

export async function adminOrderRoutes(fastify: FastifyInstance) {
  // Apply auth middleware to all admin order routes (before schema validation)
  fastify.addHook('onRequest', authMiddleware);
  fastify.addHook('onRequest', requireAdmin);

  // Get orders list
  fastify.get('/', {
    schema: {
      tags: ['admin-orders'],
      summary: 'Get orders list',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 10 },
          status: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { page, limit, status } = request.query as any;
      const result = await AdminOrderService.getOrders(page, limit, status);
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // Get order by ID
  fastify.get('/:id', {
    schema: {
      tags: ['admin-orders'],
      summary: 'Get order by ID',
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const order = await AdminOrderService.getOrderById(id);
      if (!order) {
        return reply.code(404).send({ success: false, error: 'Order not found' });
      }
      return reply.send({ success: true, data: order });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // Update order status
  fastify.put('/:id/status', {
    schema: {
      tags: ['admin-orders'],
      summary: 'Update order status',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const { status } = request.body as any;
      const order = await AdminOrderService.updateOrderStatus(id, status);
      return reply.send({ success: true, data: order });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // Get order stats
  fastify.get('/stats', {
    schema: {
      tags: ['admin-orders'],
      summary: 'Get order statistics',
      security: [{ bearerAuth: [] }]
    }
  }, async (_request, reply) => {
    try {
      const stats = await AdminOrderService.getOrderStats();
      return reply.send({ success: true, data: stats });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // Ship order
  fastify.post('/:id/ship', {
    schema: {
      tags: ['admin-orders'],
      summary: 'Ship order with tracking info',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['carrier', 'trackingNumber'],
        properties: {
          carrier: { type: 'string' },
          trackingNumber: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                orderItemId: { type: 'string' },
                quantity: { type: 'integer' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const data = request.body as any;
      const result = await AdminOrderService.shipOrder(id, data);
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      return reply.code(400).send({ success: false, error: error.message });
    }
  });

  // Refund order
  fastify.post('/:id/refund', {
    schema: {
      tags: ['admin-orders'],
      summary: 'Refund order (full or partial)',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['idempotencyKey'],
        properties: {
          // amount: { type: 'number' }, // Alpha: Full refund only
          reason: { type: 'string' },
          idempotencyKey: { type: 'string' }
        }
      }
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
      return reply.send({ success: true, data: refund });
    } catch (error: any) {
      return reply.code(400).send({ success: false, error: error.message });
    }
  });

  // Cancel order
  fastify.post('/:id/cancel', {
    schema: {
      tags: ['admin-orders'],
      summary: 'Cancel order',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['cancelReason'],
        properties: {
          cancelReason: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const data = request.body as any;
      const order = await AdminOrderService.cancelOrder(id, data);
      return reply.send({ success: true, data: order });
    } catch (error: any) {
      return reply.code(400).send({ success: false, error: error.message });
    }
  });
}
