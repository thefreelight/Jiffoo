/**
 * Order Routes (Single Merchant Version)
 */

import { FastifyInstance } from 'fastify';
import { OrderService } from './service';
import { authMiddleware } from '@/core/auth/middleware';

export async function orderRoutes(fastify: FastifyInstance) {
  // Apply auth middleware to all order routes (before schema validation)
  fastify.addHook('onRequest', authMiddleware);

  // Create order
  fastify.post('/', {
    schema: {
      tags: ['orders'],
      summary: 'Create order',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['items'],
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              required: ['productId', 'quantity'],
              properties: {
                productId: { type: 'string' },
                variantId: { type: 'string' },
                quantity: { type: 'integer' }
              }
            }
          },
          shippingAddress: { type: 'object' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const order = await OrderService.createOrder(
        request.user!.id,
        request.body as any
      );
      return reply.code(201).send({ success: true, data: order });
    } catch (error: any) {
      return reply.code(400).send({ success: false, error: error.message });
    }
  });

  // Get user orders
  fastify.get('/', {
    schema: {
      tags: ['orders'],
      summary: 'Get user orders',
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
      const result = await OrderService.getUserOrders(
        request.user!.id,
        page,
        limit,
        status
      );
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // Get order by ID
  fastify.get('/:id', {
    schema: {
      tags: ['orders'],
      summary: 'Get order by ID',
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const order = await OrderService.getOrderById(id, request.user!.id);
      if (!order) {
        return reply.code(404).send({ success: false, error: 'Order not found' });
      }
      return reply.send({ success: true, data: order });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // Cancel order
  fastify.post('/:id/cancel', {
    schema: {
      tags: ['orders'],
      summary: 'Cancel order',
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const order = await OrderService.cancelOrder(id, request.user!.id);
      return reply.send({ success: true, data: order });
    } catch (error: any) {
      return reply.code(400).send({ success: false, error: error.message });
    }
  });
}
