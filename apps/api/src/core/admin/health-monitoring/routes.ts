import { sendMappedError } from '@/utils/api-errors';
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
            success: { type: 'boolean', enum: [true] },
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
                pluginTasks: {
                  type: 'object',
                  properties: {
                    queued: { type: 'integer', minimum: 0 }, running: { type: 'integer', minimum: 0 }, oldestAgeSeconds: { type: 'number', minimum: 0 },
                    occupiedSlots: { type: 'array', items: { type: 'object', properties: { installationId: { type: 'string' }, state: { type: 'string' }, count: { type: 'integer' } }, required: ['installationId','state','count'] } },
                    finalFailureOutcomes: { type: 'array', items: { type: 'object', properties: { status: { type: 'string' }, count: { type: 'integer' } }, required: ['status','count'] } },
                    failures: { type: 'array', items: { type: 'object', properties: { taskId: { type: 'string' }, installationId: { type: 'string' }, error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' } }, required: ['code','message'] } }, required: ['taskId','installationId','error'] } },
                    finalFailures: {type:'array',items:{type:'object',properties:{taskId:{type:'string'},installationId:{type:'string'},status:{type:'string',enum:['FAILED','UNKNOWN']},error:{type:['object','null'],properties:{code:{type:'string'},message:{type:'string'}},required:['code','message']}},required:['taskId','installationId','status','error']}},
                  }, required: ['queued','running','oldestAgeSeconds','occupiedSlots','finalFailureOutcomes','failures','finalFailures'],
                },
                gitSha: { type: 'string' },
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
              required: ['status', 'database', 'redis', 'pluginRuntime', 'pluginTasks', 'worker', 'version', 'gitSha', 'uptime'],
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
    } catch (error) { return sendMappedError(reply, error); }
  });
}
