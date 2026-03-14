/**
 * Recommendation Routes
 */

import { FastifyInstance } from 'fastify';
import { RecommendationService } from './service';
import { DEFAULT_LOCALE } from '@/utils/i18n';
import { sendSuccess, sendError } from '@/utils/response';

export async function recommendationRoutes(fastify: FastifyInstance) {
  const handlePersonalizedRecommendations = async (request: any, reply: any) => {
    try {
      const { userId, sessionId, limit, excludeProductIds, locale } = request.query as any;

      const result = await RecommendationService.getPersonalizedRecommendations({
        userId,
        sessionId,
        limit: limit || 10,
        excludeProductIds: excludeProductIds || [],
        locale: locale || DEFAULT_LOCALE,
      });

      return sendSuccess(reply, result);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to load recommendations');
    }
  };

  const personalizedQuerySchema = {
    type: 'object',
    properties: {
      userId: { type: 'string' },
      sessionId: { type: 'string' },
      limit: { type: 'integer', default: 10 },
      excludeProductIds: { type: 'array', items: { type: 'string' } },
      locale: { type: 'string', default: 'en' }
    }
  } as const;

  // Get 'customers also bought' recommendations
  fastify.get('/customers-also-bought', {
    schema: {
      tags: ['recommendations'],
      summary: "Get 'customers also bought' recommendations",
      querystring: {
        type: 'object',
        required: ['productId'],
        properties: {
          productId: { type: 'string' },
          limit: { type: 'integer', default: 10 },
          excludeProductIds: { type: 'array', items: { type: 'string' } },
          locale: { type: 'string', default: 'en' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { productId, limit, excludeProductIds, locale } = request.query as any;

      if (!productId) {
        return sendError(reply, 400, 'VALIDATION_ERROR', 'Product ID is required');
      }

      const result = await RecommendationService.getCustomersAlsoBought(productId, {
        limit: limit || 10,
        excludeProductIds: excludeProductIds || [],
        locale: locale || DEFAULT_LOCALE,
      });

      return sendSuccess(reply, result);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to load recommendations');
    }
  });

  // Get frequently bought together recommendations
  fastify.get('/frequently-bought-together', {
    schema: {
      tags: ['recommendations'],
      summary: 'Get frequently bought together recommendations',
      querystring: {
        type: 'object',
        required: ['productIds'],
        properties: {
          productIds: { type: 'array', items: { type: 'string' } },
          limit: { type: 'integer', default: 5 },
          excludeProductIds: { type: 'array', items: { type: 'string' } },
          locale: { type: 'string', default: 'en' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { productIds, limit, excludeProductIds, locale } = request.query as any;

      if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
        return sendError(reply, 400, 'VALIDATION_ERROR', 'At least one product ID is required');
      }

      const result = await RecommendationService.getFrequentlyBoughtTogether(productIds, {
        limit: limit || 5,
        excludeProductIds: excludeProductIds || [],
        locale: locale || DEFAULT_LOCALE,
      });

      return sendSuccess(reply, result);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to load recommendations');
    }
  });

  // Get personalized recommendations
  fastify.get('/personalized', {
    schema: {
      tags: ['recommendations'],
      summary: 'Get personalized recommendations',
      querystring: personalizedQuerySchema
    }
  }, handlePersonalizedRecommendations);

  // Backwards-compatible alias kept for older storefront bundles.
  fastify.get('/personalized/homepage', {
    schema: {
      tags: ['recommendations'],
      summary: 'Get personalized homepage recommendations',
      querystring: personalizedQuerySchema
    }
  }, handlePersonalizedRecommendations);

  // Track interaction with recommendations
  fastify.post('/track-interaction', {
    schema: {
      tags: ['recommendations'],
      summary: 'Track user interaction with recommendations',
      body: {
        type: 'object',
        required: ['productId', 'sessionId', 'recommendationType', 'action'],
        properties: {
          userId: { type: 'string' },
          productId: { type: 'string' },
          sessionId: { type: 'string' },
          recommendationType: {
            type: 'string',
            enum: ['customers-also-bought', 'frequently-bought-together', 'personalized']
          },
          action: {
            type: 'string',
            enum: ['view', 'click', 'add-to-cart', 'purchase']
          },
          sourceProductId: { type: 'string' },
          sourceContext: { type: 'string' },
          algorithmVariant: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const data = request.body as any;

      const result = await RecommendationService.trackInteraction(data);

      return sendSuccess(reply, result);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Get recommendation analytics
  fastify.get('/analytics', {
    schema: {
      tags: ['recommendations'],
      summary: 'Get recommendation analytics',
      querystring: {
        type: 'object',
        required: ['startDate', 'endDate'],
        properties: {
          startDate: { type: 'string', format: 'date-time' },
          endDate: { type: 'string', format: 'date-time' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { startDate, endDate } = request.query as any;

      if (!startDate || !endDate) {
        return sendError(reply, 400, 'VALIDATION_ERROR', 'Start date and end date are required');
      }

      const result = await RecommendationService.getAnalytics(
        new Date(startDate),
        new Date(endDate)
      );

      return sendSuccess(reply, result);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Create A/B testing configuration
  fastify.post('/ab-config', {
    schema: {
      tags: ['recommendations'],
      summary: 'Create A/B testing configuration',
      body: {
        type: 'object',
        required: ['name', 'recommendationType', 'algorithm'],
        properties: {
          name: { type: 'string' },
          recommendationType: {
            type: 'string',
            enum: ['customers-also-bought', 'frequently-bought-together', 'personalized']
          },
          algorithm: { type: 'string' },
          isActive: { type: 'boolean', default: true },
          trafficPercentage: { type: 'number', minimum: 0, maximum: 100, default: 100 },
          priority: { type: 'integer', default: 0 },
          parameters: { type: 'object' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const data = request.body as any;

      const result = await RecommendationService.createConfig(data);

      return sendSuccess(reply, result, undefined, 201);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Get A/B testing configurations
  fastify.get('/ab-config', {
    schema: {
      tags: ['recommendations'],
      summary: 'Get A/B testing configurations',
      querystring: {
        type: 'object',
        properties: {
          recommendationType: {
            type: 'string',
            enum: ['customers-also-bought', 'frequently-bought-together', 'personalized']
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { recommendationType } = request.query as any;

      const result = await RecommendationService.getConfigs(recommendationType);

      return sendSuccess(reply, result);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Update A/B testing configuration
  fastify.put('/ab-config/:id', {
    schema: {
      tags: ['recommendations'],
      summary: 'Update A/B testing configuration',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          algorithm: { type: 'string' },
          isActive: { type: 'boolean' },
          trafficPercentage: { type: 'number', minimum: 0, maximum: 100 },
          priority: { type: 'integer' },
          parameters: { type: 'object' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const data = request.body as any;

      const result = await RecommendationService.updateConfig(id, data);

      return sendSuccess(reply, result);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Delete A/B testing configuration
  fastify.delete('/ab-config/:id', {
    schema: {
      tags: ['recommendations'],
      summary: 'Delete A/B testing configuration',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;

      await RecommendationService.deleteConfig(id);

      return sendSuccess(reply, { message: 'Configuration deleted successfully' });
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Export user recommendation data (GDPR compliance)
  fastify.get('/export-user-data', {
    schema: {
      tags: ['recommendations'],
      summary: 'Export user recommendation data for GDPR compliance',
      querystring: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { userId } = request.query as any;

      if (!userId) {
        return sendError(reply, 400, 'VALIDATION_ERROR', 'User ID is required');
      }

      const result = await RecommendationService.exportUserData(userId);

      return sendSuccess(reply, result);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Delete user recommendation data (GDPR right to be forgotten)
  fastify.delete('/user-data', {
    schema: {
      tags: ['recommendations'],
      summary: 'Delete user recommendation data for GDPR right to be forgotten',
      querystring: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { userId } = request.query as any;

      if (!userId) {
        return sendError(reply, 400, 'VALIDATION_ERROR', 'User ID is required');
      }

      const result = await RecommendationService.deleteUserData(userId);

      return sendSuccess(reply, result);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });
}
