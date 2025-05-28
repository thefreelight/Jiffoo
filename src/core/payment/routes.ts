import { FastifyInstance } from 'fastify';
import { PaymentService } from './service';
import { ProcessPaymentSchema } from './types';
import { authMiddleware } from '@/core/auth/middleware';

export async function paymentRoutes(fastify: FastifyInstance) {
  // Process payment
  fastify.post('/process', {
    preHandler: [authMiddleware]
  }, async (request, reply) => {
    try {
      const result = await PaymentService.processPayment(request.user!.userId, request.body as any);

      if (result.status === 'COMPLETED') {
        return reply.send({
          success: true,
          payment: result,
          message: 'Payment processed successfully'
        });
      } else {
        return reply.status(400).send({
          success: false,
          payment: result,
          message: 'Payment processing failed'
        });
      }
    } catch (error) {
      return reply.status(400).send({
        error: 'Payment processing failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get payment status
  fastify.get('/status/:orderId', {
    preHandler: [authMiddleware]
  }, async (request, reply) => {
    try {
      const { orderId } = request.params as { orderId: string };
      const status = await PaymentService.getPaymentStatus(orderId, request.user!.userId);
      return reply.send(status);
    } catch (error) {
      return reply.status(404).send({
        error: 'Payment status not found',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
