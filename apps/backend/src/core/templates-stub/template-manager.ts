/**
 * Template Manager - Open Source Stub Version
 */

import { FastifyInstance } from 'fastify';

export async function templateRoutes(fastify: FastifyInstance) {
  // Get templates
  fastify.get('/', async (request, reply) => {
    return reply.status(501).send({
      success: false,
      error: 'Template marketplace is available in the commercial version',
      message: 'Upgrade to Jiffoo Mall Commercial for template marketplace access',
      upgrade: {
        url: 'https://jiffoo.com/pricing',
        features: [
          'Professional templates',
          'Custom theme builder',
          'Template marketplace',
          'White-label themes'
        ]
      }
    });
  });

  // Install template
  fastify.post('/install', async (request, reply) => {
    return reply.status(501).send({
      success: false,
      error: 'Template installation is available in the commercial version',
      message: 'Upgrade to Jiffoo Mall Commercial for template marketplace'
    });
  });

  console.log('✅ Template routes (open source stub) registered');
}
