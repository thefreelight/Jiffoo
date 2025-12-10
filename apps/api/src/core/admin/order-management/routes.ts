/**
 * Admin Order Routes (单商户版本)
 */

import { FastifyInstance } from 'fastify';
import { AdminOrderService } from './service';
import { authMiddleware, requireAdmin } from '@/core/auth/middleware';

export async function adminOrderRoutes(fastify: FastifyInstance) {
  // Get orders list
  fastify.get('/', {
    preHandler: [authMiddleware, requireAdmin],
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
    preHandler: [authMiddleware, requireAdmin],
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
    preHandler: [authMiddleware, requireAdmin],
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
    preHandler: [authMiddleware, requireAdmin],
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
}
