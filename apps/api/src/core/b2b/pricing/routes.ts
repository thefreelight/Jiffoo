/**
 * Pricing Routes (B2B)
 */

import { FastifyInstance } from 'fastify';
import { PricingService } from './service';
import { authMiddleware } from '@/core/auth/middleware';
import { sendSuccess, sendError } from '@/utils/response';

export async function pricingRoutes(fastify: FastifyInstance) {
  // Apply auth middleware to all pricing routes (before schema validation)
  fastify.addHook('onRequest', authMiddleware);

  // Calculate price
  fastify.get('/calculate', {
    schema: {
      tags: ['pricing'],
      summary: 'Calculate price with applicable rules',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        required: ['variantId', 'quantity'],
        properties: {
          variantId: { type: 'string' },
          quantity: { type: 'integer', minimum: 1 },
          productId: { type: 'string' },
          categoryId: { type: 'string' },
          customerGroupId: { type: 'string' },
          companyId: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { variantId, quantity, productId, categoryId, customerGroupId, companyId } = request.query as any;
      const result = await PricingService.calculatePrice({
        variantId,
        quantity,
        productId,
        categoryId,
        customerGroupId,
        companyId
      });
      return sendSuccess(reply, result);
    } catch (error: any) {
      return sendError(reply, 400, 'BAD_REQUEST', error.message);
    }
  });

  // Get tiered pricing
  fastify.get('/tiered/:variantId', {
    schema: {
      tags: ['pricing'],
      summary: 'Get tiered pricing for a variant',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['variantId'],
        properties: {
          variantId: { type: 'string' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          productId: { type: 'string' },
          categoryId: { type: 'string' },
          customerGroupId: { type: 'string' },
          companyId: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { variantId } = request.params as any;
      const { productId, categoryId, customerGroupId, companyId } = request.query as any;
      const tiers = await PricingService.getTieredPricing(variantId, {
        productId,
        categoryId,
        customerGroupId,
        companyId
      });
      return sendSuccess(reply, tiers);
    } catch (error: any) {
      return sendError(reply, 400, 'BAD_REQUEST', error.message);
    }
  });

  // Get all price rules
  fastify.get('/rules', {
    schema: {
      tags: ['pricing'],
      summary: 'Get all price rules',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 10 },
          customerGroupId: { type: 'string' },
          productId: { type: 'string' },
          variantId: { type: 'string' },
          categoryId: { type: 'string' },
          isActive: { type: 'boolean' },
          search: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { page, limit, customerGroupId, productId, variantId, categoryId, isActive, search } = request.query as any;
      const result = await PricingService.getAllPriceRules(page, limit, {
        customerGroupId,
        productId,
        variantId,
        categoryId,
        isActive,
        search
      });
      return sendSuccess(reply, result);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Get price rule by ID
  fastify.get('/rules/:id', {
    schema: {
      tags: ['pricing'],
      summary: 'Get price rule by ID',
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const rule = await PricingService.getPriceRuleById(id);
      if (!rule) {
        return sendError(reply, 404, 'NOT_FOUND', 'Price rule not found');
      }
      return sendSuccess(reply, rule);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Create price rule
  fastify.post('/rules', {
    schema: {
      tags: ['pricing'],
      summary: 'Create price rule',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['name', 'discountType', 'discountValue', 'minQuantity'],
        properties: {
          name: { type: 'string', minLength: 1 },
          description: { type: 'string' },
          discountType: { type: 'string', enum: ['PERCENTAGE', 'FIXED_AMOUNT', 'FIXED_PRICE'] },
          discountValue: { type: 'number', minimum: 0 },
          minQuantity: { type: 'integer', minimum: 1 },
          maxQuantity: { type: 'integer' },
          customerGroupId: { type: 'string' },
          productId: { type: 'string' },
          variantId: { type: 'string' },
          categoryId: { type: 'string' },
          priority: { type: 'integer', default: 0 },
          isActive: { type: 'boolean', default: true },
          startDate: { type: 'string' },
          endDate: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const rule = await PricingService.createPriceRule(request.body as any);
      return sendSuccess(reply, rule, undefined, 201);
    } catch (error: any) {
      return sendError(reply, 400, 'BAD_REQUEST', error.message);
    }
  });

  // Update price rule
  fastify.put('/rules/:id', {
    schema: {
      tags: ['pricing'],
      summary: 'Update price rule',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 },
          description: { type: 'string' },
          discountType: { type: 'string', enum: ['PERCENTAGE', 'FIXED_AMOUNT', 'FIXED_PRICE'] },
          discountValue: { type: 'number', minimum: 0 },
          minQuantity: { type: 'integer', minimum: 1 },
          maxQuantity: { type: 'integer' },
          customerGroupId: { type: 'string' },
          productId: { type: 'string' },
          variantId: { type: 'string' },
          categoryId: { type: 'string' },
          priority: { type: 'integer' },
          isActive: { type: 'boolean' },
          startDate: { type: 'string' },
          endDate: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const rule = await PricingService.updatePriceRule(id, request.body as any);
      return sendSuccess(reply, rule);
    } catch (error: any) {
      return sendError(reply, 400, 'BAD_REQUEST', error.message);
    }
  });

  // Update price rule status
  fastify.patch('/rules/:id/status', {
    schema: {
      tags: ['pricing'],
      summary: 'Update price rule status',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['isActive'],
        properties: {
          isActive: { type: 'boolean' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const { isActive } = request.body as any;
      const rule = await PricingService.updatePriceRuleStatus(id, isActive);
      return sendSuccess(reply, rule);
    } catch (error: any) {
      return sendError(reply, 400, 'BAD_REQUEST', error.message);
    }
  });

  // Delete price rule
  fastify.delete('/rules/:id', {
    schema: {
      tags: ['pricing'],
      summary: 'Delete price rule',
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      await PricingService.deletePriceRule(id);
      return sendSuccess(reply, { message: 'Price rule deleted successfully' });
    } catch (error: any) {
      return sendError(reply, 400, 'BAD_REQUEST', error.message);
    }
  });

  // Get active price rules
  fastify.get('/rules/active', {
    schema: {
      tags: ['pricing'],
      summary: 'Get active price rules',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          customerGroupId: { type: 'string' },
          productId: { type: 'string' },
          variantId: { type: 'string' },
          categoryId: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { customerGroupId, productId, variantId, categoryId } = request.query as any;
      const rules = await PricingService.getActivePriceRules({
        customerGroupId,
        productId,
        variantId,
        categoryId
      });
      return sendSuccess(reply, rules);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Get price rules by customer group
  fastify.get('/rules/customer-group/:customerGroupId', {
    schema: {
      tags: ['pricing'],
      summary: 'Get price rules by customer group',
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const { customerGroupId } = request.params as any;
      const rules = await PricingService.getPriceRulesByCustomerGroup(customerGroupId);
      return sendSuccess(reply, rules);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Get price rules by product
  fastify.get('/rules/product/:productId', {
    schema: {
      tags: ['pricing'],
      summary: 'Get price rules by product',
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const { productId } = request.params as any;
      const rules = await PricingService.getPriceRulesByProduct(productId);
      return sendSuccess(reply, rules);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });
}
