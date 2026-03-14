/**
 * Discount Routes
 */

import { FastifyInstance } from 'fastify';
import { DiscountService } from './service';
import { sendSuccess, sendError } from '@/utils/response';

export async function discountRoutes(fastify: FastifyInstance) {
  // Get discounts list
  fastify.get('/', {
    schema: {
      tags: ['discounts'],
      summary: 'Get discounts list',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 10 },
          search: { type: 'string' },
          type: { type: 'string' },
          isActive: { type: 'boolean' },
          sortBy: { type: 'string' },
          sortOrder: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { page, limit, ...filters } = request.query as any;
      const result = await DiscountService.getDiscounts(
        page || 1,
        limit || 10,
        filters
      );
      return sendSuccess(reply, result);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Validate discount code
  fastify.post('/validate', {
    schema: {
      tags: ['discounts'],
      summary: 'Validate discount code',
      body: {
        type: 'object',
        required: ['code'],
        properties: {
          code: { type: 'string' },
          cartTotal: { type: 'number' },
          productIds: { type: 'array', items: { type: 'string' } },
          userId: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const data = request.body as any;
      const result = await DiscountService.validateDiscount(data);
      return sendSuccess(reply, result);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Get discount analytics
  fastify.get('/analytics', {
    schema: {
      tags: ['discounts'],
      summary: 'Get discount analytics and performance metrics',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                metrics: {
                  type: 'object',
                  properties: {
                    totalDiscounts: { type: 'number' },
                    activeDiscounts: { type: 'number' },
                    totalUsageCount: { type: 'number' },
                    totalDiscountAmount: { type: 'number' }
                  }
                },
                topDiscounts: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      code: { type: 'string' },
                      type: { type: 'string' },
                      value: { type: 'number' },
                      usedCount: { type: 'number' },
                      totalUsages: { type: 'number' }
                    }
                  }
                },
                topPerformingDiscounts: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      code: { type: 'string' },
                      type: { type: 'string' },
                      value: { type: 'number' },
                      usedCount: { type: 'number' },
                      totalUsages: { type: 'number' }
                    }
                  }
                },
                topDiscountsByRevenue: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      discountId: { type: 'string' },
                      totalDiscountAmount: { type: 'number' }
                    }
                  }
                },
                recentUsage: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      userId: { type: 'string' },
                      discountCode: { type: 'string' },
                      discountType: { type: 'string' },
                      discountAmount: { type: 'number' },
                      userEmail: { type: 'string' },
                      username: { type: 'string', nullable: true },
                      createdAt: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        },
        '5xx': {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const data = await DiscountService.getAnalytics();
      return sendSuccess(reply, data);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message || 'Failed to fetch analytics data');
    }
  });

  // Create new discount
  fastify.post('/', {
    schema: {
      tags: ['discounts'],
      summary: 'Create new discount',
      body: {
        type: 'object',
        required: ['code', 'type', 'value'],
        properties: {
          code: { type: 'string' },
          type: { type: 'string' },
          value: { type: 'number' },
          minAmount: { type: 'number' },
          maxUses: { type: 'integer' },
          startDate: { type: 'string' },
          endDate: { type: 'string' },
          isActive: { type: 'boolean' },
          stackable: { type: 'boolean' },
          description: { type: 'string' },
          productIds: { type: 'array', items: { type: 'string' } },
          customerGroups: { type: 'array', items: { type: 'string' } }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const data = request.body as any;
      const discount = await DiscountService.createDiscount(data);
      return sendSuccess(reply, discount);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Get discount by code
  fastify.get('/code/:code', {
    schema: {
      tags: ['discounts'],
      summary: 'Get discount by code'
    }
  }, async (request, reply) => {
    try {
      const { code } = request.params as any;
      const discount = await DiscountService.getDiscountByCode(code);
      if (!discount) {
        return sendError(reply, 404, 'NOT_FOUND', 'Discount not found');
      }
      return sendSuccess(reply, discount);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Update discount
  fastify.put('/:id', {
    schema: {
      tags: ['discounts'],
      summary: 'Update discount',
      body: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          type: { type: 'string' },
          value: { type: 'number' },
          minAmount: { type: 'number' },
          maxUses: { type: 'integer' },
          startDate: { type: 'string' },
          endDate: { type: 'string' },
          isActive: { type: 'boolean' },
          stackable: { type: 'boolean' },
          description: { type: 'string' },
          productIds: { type: 'array', items: { type: 'string' } },
          customerGroups: { type: 'array', items: { type: 'string' } }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const data = request.body as any;
      const discount = await DiscountService.updateDiscount(id, data);
      if (!discount) {
        return sendError(reply, 404, 'NOT_FOUND', 'Discount not found');
      }
      return sendSuccess(reply, discount);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Delete discount
  fastify.delete('/:id', {
    schema: {
      tags: ['discounts'],
      summary: 'Delete discount'
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const success = await DiscountService.deleteDiscount(id);
      if (!success) {
        return sendError(reply, 404, 'NOT_FOUND', 'Discount not found');
      }
      return sendSuccess(reply, { message: 'Discount deleted successfully' });
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Get discount by ID (Must be last to avoid collision with static routes)
  fastify.get('/:id', {
    schema: {
      tags: ['discounts'],
      summary: 'Get discount by ID'
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const discount = await DiscountService.getDiscountById(id);
      if (!discount) {
        return sendError(reply, 404, 'NOT_FOUND', 'Discount not found');
      }
      return sendSuccess(reply, discount);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });
}
