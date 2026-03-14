/**
 * Error Tracking Routes
 */

import { FastifyInstance } from 'fastify';
import { ErrorTrackingService } from './service';
import { ErrorAnalyticsService } from './analytics';
import { sendSuccess, sendError } from '@/utils/response';

export async function errorTrackingRoutes(fastify: FastifyInstance) {
  // Get error statistics
  fastify.get('/stats', {
    schema: {
      tags: ['error-tracking'],
      summary: 'Get error statistics',
      querystring: {
        type: 'object',
        properties: {
          timeRange: { type: 'string', default: '24h', enum: ['1h', '24h', '7d', '30d'] }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { timeRange } = request.query as any;
      const stats = await ErrorTrackingService.getErrorStats(timeRange || '24h');
      return sendSuccess(reply, stats);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Get error trends
  fastify.get('/trends', {
    schema: {
      tags: ['error-tracking'],
      summary: 'Get error trends over time',
      querystring: {
        type: 'object',
        properties: {
          timeRange: { type: 'string', default: '24h', enum: ['1h', '24h', '7d', '30d'] }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { timeRange } = request.query as any;
      const trends = await ErrorAnalyticsService.getErrorTrends(timeRange || '24h');
      return sendSuccess(reply, trends);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Get top errors
  fastify.get('/top', {
    schema: {
      tags: ['error-tracking'],
      summary: 'Get top errors by occurrence',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', default: 10 },
          timeRange: { type: 'string', enum: ['1h', '24h', '7d', '30d'] }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { limit, timeRange } = request.query as any;
      const topErrors = await ErrorAnalyticsService.getTopErrors(
        limit || 10,
        timeRange as any
      );
      return sendSuccess(reply, topErrors);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Get severity breakdown
  fastify.get('/severity', {
    schema: {
      tags: ['error-tracking'],
      summary: 'Get errors by severity',
      querystring: {
        type: 'object',
        properties: {
          timeRange: { type: 'string', default: '24h', enum: ['1h', '24h', '7d', '30d'] },
          includeTrend: { type: 'boolean', default: true }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { timeRange, includeTrend } = request.query as any;
      const severityAnalysis = await ErrorAnalyticsService.getErrorsBySeverity(
        timeRange || '24h',
        includeTrend !== false
      );
      return sendSuccess(reply, severityAnalysis);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Get errors list with filters
  fastify.get('/', {
    schema: {
      tags: ['error-tracking'],
      summary: 'Get errors list',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 20 },
          errorHash: { type: 'string' },
          severity: { type: 'string', enum: ['info', 'warning', 'error', 'critical'] },
          resolved: { type: 'boolean' },
          userId: { type: 'string' },
          storeId: { type: 'string' },
          search: { type: 'string' },
          startDate: { type: 'string', format: 'date-time' },
          endDate: { type: 'string', format: 'date-time' },
          sortBy: { type: 'string', default: 'occurredAt' },
          sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { page, limit, ...filters } = request.query as any;

      // Parse date strings to Date objects if provided
      if (filters.startDate) {
        filters.startDate = new Date(filters.startDate);
      }
      if (filters.endDate) {
        filters.endDate = new Date(filters.endDate);
      }

      const result = await ErrorTrackingService.getErrors(
        page || 1,
        limit || 20,
        filters
      );
      return sendSuccess(reply, result);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Resolve/unresolve error
  fastify.patch('/:id/resolve', {
    schema: {
      tags: ['error-tracking'],
      summary: 'Resolve or unresolve an error',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['resolved'],
        properties: {
          resolved: { type: 'boolean' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const { resolved } = request.body as any;

      const resolvedBy = request.user?.id || 'system';

      const result = await ErrorTrackingService.updateError(
        id,
        { resolved },
        resolvedBy
      );

      if (!result) {
        return sendError(reply, 404, 'NOT_FOUND', 'Error not found');
      }

      return sendSuccess(reply, result);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Get error by ID (Must be last to avoid collision with static routes)
  fastify.get('/:id', {
    schema: {
      tags: ['error-tracking'],
      summary: 'Get error by ID',
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
      const error = await ErrorTrackingService.getError(id);
      if (!error) {
        return sendError(reply, 404, 'NOT_FOUND', 'Error not found');
      }
      return sendSuccess(reply, error);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });
}
