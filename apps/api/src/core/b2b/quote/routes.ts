/**
 * Quote Routes
 */

import { FastifyInstance } from 'fastify';
import { QuoteService } from './service';
import { authMiddleware } from '@/core/auth/middleware';
import { sendSuccess, sendError } from '@/utils/response';
import {
  CreateQuoteSchema,
  UpdateQuoteSchema,
  ApproveQuoteSchema,
  RejectQuoteSchema
} from './types';
// B2B Phase 2: import { OrderService } from '@/core/order/service';

export async function quoteRoutes(fastify: FastifyInstance) {
  // Apply auth middleware to all quote routes (before schema validation)
  fastify.addHook('onRequest', authMiddleware);

  // Create quote
  fastify.post('/', {
    schema: {
      tags: ['quotes'],
      summary: 'Create quote',
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const data = CreateQuoteSchema.parse(request.body);
      const quote = await QuoteService.createQuote(
        data as any,
        request.user!.id
      );
      return sendSuccess(reply, quote, undefined, 201);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return sendError(reply, 400, 'VALIDATION_ERROR', error.message);
      }
      return sendError(reply, 400, 'BAD_REQUEST', error.message);
    }
  });

  // Get user quotes
  fastify.get('/', {
    schema: {
      tags: ['quotes'],
      summary: 'Get user quotes',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 10 },
          status: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { page, limit, status } = request.query as any;
      const result = await QuoteService.getUserQuotes(
        request.user!.id,
        page,
        limit,
        status
      );
      return sendSuccess(reply, result);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Get quote by ID
  fastify.get('/:id', {
    schema: {
      tags: ['quotes'],
      summary: 'Get quote by ID',
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const quote = await QuoteService.getQuoteById(id);
      if (!quote) {
        return sendError(reply, 404, 'NOT_FOUND', 'Quote not found');
      }
      return sendSuccess(reply, quote);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Update quote
  fastify.put('/:id', {
    schema: {
      tags: ['quotes'],
      summary: 'Update quote',
      security: [{ bearerAuth: [] }],
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const data = UpdateQuoteSchema.parse(request.body);
      const quote = await QuoteService.updateQuote(id, data as any);
      return sendSuccess(reply, quote);
    } catch (error: any) {
      return sendError(reply, 400, 'BAD_REQUEST', error.message);
    }
  });

  // Submit quote for approval
  fastify.post('/:id/submit', {
    schema: {
      tags: ['quotes'],
      summary: 'Submit quote for approval',
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const quote = await QuoteService.submitQuote(id);
      return sendSuccess(reply, quote);
    } catch (error: any) {
      return sendError(reply, 400, 'BAD_REQUEST', error.message);
    }
  });

  // Approve quote (admin)
  fastify.post('/:id/approve', {
    schema: {
      tags: ['quotes'],
      summary: 'Approve quote',
      security: [{ bearerAuth: [] }],
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const data = ApproveQuoteSchema.parse(request.body);
      const quote = await QuoteService.approveQuote(id, data as any);
      return sendSuccess(reply, quote);
    } catch (error: any) {
      return sendError(reply, 400, 'BAD_REQUEST', error.message);
    }
  });

  // Reject quote (admin)
  fastify.post('/:id/reject', {
    schema: {
      tags: ['quotes'],
      summary: 'Reject quote',
      security: [{ bearerAuth: [] }],
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const data = RejectQuoteSchema.parse(request.body);
      const quote = await QuoteService.rejectQuote(id, data as any);
      return sendSuccess(reply, quote);
    } catch (error: any) {
      return sendError(reply, 400, 'BAD_REQUEST', error.message);
    }
  });

  // Convert quote to order
  fastify.post('/:id/convert', {
    schema: {
      tags: ['quotes'],
      summary: 'Convert quote to order',
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const { id: _id } = request.params as any;
      // B2B Phase 2: Quote-to-order conversion
      return sendError(reply, 501, 'NOT_IMPLEMENTED', 'Quote to order conversion is planned for B2B Phase 2');
    } catch (error: any) {
      return sendError(reply, 400, 'BAD_REQUEST', error.message);
    }
  });

  // Delete quote
  fastify.delete('/:id', {
    schema: {
      tags: ['quotes'],
      summary: 'Delete quote',
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      await QuoteService.deleteQuote(id);
      return sendSuccess(reply, { message: 'Quote deleted successfully' });
    } catch (error: any) {
      return sendError(reply, 400, 'BAD_REQUEST', error.message);
    }
  });
}
