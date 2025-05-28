import { FastifyInstance } from 'fastify';
import { OrderService } from './service';
import { CreateOrderSchema, UpdateOrderStatusSchema } from './types';
import { authMiddleware, adminMiddleware } from '@/core/auth/middleware';

export async function orderRoutes(fastify: FastifyInstance) {
  // Create order (authenticated users)
  fastify.post('/', {
    schema: {
      body: CreateOrderSchema
    },
    preHandler: [authMiddleware]
  }, async (request, reply) => {
    try {
      const order = await OrderService.createOrder(request.user!.userId, request.body as any);
      return reply.status(201).send({ order });
    } catch (error) {
      return reply.status(400).send({
        error: 'Order creation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get user's orders
  fastify.get('/my-orders', {
    preHandler: [authMiddleware]
  }, async (request, reply) => {
    try {
      const { page = 1, limit = 10 } = request.query as any;
      const result = await OrderService.getUserOrders(
        request.user!.userId,
        Number(page),
        Number(limit)
      );
      return reply.send(result);
    } catch (error) {
      return reply.status(500).send({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get all orders (admin only)
  fastify.get('/', {
    preHandler: [authMiddleware, adminMiddleware]
  }, async (request, reply) => {
    try {
      const { page = 1, limit = 10 } = request.query as any;
      const result = await OrderService.getAllOrders(Number(page), Number(limit));
      return reply.send(result);
    } catch (error) {
      return reply.status(500).send({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get order by ID
  fastify.get('/:id', {
    preHandler: [authMiddleware]
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      // Regular users can only view their own orders, admins can view any order
      const userId = request.user!.role === 'ADMIN' ? undefined : request.user!.userId;
      const order = await OrderService.getOrderById(id, userId);

      if (!order) {
        return reply.status(404).send({
          error: 'Order not found'
        });
      }

      return reply.send({ order });
    } catch (error) {
      return reply.status(500).send({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Update order status (admin only)
  fastify.patch('/:id/status', {
    schema: {
      body: UpdateOrderStatusSchema
    },
    preHandler: [authMiddleware, adminMiddleware]
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const order = await OrderService.updateOrderStatus(id, request.body as any);
      return reply.send({ order });
    } catch (error) {
      return reply.status(400).send({
        error: 'Status update failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Cancel order
  fastify.post('/:id/cancel', {
    preHandler: [authMiddleware]
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      // Regular users can only cancel their own orders, admins can cancel any order
      const userId = request.user!.role === 'ADMIN' ? undefined : request.user!.userId;
      const order = await OrderService.cancelOrder(id, userId);

      return reply.send({ order });
    } catch (error) {
      return reply.status(400).send({
        error: 'Order cancellation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
