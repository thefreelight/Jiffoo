/**
 * Sales Routes - Open Source Stub Version
 */

import { FastifyInstance } from 'fastify';

export async function salesRoutes(fastify: FastifyInstance) {
  // Get sales analytics
  fastify.get('/analytics', async (request, reply) => {
    return reply.status(501).send({
      success: false,
      error: 'Advanced sales analytics are available in the commercial version',
      message: 'Upgrade to Jiffoo Mall Commercial for advanced analytics',
      upgrade: {
        url: 'https://jiffoo.com/pricing',
        features: [
          'Advanced sales analytics',
          'Revenue forecasting',
          'Customer insights',
          'Performance dashboards'
        ]
      }
    });
  });

  // Get sales reports
  fastify.get('/reports', async (request, reply) => {
    return reply.status(501).send({
      success: false,
      error: 'Sales reporting is available in the commercial version',
      message: 'Upgrade to Jiffoo Mall Commercial for sales reporting'
    });
  });

  console.log('✅ Sales routes (open source stub) registered');
}
