/**
 * License Routes - Open Source Stub Version
 * 
 * This is a stub implementation for the open source version.
 * Commercial licensing features are available in the commercial version.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export async function licenseRoutes(fastify: FastifyInstance) {
  // Health check endpoint
  fastify.get('/health', async (request, reply) => {
    return {
      status: 'ok',
      service: 'license-routes',
      version: 'opensource-stub',
      timestamp: new Date().toISOString()
    };
  });

  // Stub endpoints that return appropriate messages for open source users
  fastify.post('/generate', async (request, reply) => {
    return reply.status(501).send({
      success: false,
      error: 'License generation is available in the commercial version',
      message: 'This feature requires Jiffoo Mall Commercial License',
      upgrade: {
        url: 'https://jiffoo.com/pricing',
        features: [
          'Advanced license management',
          'Plugin licensing system',
          'Usage tracking and analytics',
          'Multi-tenant support'
        ]
      }
    });
  });

  fastify.get('/validate', async (request, reply) => {
    return reply.status(501).send({
      success: false,
      error: 'License validation is available in the commercial version',
      message: 'This feature requires Jiffoo Mall Commercial License',
      upgrade: {
        url: 'https://jiffoo.com/pricing',
        features: [
          'Plugin license validation',
          'Feature access control',
          'Usage limit enforcement',
          'Expiration management'
        ]
      }
    });
  });

  fastify.get('/usage/:pluginName', async (request, reply) => {
    return reply.status(501).send({
      success: false,
      error: 'Usage tracking is available in the commercial version',
      message: 'This feature requires Jiffoo Mall Commercial License'
    });
  });

  fastify.post('/usage/:pluginName', async (request, reply) => {
    return reply.status(501).send({
      success: false,
      error: 'Usage tracking is available in the commercial version',
      message: 'This feature requires Jiffoo Mall Commercial License'
    });
  });

  fastify.get('/user-licenses', async (request, reply) => {
    return reply.status(501).send({
      success: false,
      error: 'License management is available in the commercial version',
      message: 'This feature requires Jiffoo Mall Commercial License'
    });
  });

  // Info endpoint for open source users
  fastify.get('/info', async (request, reply) => {
    return {
      success: true,
      version: 'opensource',
      message: 'You are using the open source version of Jiffoo Mall',
      features: {
        available: [
          'Basic plugin system',
          'Core e-commerce features',
          'Open source plugins',
          'Community support'
        ],
        commercial: [
          'Advanced license management',
          'Commercial plugin access',
          'Priority support',
          'Advanced analytics',
          'Multi-tenant architecture'
        ]
      },
      upgrade: {
        url: 'https://jiffoo.com/pricing',
        contact: 'sales@jiffoo.com'
      }
    };
  });

  console.log('✅ License routes (open source stub) registered');
}

// Export for compatibility
export { licenseRoutes as default };
