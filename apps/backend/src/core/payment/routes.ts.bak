import { FastifyInstance } from 'fastify';
import { PaymentService } from './service';
import { ProcessPaymentSchema, PaymentMethod } from './types';
import { authMiddleware } from '@/core/auth/middleware';
import { paymentPluginRoutes } from './plugin-routes';

export async function paymentRoutes(fastify: FastifyInstance) {
  // Initialize payment service
  await PaymentService.initialize();
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

  // === NEW PAYMENT ARCHITECTURE ROUTES ===

  // Process payment for an order (new architecture)
  fastify.post('/orders/:orderId/payment', {
    preHandler: [authMiddleware],
    schema: {
      summary: 'Process payment for an order',
      description: 'Process payment for a specific order using the new payment architecture',
      params: {
        type: 'object',
        required: ['orderId'],
        properties: {
          orderId: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        properties: {
          paymentMethod: {
            type: 'string',
            enum: Object.values(PaymentMethod),
            default: PaymentMethod.MOCK
          },
          providerName: { type: 'string' },
          returnUrl: { type: 'string' },
          cancelUrl: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { orderId } = request.params as { orderId: string };
      const { paymentMethod = PaymentMethod.MOCK, providerName } = request.body as any;

      const result = await PaymentService.processOrderPayment(
        orderId,
        paymentMethod,
        providerName
      );

      return reply.send({
        success: true,
        data: {
          paymentId: result.paymentId,
          status: result.status,
          amount: result.amount,
          redirectUrl: result.redirectUrl,
          clientSecret: result.clientSecret,
          transactionId: result.transactionId,
        }
      });
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: 'Payment processing failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Verify payment
  fastify.get('/payments/:paymentId/verify', {
    preHandler: [authMiddleware],
    schema: {
      summary: 'Verify payment status',
      description: 'Verify the current status of a payment',
      params: {
        type: 'object',
        required: ['paymentId'],
        properties: {
          paymentId: { type: 'string' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          providerName: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { paymentId } = request.params as { paymentId: string };
      const { providerName } = request.query as any;

      const verification = await PaymentService.verifyPayment(paymentId, providerName);

      return reply.send({
        success: true,
        data: verification
      });
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: 'Payment verification failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Process refund
  fastify.post('/payments/:paymentId/refund', {
    preHandler: [authMiddleware],
    schema: {
      tags: ['payments'],
      summary: 'Process payment refund',
      description: 'Process a full or partial refund for a payment',
      params: {
        type: 'object',
        required: ['paymentId'],
        properties: {
          paymentId: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        properties: {
          amount: { type: 'number', minimum: 0 },
          reason: { type: 'string' },
          providerName: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { paymentId } = request.params as { paymentId: string };
      const { amount, reason, providerName } = request.body as any;

      const result = await PaymentService.processRefund(
        paymentId,
        amount,
        reason,
        providerName
      );

      return reply.send({
        success: true,
        data: result
      });
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: 'Refund processing failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get available payment providers
  fastify.get('/providers', {
    schema: {
      tags: ['payments'],
      summary: 'Get available payment providers',
      description: 'Get list of available payment providers and their capabilities'
    }
  }, async (request, reply) => {
    try {
      const providers = PaymentService.getAvailableProviders();
      const providersWithCapabilities = providers.map(providerName => {
        const capabilities = PaymentService.getProviderCapabilities(providerName);
        return {
          name: providerName,
          capabilities
        };
      });

      return reply.send({
        success: true,
        data: {
          providers: providersWithCapabilities
        }
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to get payment providers',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get payment provider capabilities
  fastify.get('/providers/:providerName/capabilities', {
    schema: {
      summary: 'Get payment provider capabilities',
      description: 'Get detailed capabilities of a specific payment provider',
      params: {
        type: 'object',
        required: ['providerName'],
        properties: {
          providerName: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { providerName } = request.params as { providerName: string };
      const capabilities = PaymentService.getProviderCapabilities(providerName);

      return reply.send({
        success: true,
        data: {
          provider: providerName,
          capabilities
        }
      });
    } catch (error) {
      return reply.status(404).send({
        success: false,
        error: 'Payment provider not found',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Health check for payment providers
  fastify.get('/health', {
    schema: {
      summary: 'Payment system health check',
      description: 'Check the health status of all payment providers'
    }
  }, async (request, reply) => {
    try {
      const healthStatus = await PaymentService.healthCheck();

      const overallHealth = Object.values(healthStatus).every(status => status);

      return reply.send({
        success: true,
        data: {
          overall: overallHealth,
          providers: healthStatus
        }
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Health check failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Register plugin management routes
  await paymentPluginRoutes(fastify);
}
