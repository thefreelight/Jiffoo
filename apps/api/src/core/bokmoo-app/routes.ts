import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { authMiddleware } from '@/core/auth/middleware';
import { handlePluginGateway, PluginGatewayError } from '@/core/admin/extension-installer/plugin-runtime';
import {
  NativePaymentConfirmationError,
  NativePaymentConfirmationService,
  type NativePayProvider,
} from '@/core/payment/native-confirmation';

const BOKMOO_PLUGIN_SLUG = 'bokmoo-connect';

async function forwardToBokmooPlugin(
  fastify: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
  forwardPath: string,
) {
  const mutableRequest = request as any;
  const previousParams = mutableRequest.params;
  mutableRequest.params = { slug: BOKMOO_PLUGIN_SLUG };

  try {
    return await handlePluginGateway(mutableRequest, reply, forwardPath, fastify);
  } catch (error: any) {
    if (error instanceof PluginGatewayError) {
      return reply.code(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }
    return reply.code(500).send({
      error: {
        code: 'BOKMOO_PLUGIN_GATEWAY_FAILED',
        message: error?.message || 'BOKMOO plugin gateway failed',
      },
    });
  } finally {
    mutableRequest.params = previousParams;
  }
}

async function confirmNativePayment(
  provider: NativePayProvider,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const result = await NativePaymentConfirmationService.confirm(
      provider,
      (request as any).user.id,
      (request.body || {}) as Record<string, unknown>,
    );
    return reply.send({ data: result });
  } catch (error: any) {
    if (error instanceof NativePaymentConfirmationError) {
      return reply.code(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      });
    }
    return reply.code(500).send({
      error: {
        code: 'NATIVE_PAYMENT_CONFIRM_FAILED',
        message: error?.message || 'Native payment confirmation failed',
      },
    });
  }
}

export async function bokmooAppRoutes(fastify: FastifyInstance) {
  fastify.get('/cards', { onRequest: [authMiddleware] }, (request, reply) =>
    forwardToBokmooPlugin(fastify, request, reply, '/api/cards'));
  fastify.get('/cards/:cardId', { onRequest: [authMiddleware] }, (request, reply) =>
    forwardToBokmooPlugin(fastify, request, reply, `/api/cards/${(request.params as any).cardId}`));
  fastify.post('/cards/claim', { onRequest: [authMiddleware] }, (request, reply) =>
    forwardToBokmooPlugin(fastify, request, reply, '/api/cards/claim'));
  fastify.post('/cards/:cardId/verify', { onRequest: [authMiddleware] }, (request, reply) =>
    forwardToBokmooPlugin(fastify, request, reply, `/api/cards/${(request.params as any).cardId}/verify`));
  fastify.post('/cards/:cardId/unbind', { onRequest: [authMiddleware] }, (request, reply) =>
    forwardToBokmooPlugin(fastify, request, reply, `/api/cards/${(request.params as any).cardId}/unbind`));

  fastify.get('/orders/:orderId/install-session', { onRequest: [authMiddleware] }, (request, reply) =>
    forwardToBokmooPlugin(fastify, request, reply, `/api/orders/${(request.params as any).orderId}/install-session`));
  fastify.post('/orders/:orderId/install-complete', { onRequest: [authMiddleware] }, (request, reply) =>
    forwardToBokmooPlugin(fastify, request, reply, `/api/orders/${(request.params as any).orderId}/install-complete`));

  fastify.get('/profiles', { onRequest: [authMiddleware] }, (request, reply) =>
    forwardToBokmooPlugin(fastify, request, reply, '/api/profiles'));
  fastify.post('/profiles/:profileId/switch', { onRequest: [authMiddleware] }, (request, reply) =>
    forwardToBokmooPlugin(fastify, request, reply, `/api/profiles/${(request.params as any).profileId}/switch`));
  fastify.delete('/profiles/:profileId', { onRequest: [authMiddleware] }, (request, reply) =>
    forwardToBokmooPlugin(fastify, request, reply, `/api/profiles/${(request.params as any).profileId}`));

  fastify.get('/payment-methods', { onRequest: [authMiddleware] }, (request, reply) =>
    forwardToBokmooPlugin(fastify, request, reply, '/api/payment-methods'));
  fastify.post('/payment-methods', { onRequest: [authMiddleware] }, (request, reply) =>
    forwardToBokmooPlugin(fastify, request, reply, '/api/payment-methods'));
  fastify.post('/payment-methods/:paymentMethodId/default', { onRequest: [authMiddleware] }, (request, reply) =>
    forwardToBokmooPlugin(fastify, request, reply, `/api/payment-methods/${(request.params as any).paymentMethodId}/default`));
  fastify.delete('/payment-methods/:paymentMethodId', { onRequest: [authMiddleware] }, (request, reply) =>
    forwardToBokmooPlugin(fastify, request, reply, `/api/payment-methods/${(request.params as any).paymentMethodId}`));

  fastify.post('/payments/apple-pay/confirm', { onRequest: [authMiddleware] }, (request, reply) =>
    confirmNativePayment('apple-pay', request, reply));
  fastify.post('/payments/google-pay/confirm', { onRequest: [authMiddleware] }, (request, reply) =>
    confirmNativePayment('google-pay', request, reply));

  fastify.get('/notifications', { onRequest: [authMiddleware] }, (request, reply) =>
    forwardToBokmooPlugin(fastify, request, reply, '/api/notifications'));
  fastify.post('/notifications/:notificationId/read', { onRequest: [authMiddleware] }, (request, reply) =>
    forwardToBokmooPlugin(fastify, request, reply, `/api/notifications/${(request.params as any).notificationId}/read`));

  fastify.post('/support/tickets', { onRequest: [authMiddleware] }, (request, reply) =>
    forwardToBokmooPlugin(fastify, request, reply, '/api/support/tickets'));
  fastify.get('/support/tickets', { onRequest: [authMiddleware] }, (request, reply) =>
    forwardToBokmooPlugin(fastify, request, reply, '/admin/api/support/tickets'));
  fastify.post('/support/tickets/:ticketId/status', { onRequest: [authMiddleware] }, (request, reply) =>
    forwardToBokmooPlugin(fastify, request, reply, `/admin/api/support/tickets/${(request.params as any).ticketId}/status`));
  fastify.get('/support/cards/search', { onRequest: [authMiddleware] }, (request, reply) =>
    forwardToBokmooPlugin(fastify, request, reply, '/admin/api/support/cards/search'));
  fastify.post('/support/cards/:cardId/actions', { onRequest: [authMiddleware] }, (request, reply) =>
    forwardToBokmooPlugin(fastify, request, reply, `/admin/api/support/cards/${(request.params as any).cardId}/actions`));

  fastify.post('/webhooks/jiffoo/order-paid', (request, reply) =>
    forwardToBokmooPlugin(fastify, request, reply, '/webhooks/jiffoo/order-paid'));
}
