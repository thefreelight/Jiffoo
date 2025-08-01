/**
 * License Routes - Open Source Stub Version (Routes Directory)
 */

import { FastifyInstance } from 'fastify';

export async function licenseRoutes(fastify: FastifyInstance) {
  // License validation endpoint
  fastify.post('/license/validate', async (request, reply) => {
    return reply.status(501).send({
      success: false,
      error: 'License validation is available in the commercial version',
      message: 'Upgrade to Jiffoo Mall Commercial for license management',
      upgrade: {
        url: 'https://jiffoo.com/pricing',
        features: [
          'Plugin license validation',
          'Usage tracking',
          'Subscription management',
          'Multi-tenant licensing'
        ]
      }
    });
  });

  // License usage tracking
  fastify.post('/license/usage', async (request, reply) => {
    return reply.status(501).send({
      success: false,
      error: 'Usage tracking is available in the commercial version',
      message: 'Upgrade to Jiffoo Mall Commercial for usage analytics'
    });
  });

  // Get license info
  fastify.get('/license/info', async (request, reply) => {
    return reply.status(501).send({
      success: false,
      error: 'License information is available in the commercial version',
      message: 'Upgrade to Jiffoo Mall Commercial for license management'
    });
  });

  console.log('✅ License routes (routes directory stub) registered');
}
