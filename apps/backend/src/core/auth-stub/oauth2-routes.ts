/**
 * OAuth2 Routes - Open Source Stub Version
 */

import { FastifyInstance } from 'fastify';

export async function oauth2Routes(fastify: FastifyInstance) {
  // OAuth2 authorization endpoint
  fastify.get('/oauth/authorize', async (request, reply) => {
    return reply.status(501).send({
      success: false,
      error: 'OAuth2 integration is available in the commercial version',
      message: 'Upgrade to Jiffoo Mall Commercial for OAuth2 features',
      upgrade: {
        url: 'https://jiffoo.com/pricing',
        features: [
          'OAuth2 provider integration',
          'Third-party app authentication',
          'API access tokens',
          'Secure authorization flows'
        ]
      }
    });
  });

  // OAuth2 token endpoint
  fastify.post('/oauth/token', async (request, reply) => {
    return reply.status(501).send({
      success: false,
      error: 'OAuth2 token generation is available in the commercial version',
      message: 'Upgrade to Jiffoo Mall Commercial for OAuth2 support'
    });
  });

  console.log('✅ OAuth2 routes (open source stub) registered');
}
