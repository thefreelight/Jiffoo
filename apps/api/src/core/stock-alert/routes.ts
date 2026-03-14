/**
 * Admin Stock Alert Routes
 */

import { FastifyInstance } from 'fastify';
import { StockAlertService } from './service';
import { authMiddleware, requireAdmin } from '@/core/auth/middleware';
import { sendSuccess, sendError } from '@/utils/response';
import { triggerStockAlertCheck } from './jobs';

export async function adminStockAlertRoutes(fastify: FastifyInstance) {
  // Apply auth middleware to all admin stock alert routes (before schema validation)
  fastify.addHook('onRequest', authMiddleware);
  fastify.addHook('onRequest', requireAdmin);

  // Get stock alerts list
  fastify.get('/', {
    schema: {
      tags: ['admin-stock-alerts'],
      summary: 'Get stock alerts list',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 20 },
          warehouseId: { type: 'string' },
          variantId: { type: 'string' },
          productId: { type: 'string' },
          alertType: { type: 'string', enum: ['LOW_STOCK', 'OUT_OF_STOCK', 'RESTOCK_NEEDED'] },
          status: { type: 'string', enum: ['ACTIVE', 'RESOLVED', 'DISMISSED'] },
          dateFrom: { type: 'string' },
          dateTo: { type: 'string' },
          sortBy: { type: 'string', enum: ['createdAt', 'updatedAt', 'threshold', 'quantity'] },
          sortOrder: { type: 'string', enum: ['asc', 'desc'] }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { page, limit, ...filters } = request.query as any;
      const result = await StockAlertService.getAlerts(page, limit, filters);
      return sendSuccess(reply, result);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Get single stock alert
  fastify.get('/:id', {
    schema: {
      tags: ['admin-stock-alerts'],
      summary: 'Get stock alert by ID',
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const alert = await StockAlertService.getAlertById(id);
      if (!alert) {
        return sendError(reply, 404, 'NOT_FOUND', 'Stock alert not found');
      }
      return sendSuccess(reply, alert);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Get stock alert statistics
  fastify.get('/stats/summary', {
    schema: {
      tags: ['admin-stock-alerts'],
      summary: 'Get stock alert statistics',
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const stats = await StockAlertService.getAlertStats();
      return sendSuccess(reply, stats);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Create stock alert
  fastify.post('/', {
    schema: {
      tags: ['admin-stock-alerts'],
      summary: 'Create stock alert',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['warehouseId', 'variantId', 'threshold'],
        properties: {
          warehouseId: { type: 'string' },
          variantId: { type: 'string' },
          alertType: { type: 'string', enum: ['LOW_STOCK', 'OUT_OF_STOCK', 'RESTOCK_NEEDED'], default: 'LOW_STOCK' },
          threshold: { type: 'integer', minimum: 0, maximum: 1000000 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const alert = await StockAlertService.createAlert(request.body as any);
      return sendSuccess(reply, alert, undefined, 201);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return sendError(reply, 404, 'NOT_FOUND', error.message);
      }
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Update stock alert
  fastify.put('/:id', {
    schema: {
      tags: ['admin-stock-alerts'],
      summary: 'Update stock alert',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          alertType: { type: 'string', enum: ['LOW_STOCK', 'OUT_OF_STOCK', 'RESTOCK_NEEDED'] },
          threshold: { type: 'integer', minimum: 0, maximum: 1000000 },
          status: { type: 'string', enum: ['ACTIVE', 'RESOLVED', 'DISMISSED'] }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const alert = await StockAlertService.updateAlert(id, request.body as any);
      return sendSuccess(reply, alert);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return sendError(reply, 404, 'NOT_FOUND', error.message);
      }
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Resolve or dismiss stock alert
  fastify.post('/:id/resolve', {
    schema: {
      tags: ['admin-stock-alerts'],
      summary: 'Resolve or dismiss stock alert',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['RESOLVED', 'DISMISSED'] }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const { status } = request.body as any;
      const alert = await StockAlertService.resolveAlert({ alertId: id, status });
      return sendSuccess(reply, alert);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return sendError(reply, 404, 'NOT_FOUND', error.message);
      }
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Bulk resolve stock alerts
  fastify.post('/bulk-resolve', {
    schema: {
      tags: ['admin-stock-alerts'],
      summary: 'Bulk resolve or dismiss stock alerts',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['alertIds', 'status'],
        properties: {
          alertIds: { type: 'array', items: { type: 'string' }, minItems: 1 },
          status: { type: 'string', enum: ['RESOLVED', 'DISMISSED'] }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const result = await StockAlertService.bulkResolveAlerts(request.body as any);
      return sendSuccess(reply, result, `${result.count} alert(s) updated`);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Delete stock alert
  fastify.delete('/:id', {
    schema: {
      tags: ['admin-stock-alerts'],
      summary: 'Delete stock alert',
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      await StockAlertService.deleteAlert(id);
      return sendSuccess(reply, null, 'Stock alert deleted');
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return sendError(reply, 404, 'NOT_FOUND', error.message);
      }
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Manually trigger stock alert check
  fastify.post('/check', {
    schema: {
      tags: ['admin-stock-alerts'],
      summary: 'Manually trigger stock alert check',
      description: 'Scans all warehouse inventory and creates/resolves alerts based on thresholds',
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      // Trigger the background job
      await triggerStockAlertCheck();
      return sendSuccess(reply, null, 'Stock alert check triggered');
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });
}
