/**
 * Customer Group Routes (B2B)
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { CustomerGroupService } from './service';
import {
  CreateCustomerGroupSchema,
  UpdateCustomerGroupSchema,
  UpdateCustomerGroupStatusSchema
} from './types';
import { authMiddleware } from '@/core/auth/middleware';

export async function customerGroupRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', authMiddleware);

  // List all customer groups
  fastify.get('/', {
    handler: async (request, reply) => {
      try {
        const { page = 1, limit = 10, search } = request.query as any;
        const result = await CustomerGroupService.getAllCustomerGroups(
          Number(page),
          Number(limit),
          search
        );
        return reply.code(200).send(result);
      } catch (error: any) {
        return reply.code(500).send({ error: error.message });
      }
    },
  });

  // Get customer group by ID
  fastify.get('/:id', {
    handler: async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const customerGroup = await CustomerGroupService.getCustomerGroupById(id);

        if (!customerGroup) {
          return reply.code(404).send({ error: 'Customer group not found' });
        }

        return reply.code(200).send(customerGroup);
      } catch (error: any) {
        return reply.code(500).send({ error: error.message });
      }
    },
  });

  // Create customer group
  fastify.post('/', {
    handler: async (request, reply) => {
      try {
        const data = CreateCustomerGroupSchema.parse(request.body);
        const customerGroup = await CustomerGroupService.createCustomerGroup(data);
        return reply.code(201).send(customerGroup);
      } catch (error: any) {
        if (error.name === 'ZodError') {
          return reply.code(400).send({ error: 'Validation failed', details: error.errors });
        }
        return reply.code(500).send({ error: error.message });
      }
    },
  });

  // Update customer group
  fastify.put('/:id', {
    handler: async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const data = UpdateCustomerGroupSchema.parse(request.body);
        const customerGroup = await CustomerGroupService.updateCustomerGroup(id, data);
        return reply.code(200).send(customerGroup);
      } catch (error: any) {
        if (error.name === 'ZodError') {
          return reply.code(400).send({ error: 'Validation failed', details: error.errors });
        }
        if (error.message.includes('not found')) {
          return reply.code(404).send({ error: error.message });
        }
        return reply.code(500).send({ error: error.message });
      }
    },
  });

  // Update customer group status (admin only)
  fastify.put('/:id/status', {
    handler: async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const data = UpdateCustomerGroupStatusSchema.parse(request.body);
        const customerGroup = await CustomerGroupService.updateCustomerGroupStatus(id, { isActive: data.isActive });
        return reply.code(200).send(customerGroup);
      } catch (error: any) {
        if (error.name === 'ZodError') {
          return reply.code(400).send({ error: 'Validation failed', details: error.errors });
        }
        if (error.message.includes('not found')) {
          return reply.code(404).send({ error: error.message });
        }
        return reply.code(500).send({ error: error.message });
      }
    },
  });

  // Delete customer group
  fastify.delete('/:id', {
    handler: async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        await CustomerGroupService.deleteCustomerGroup(id);
        return reply.code(204).send();
      } catch (error: any) {
        if (error.message.includes('not found')) {
          return reply.code(404).send({ error: error.message });
        }
        if (error.message.includes('cannot be deleted')) {
          return reply.code(400).send({ error: error.message });
        }
        return reply.code(500).send({ error: error.message });
      }
    },
  });
}
