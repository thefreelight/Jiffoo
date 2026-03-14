/**
 * Inventory Forecasting Routes
 */

import { FastifyInstance } from 'fastify';
import { ForecastingService } from './service';
import { authMiddleware, requireAdmin } from '@/core/auth/middleware';
import { sendSuccess, sendError } from '@/utils/response';
import { forecastingSchemas } from './schemas';
import { prisma } from '@/config/database';

async function resolveVariantId(productId: string, variantId?: string): Promise<string> {
  if (variantId) return variantId;

  const defaultVariant = await prisma.productVariant.findFirst({
    where: {
      productId,
      isActive: true,
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: { id: true },
  });

  if (!defaultVariant) {
    throw new Error(`No active variant found for product ${productId}`);
  }

  return defaultVariant.id;
}

export async function forecastingRoutes(fastify: FastifyInstance) {
  // Apply auth hooks
  fastify.addHook('onRequest', authMiddleware);
  fastify.addHook('onRequest', requireAdmin);

  // GET /api/admin/inventory/dashboard
  // Aggregated inventory dashboard data for admin page
  fastify.get('/dashboard', {
    schema: {
      tags: ['inventory-forecasting'],
      summary: 'Get aggregated inventory dashboard data',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 10 },
          status: { type: 'string', enum: ['ACTIVE', 'DISMISSED', 'RESOLVED'], default: 'ACTIVE' },
          productId: { type: 'string' },
          variantId: { type: 'string' }
        }
      },
      ...forecastingSchemas.getDashboard,
    }
  }, async (request, reply) => {
    try {
      const { page, limit, status, productId, variantId } = request.query as any;
      const dashboard = await ForecastingService.getInventoryDashboard({
        page: page || 1,
        limit: limit || 10,
        status: status || 'ACTIVE',
        productId,
        variantId,
      });
      return sendSuccess(reply, dashboard);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message || 'Failed to get inventory dashboard');
    }
  });

  // GET /api/admin/inventory/stats
  // Global inventory stats for cards
  fastify.get('/stats', {
    schema: {
      tags: ['inventory-forecasting'],
      summary: 'Get global inventory stats',
      security: [{ bearerAuth: [] }],
      ...forecastingSchemas.getStats,
    }
  }, async (_request, reply) => {
    try {
      const stats = await ForecastingService.getInventoryStats();
      return sendSuccess(reply, stats);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message || 'Failed to get inventory stats');
    }
  });

  // POST /api/admin/inventory/forecast
  // Explicitly generate new forecast
  fastify.post('/forecast', {
    schema: {
      tags: ['inventory-forecasting'],
      summary: 'Generate new forecast for a product/variant',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['productId'],
        properties: {
          productId: { type: 'string' },
          variantId: { type: 'string' },
          days: { type: 'integer', default: 30 },
          historicalDays: { type: 'integer', default: 90 }
        }
      },
      ...forecastingSchemas.generateForecast,
    }
  }, async (request, reply) => {
    try {
      const { productId, variantId, days, historicalDays } = request.body as any;
      const resolvedVariantId = await resolveVariantId(productId, variantId);

      const forecast = await ForecastingService.generateForecast(
        productId,
        resolvedVariantId,
        days || 30,
        historicalDays || 90
      );

      return sendSuccess(reply, forecast);
    } catch (error: any) {
      if (error.message?.includes('No active variant found')) {
        return sendError(reply, 400, 'VALIDATION_ERROR', error.message);
      }
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message || 'Failed to generate forecast');
    }
  });

  // POST /api/admin/inventory/recompute-all
  // Recompute forecasts and alerts for all active SKUs
  fastify.post('/recompute-all', {
    schema: {
      tags: ['inventory-forecasting'],
      summary: 'Recompute forecasts and alerts for all active SKUs',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          days: { type: 'integer', default: 30 },
          historicalDays: { type: 'integer', default: 90 }
        }
      },
      ...forecastingSchemas.recomputeAll,
    }
  }, async (request, reply) => {
    try {
      const { days, historicalDays } = (request.body as any) || {};
      const result = await ForecastingService.recomputeAllActiveSkus({
        forecastDays: days || 30,
        historicalDays: historicalDays || 90,
      });

      return sendSuccess(reply, result);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message || 'Failed to recompute all active SKUs');
    }
  });

  // POST /api/admin/inventory/alerts/check
  // Manually check and create alerts for a product/variant
  fastify.post('/alerts/check', {
    schema: {
      tags: ['inventory-forecasting'],
      summary: 'Check inventory levels and create alerts if needed',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['productId'],
        properties: {
          productId: { type: 'string' },
          variantId: { type: 'string' }
        }
      },
      ...forecastingSchemas.checkAlerts,
    }
  }, async (request, reply) => {
    try {
      const { productId, variantId } = request.body as any;
      const resolvedVariantId = await resolveVariantId(productId, variantId);

      const alertIds = await ForecastingService.checkAndCreateAlerts(
        productId,
        resolvedVariantId
      );

      return sendSuccess(reply, {
        alertsCreated: alertIds.length,
        alertIds
      });
    } catch (error: any) {
      if (error.message?.includes('No active variant found')) {
        return sendError(reply, 400, 'VALIDATION_ERROR', error.message);
      }
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message || 'Failed to check alerts');
    }
  });

  // PUT /api/admin/inventory/alerts/:id/dismiss
  // Dismiss an alert
  fastify.put('/alerts/:id/dismiss', {
    schema: {
      tags: ['inventory-forecasting'],
      summary: 'Dismiss an alert',
      security: [{ bearerAuth: [] }],
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
          reason: { type: 'string' }
        }
      },
      ...forecastingSchemas.dismissAlert,
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const { reason } = request.body as any;

      const alert = await ForecastingService.dismissAlert(id, reason);

      return sendSuccess(reply, alert);
    } catch (error: any) {
      if (error.message === 'Alert not found') {
        return sendError(reply, 404, 'NOT_FOUND', error.message);
      }
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message || 'Failed to dismiss alert');
    }
  });

  // PUT /api/admin/inventory/alerts/:id/resolve
  // Resolve an alert
  fastify.put('/alerts/:id/resolve', {
    schema: {
      tags: ['inventory-forecasting'],
      summary: 'Resolve an alert',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      },
      ...forecastingSchemas.resolveAlert,
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;

      const alert = await ForecastingService.resolveAlert(id);

      return sendSuccess(reply, alert);
    } catch (error: any) {
      if (error.message === 'Alert not found') {
        return sendError(reply, 404, 'NOT_FOUND', error.message);
      }
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message || 'Failed to resolve alert');
    }
  });

  // PUT /api/admin/inventory/alerts/:id/status
  // Update alert status
  fastify.put('/alerts/:id/status', {
    schema: {
      tags: ['inventory-forecasting'],
      summary: 'Update alert status',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['ACTIVE', 'DISMISSED', 'RESOLVED'] }
        }
      },
      ...forecastingSchemas.updateAlertStatus,
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const { status } = request.body as any;

      const alert = await ForecastingService.updateAlertStatus(id, status);

      return sendSuccess(reply, alert);
    } catch (error: any) {
      if (error.message === 'Alert not found') {
        return sendError(reply, 404, 'NOT_FOUND', error.message);
      }
      if (error.message.includes('Invalid status')) {
        return sendError(reply, 400, 'VALIDATION_ERROR', error.message);
      }
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message || 'Failed to update alert status');
    }
  });

  // POST /api/admin/inventory/accuracy/:forecastId
  // Record forecast accuracy for evaluation
  fastify.post('/accuracy/:forecastId', {
    schema: {
      tags: ['inventory-forecasting'],
      summary: 'Record forecast accuracy by comparing predicted vs actual demand',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['forecastId'],
        properties: {
          forecastId: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['actualDemand'],
        properties: {
          actualDemand: { type: 'number' }
        }
      },
      ...forecastingSchemas.recordAccuracy,
    }
  }, async (request, reply) => {
    try {
      const { forecastId } = request.params as any;
      const { actualDemand } = request.body as any;

      const accuracy = await ForecastingService.recordForecastAccuracy(
        forecastId,
        actualDemand
      );

      return sendSuccess(reply, accuracy);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message || 'Failed to record accuracy');
    }
  });
}
