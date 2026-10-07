import { sendMappedError } from '@/utils/api-errors';
import { FastifyInstance } from 'fastify';
import { dualAuthMiddleware } from '@/core/auth/middleware';
import { CheckoutService } from './service';
import { sendError, sendSuccess } from '@/utils/response';
import { checkoutSchemas } from './schemas';
import { SharedProtectionUnavailable, sendProtectionUnavailable } from '@/infra/shared-protection';
import { sendKnownError } from '@/utils/api-errors';

export async function checkoutRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', dualAuthMiddleware('checkout:create'));
  fastify.post('/quote', { schema: checkoutSchemas.quote }, async (request, reply) => {
    try {
      const body = request.body as { shippingAddress: { country: string; state?: string; city?: string; postalCode?: string; addressLine1?: string; addressLine2?: string }; shippingOptionId?: string };
      return sendSuccess(reply, await CheckoutService.quote(request.user!.id, body));
    } catch (error) { return sendMappedError(reply, error); }
  });
}
