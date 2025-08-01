/**
 * Tenant Routes - Open Source Stub Version
 */

import { FastifyInstance } from 'fastify';

export async function tenantRoutes(fastify: FastifyInstance) {
  // Get tenants
  fastify.get('/', async (request, reply) => {
    return reply.status(501).send({
      success: false,
      error: 'Multi-tenant management is available in the commercial version',
      message: 'Upgrade to Jiffoo Mall Commercial for multi-tenant features',
      upgrade: {
        url: 'https://jiffoo.com/pricing',
        features: [
          'Multi-tenant architecture',
          'Tenant isolation',
          'Custom domains per tenant',
          'Tenant-specific configurations'
        ]
      }
    });
  });

  // Create tenant
  fastify.post('/', async (request, reply) => {
    return reply.status(501).send({
      success: false,
      error: 'Tenant creation is available in the commercial version',
      message: 'Upgrade to Jiffoo Mall Commercial for multi-tenant support'
    });
  });

  console.log('✅ Tenant routes (open source stub) registered');
}
