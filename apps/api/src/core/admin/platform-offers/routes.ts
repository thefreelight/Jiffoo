/**
 * Platform Offers Routes
 *
 * Public endpoint for retrieving platform-managed offer cards.
 * Used by the Admin dashboard to display optional commercial content.
 *
 * GET /api/v1/platform-offers — list active offers (empty when disabled)
 */

import { FastifyInstance } from 'fastify';
import { PlatformOffersService } from './service';
import { sendSuccess, sendError } from '@/utils/response';

export async function platformOffersRoutes(fastify: FastifyInstance) {
  fastify.get('/', {
    schema: {
      tags: ['platform-offers'],
      summary: 'Get platform offers',
      description:
        'Returns platform-managed offer cards for the Admin dashboard. ' +
        'Always returns an empty array when JIFFOO_DISABLE_PLATFORM_OFFERS=true.',
    },
  }, async (_request, reply) => {
    try {
      const payload = await PlatformOffersService.getOffers();
      return sendSuccess(reply, payload);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });
}
