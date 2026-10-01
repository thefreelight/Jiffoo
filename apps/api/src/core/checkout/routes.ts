import { FastifyInstance } from 'fastify';
import { dualAuthMiddleware } from '@/core/auth/middleware';
import { CheckoutService } from './service';
import { sendError, sendSuccess } from '@/utils/response';
import { checkoutSchemas } from './schemas';

export async function checkoutRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', dualAuthMiddleware('checkout:create'));
  fastify.post('/quote', { schema: checkoutSchemas.quote }, async (request, reply) => {
    try {
      const body = request.body as { shippingAddress: { country: string; state?: string; city?: string; postalCode?: string; addressLine1?: string; addressLine2?: string }; shippingOptionId?: string };
      return sendSuccess(reply, await CheckoutService.quote(request.user!.id, body));
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'PLUGIN_PACKAGE_UNAVAILABLE')
        return sendError(reply, 503, 'PLUGIN_PACKAGE_UNAVAILABLE', 'Checkout plugin package is unavailable');
      if (error && typeof error === 'object' && 'code' in error && error.code === 'PLUGIN_PACKAGE_MATERIALIZATION_TIMEOUT')
        return sendError(reply, 503, 'PLUGIN_PACKAGE_MATERIALIZATION_TIMEOUT', 'Checkout plugin package materialization timed out');
      if (error && typeof error === 'object' && 'code' in error && error.code === 'PLUGIN_PACKAGE_CORRUPT')
        return sendError(reply, 500, 'PLUGIN_PACKAGE_CORRUPT', 'Checkout plugin package is corrupt');
      if (error && typeof error === 'object' && 'code' in error && (error.code === 'CONTRACT_RESPONSE_INVALID' || error.code === 'CONTRACT_CALL_FAILED')) {
        return sendError(reply, 502, 'CONTRACT_CALL_FAILED', 'Checkout provider is temporarily unavailable');
      }
      const message = error instanceof Error ? error.message : String(error);
      if (message === 'Cart is empty') return sendError(reply, 400, 'BAD_REQUEST', message);
      return sendError(reply, message === 'SHIPPING_OPTION_UNAVAILABLE' ? 409 : 500, message === 'SHIPPING_OPTION_UNAVAILABLE' ? message : 'INTERNAL_SERVER_ERROR', message);
    }
  });
}
