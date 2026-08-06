import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireServiceAuthMiddleware } from '@/core/auth/service-auth';
import { sendError, sendSuccess } from '@/utils/response';
import { createPluginOrderCheckout, type PluginOrderCheckoutInput } from './plugin-orders';

const checkoutSchema = z.object({
  userId: z.string().min(1),
  sourcePlugin: z.string().regex(/^[a-z][a-z0-9-]{1,31}$/),
  entitlementType: z.string().min(1).max(64),
  externalReferenceId: z.string().min(1).max(160),
  name: z.string().min(1).max(200),
  amount: z.coerce.number().positive().finite(),
  currency: z.string().regex(/^[A-Za-z]{3}$/),
  paymentMethod: z.string().min(1).max(64),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  idempotencyKey: z.string().min(1).max(200).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function pluginOrderRoutes(fastify: FastifyInstance) {
  fastify.post('/checkout', { onRequest: [requireServiceAuthMiddleware] }, async (request, reply) => {
    try {
      const input = checkoutSchema.parse(request.body) as PluginOrderCheckoutInput;
      const subject = request.user?.id || '';
      if (subject !== `plugin:${input.sourcePlugin}`) {
        return sendError(reply, 403, 'PLUGIN_IDENTITY_MISMATCH', 'Service token does not match source plugin');
      }
      return sendSuccess(reply, await createPluginOrderCheckout(input));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return sendError(reply, 400, 'INVALID_PLUGIN_ORDER', error.issues[0]?.message || 'Invalid plugin order');
      }
      return sendError(reply, 400, 'PLUGIN_ORDER_CHECKOUT_FAILED', error instanceof Error ? error.message : 'Checkout failed');
    }
  });
}
