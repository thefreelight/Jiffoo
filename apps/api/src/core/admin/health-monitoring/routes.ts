/**
 * Admin health summary routes.
 */

import { FastifyInstance } from 'fastify';
import { HealthMonitoringService } from './service';
import { sendError, sendSuccess } from '@/utils/response';
import { sendKnownError } from '@/utils/api-errors';

export async function healthMonitoringRoutes(fastify: FastifyInstance) {

  fastify.get('/health/summary', {
    schema: {
      tags: ['admin-health'],
      summary: 'Get component health summary',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                status: {
                  type: 'string',
                  enum: ['healthy', 'degraded', 'unhealthy'],
                },
                database: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['ok', 'error'] },
                  },
                  required: ['status'],
                },
                redis: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['ok', 'error'] },
                  },
                  required: ['status'],
                },
                pluginRuntime: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['ok'] },
                    loaded: { type: 'number' },
                  },
                  required: ['status', 'loaded'],
                },
                version: { type: 'string' },
                worker: {
                  type: 'object',
                  properties: {
                    running: { type: 'boolean' },
                    instances: { type: 'integer', minimum: 0 },
                    lastBeatAt: { type: ['string', 'null'], format: 'date-time' },
                  },
                  required: ['running', 'instances', 'lastBeatAt'],
                },
                uptime: { type: 'number' },
              },
              required: ['status', 'database', 'redis', 'pluginRuntime', 'worker', 'version', 'uptime'],
            },
          },
          required: ['success', 'data'],
        },
        '5xx': {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (_request, reply) => {
    try {
      const data = await HealthMonitoringService.getHealthSummary();
      return sendSuccess(reply, data);
    } catch (error) {
      const knownErrorResponse = sendKnownError(reply, error);
      if (knownErrorResponse) return knownErrorResponse;
      const message = error instanceof Error ? error.message : 'Failed to fetch health summary';
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', message);
    }
  });
}
