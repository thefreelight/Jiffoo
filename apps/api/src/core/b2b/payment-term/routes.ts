/**
 * Payment Term Routes (B2B)
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PaymentTermService } from './service';
import {
  CreatePaymentTermSchema,
  UpdatePaymentTermSchema,
  UpdatePaymentTermStatusSchema,
  CalculateDueDateSchema
} from './types';
import { authMiddleware } from '@/core/auth/middleware';

export async function paymentTermRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', authMiddleware);

  // Initialize default payment terms (admin only - run once during setup)
  fastify.post('/initialize', {
    handler: async (request, reply) => {
      try {
        const paymentTerms = await PaymentTermService.initializeDefaultPaymentTerms();
        return reply.code(201).send({
          message: 'Default payment terms initialized',
          paymentTerms
        });
      } catch (error: any) {
        return reply.code(500).send({ error: error.message });
      }
    },
  });

  // List all payment terms
  fastify.get('/', {
    handler: async (request, reply) => {
      try {
        const { page = 1, limit = 10, search } = request.query as any;
        const result = await PaymentTermService.getAllPaymentTerms(
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

  // Get payment term by ID
  fastify.get('/:id', {
    handler: async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const paymentTerm = await PaymentTermService.getPaymentTermById(id);

        if (!paymentTerm) {
          return reply.code(404).send({ error: 'Payment term not found' });
        }

        return reply.code(200).send(paymentTerm);
      } catch (error: any) {
        return reply.code(500).send({ error: error.message });
      }
    },
  });

  // Create payment term
  fastify.post('/', {
    handler: async (request, reply) => {
      try {
        const data = CreatePaymentTermSchema.parse(request.body);
        const paymentTerm = await PaymentTermService.createPaymentTerm(data);
        return reply.code(201).send(paymentTerm);
      } catch (error: any) {
        if (error.name === 'ZodError') {
          return reply.code(400).send({ error: 'Validation failed', details: error.errors });
        }
        return reply.code(500).send({ error: error.message });
      }
    },
  });

  // Update payment term
  fastify.put('/:id', {
    handler: async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const data = UpdatePaymentTermSchema.parse(request.body);
        const paymentTerm = await PaymentTermService.updatePaymentTerm(id, data);
        return reply.code(200).send(paymentTerm);
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

  // Update payment term status (admin only)
  fastify.put('/:id/status', {
    handler: async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const data = UpdatePaymentTermStatusSchema.parse(request.body);
        const paymentTerm = await PaymentTermService.updatePaymentTermStatus(id, { isActive: data.isActive });
        return reply.code(200).send(paymentTerm);
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

  // Delete payment term
  fastify.delete('/:id', {
    handler: async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        await PaymentTermService.deletePaymentTerm(id);
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

  // Calculate due date (utility endpoint)
  fastify.post('/calculate-due-date', {
    handler: async (request, reply) => {
      try {
        const data = CalculateDueDateSchema.parse(request.body);
        const result = await PaymentTermService.calculateDueDate({
          paymentTermId: data.paymentTermId,
          startDate: data.startDate ? new Date(data.startDate) : new Date()
        });
        return reply.code(200).send(result);
      } catch (error: any) {
        if (error.name === 'ZodError') {
          return reply.code(400).send({ error: 'Validation failed', details: error.errors });
        }
        return reply.code(500).send({ error: error.message });
      }
    },
  });
}
