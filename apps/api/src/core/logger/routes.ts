/**
 * Unified Logging System - API Routes
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { BatchLogRequest } from 'shared/src/logger/types';
import { logger } from './logger';
import { logAggregator, LogQuery } from './log-aggregator';
import { logMonitor, AlertRule } from './log-monitor';
import { authMiddleware, requireAdmin } from '@/core/auth/middleware';

// Rate limit configuration
const RATE_LIMIT_CONFIG = {
  max: 100, // Maximum 100 requests per minute
  timeWindow: '1 minute'
};

// Batch log request Schema
const batchLogRequestSchema = {
  type: 'object',
  required: ['logs', 'clientInfo'],
  properties: {
    logs: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'timestamp', 'level', 'message', 'appName', 'environment', 'meta'],
        properties: {
          id: { type: 'string' },
          timestamp: { type: 'string' },
          level: { type: 'string', enum: ['debug', 'info', 'warn', 'error'] },
          message: { type: 'string' },
          appName: { type: 'string' },
          environment: { type: 'string' },
          version: { type: 'string' },
          meta: { type: 'object' }
        }
      }
    },
    clientInfo: {
      type: 'object',
      required: ['userAgent', 'url', 'timestamp'],
      properties: {
        userAgent: { type: 'string' },
        url: { type: 'string' },
        timestamp: { type: 'string' }
      }
    }
  }
};

// Log statistics response Schema
const logStatsResponseSchema = {
  type: 'object',
  properties: {
    totalLogs: { type: 'number' },
    errorLogs: { type: 'number' },
    warningLogs: { type: 'number' },
    infoLogs: { type: 'number' },
    debugLogs: { type: 'number' },
    timeRange: { type: 'string' }
  }
};

/**
 * Log API Routes
 */
export async function loggerRoutes(fastify: FastifyInstance) {
  // Register rate limit (if available)
  try {
    await fastify.register(require('@fastify/rate-limit'), RATE_LIMIT_CONFIG);
  } catch (error) {
    // Rate limit plugin not available, continue without it
    fastify.log.warn('Rate limit plugin not available for logger routes');
  }

  /**
   * POST /api/logs/batch - Batch receive frontend logs
   */
  fastify.post<{
    Body: BatchLogRequest;
  }>('/batch', {
    schema: {
      description: 'Batch receive frontend logs',
      tags: ['Logger'],
      body: batchLogRequestSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            received: { type: 'number' },
            message: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: BatchLogRequest }>, reply: FastifyReply) => {
    try {
      const { logs, clientInfo } = request.body;

      // Validate log count
      if (!logs || logs.length === 0) {
        return reply.code(400).send({
          error: 'INVALID_REQUEST',
          message: 'No logs provided'
        });
      }

      if (logs.length > 100) {
        return reply.code(400).send({
          error: 'TOO_MANY_LOGS',
          message: 'Maximum 100 logs per batch'
        });
      }

      // Get client information
      const clientIP = request.ip;
      const forwardedFor = request.headers['x-forwarded-for'];
      const realIP = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor || clientIP;

      // Process each log entry
      let processedCount = 0;
      for (const logEntry of logs) {
        try {
          // Enrich with server-side metadata
          const enrichedMeta = {
            ...logEntry.meta,
            clientIP: realIP,
            serverTimestamp: new Date().toISOString(),
            clientInfo: {
              userAgent: clientInfo.userAgent,
              url: clientInfo.url,
              timestamp: clientInfo.timestamp
            }
          };

          // Call corresponding method based on log level
          switch (logEntry.level) {
            case 'debug':
              logger.debug(`[${logEntry.appName}] ${logEntry.message}`, enrichedMeta);
              break;
            case 'info':
              logger.info(`[${logEntry.appName}] ${logEntry.message}`, enrichedMeta);
              break;
            case 'warn':
              logger.warn(`[${logEntry.appName}] ${logEntry.message}`, enrichedMeta);
              break;
            case 'error':
              logger.error(`[${logEntry.appName}] ${logEntry.message}`, enrichedMeta);
              break;
            default:
              logger.info(`[${logEntry.appName}] ${logEntry.message}`, enrichedMeta);
          }

          processedCount++;
        } catch (error) {
          // Log error processing single entry without interrupting the batch
          logger.error('Failed to process log entry', {
            error: error instanceof Error ? error.message : 'Unknown error',
            logEntry: logEntry.id,
            appName: logEntry.appName
          });
        }
      }

      // Log batch log reception event
      logger.info('Batch logs received', {
        type: 'batch_logs_received',
        totalLogs: logs.length,
        processedLogs: processedCount,
        clientIP: realIP,
        userAgent: clientInfo.userAgent,
        sourceUrl: clientInfo.url
      });

      return reply.send({
        success: true,
        received: processedCount,
        message: `Successfully processed ${processedCount} logs`
      });

    } catch (error) {
      logger.error('Batch log processing failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      return reply.code(500).send({
        error: 'PROCESSING_FAILED',
        message: 'Failed to process batch logs'
      });
    }
  });

  /**
   * GET /api/logs/stats - Get log statistics
   */
  fastify.get('/stats', {
    preHandler: [authMiddleware, requireAdmin],
    schema: {
      hide: true,
      description: 'Get log statistics',
      tags: ['Logger'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          timeRange: {
            type: 'string',
            enum: ['1h', '24h', '7d', '30d'],
            default: '24h'
          }
        }
      },
      response: {
        200: logStatsResponseSchema
      }
    }
  }, async (request: FastifyRequest<{
    Querystring: { timeRange?: string }
  }>, reply: FastifyReply) => {
    try {
      const timeRange = request.query.timeRange || '24h';

      // Use LogAggregator to get real statistics
      const stats = await logAggregator.getLogStats(timeRange);

      logger.info('Log stats requested', {
        type: 'log_stats_request',
        timeRange,
        clientIP: request.ip
      });

      return reply.send(stats);
    } catch (error) {
      logger.error('Failed to get log stats', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return reply.code(500).send({
        error: 'STATS_FAILED',
        message: 'Failed to retrieve log statistics'
      });
    }
  });

  /**
   * GET /api/logs/query - Query logs
   */
  fastify.get('/query', {
    preHandler: [authMiddleware, requireAdmin],
    schema: {
      hide: true,
      description: 'Query logs',
      tags: ['Logger'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          appName: { type: 'string' },
          level: { type: 'string', enum: ['debug', 'info', 'warn', 'error'] },
          startTime: { type: 'string' },
          endTime: { type: 'string' },
          message: { type: 'string' },
          userId: { type: 'string' },
          page: { type: 'number', default: 1 },
          limit: { type: 'number', default: 50 },
          sortBy: { type: 'string', enum: ['timestamp', 'level'], default: 'timestamp' },
          sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            logs: { type: 'array' },
            total: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' },
            hasMore: { type: 'boolean' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{
    Querystring: LogQuery
  }>, reply: FastifyReply) => {
    try {
      const result = await logAggregator.queryLogs(request.query);

      logger.info('Log query performed', {
        type: 'log_query',
        query: request.query,
        resultCount: result.logs.length,
        clientIP: request.ip
      });

      return reply.send(result);
    } catch (error) {
      logger.error('Failed to query logs', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: request.query
      });

      return reply.code(500).send({
        error: 'QUERY_FAILED',
        message: 'Failed to query logs'
      });
    }
  });

  /**
   * GET /api/logs/export - Export logs
   */
  fastify.get('/export', {
    preHandler: [authMiddleware, requireAdmin],
    schema: {
      hide: true,
      description: 'Export logs',
      tags: ['Logger'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          appName: { type: 'string' },
          level: { type: 'string', enum: ['debug', 'info', 'warn', 'error'] },
          startTime: { type: 'string' },
          endTime: { type: 'string' },
          message: { type: 'string' },
          userId: { type: 'string' },
          format: { type: 'string', enum: ['json', 'csv'], default: 'json' }
        }
      }
    }
  }, async (request: FastifyRequest<{
    Querystring: LogQuery & { format?: 'json' | 'csv' }
  }>, reply: FastifyReply) => {
    try {
      const { format = 'json', ...query } = request.query;
      const exportData = await logAggregator.exportLogs(query, format);

      logger.info('Log export performed', {
        type: 'log_export',
        query,
        format,
        clientIP: request.ip
      });

      const filename = `logs_${new Date().toISOString().split('T')[0]}.${format}`;
      const contentType = format === 'csv' ? 'text/csv' : 'application/json';

      reply.header('Content-Disposition', `attachment; filename="${filename}"`);
      reply.type(contentType);

      return reply.send(exportData);
    } catch (error) {
      logger.error('Failed to export logs', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: request.query
      });

      return reply.code(500).send({
        error: 'EXPORT_FAILED',
        message: 'Failed to export logs'
      });
    }
  });

  /**
   * GET /api/logs/health - Log system health check
   */
  fastify.get('/health', {
    preHandler: [authMiddleware, requireAdmin],
    schema: {
      description: 'Log system health check',
      tags: ['Logger'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            version: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Test log writing
      logger.info('Health check performed', {
        type: 'health_check',
        clientIP: request.ip,
        timestamp: new Date().toISOString()
      });

      return reply.send({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    } catch (error) {
      return reply.code(500).send({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/logs/alerts - Get alert list
   */
  fastify.get('/alerts', {
    preHandler: [authMiddleware, requireAdmin],
    schema: {
      hide: true,
      description: 'Get alert list',
      tags: ['Logger'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          active: { type: 'boolean', default: false }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            alerts: { type: 'array' },
            total: { type: 'number' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{
    Querystring: { active?: boolean }
  }>, reply: FastifyReply) => {
    try {
      const { active = false } = request.query;
      const alerts = active ? logMonitor.getActiveAlerts() : logMonitor.getAllAlerts();

      return reply.send({
        alerts,
        total: alerts.length
      });
    } catch (error) {
      logger.error('Failed to get alerts', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return reply.code(500).send({
        error: 'ALERTS_FAILED',
        message: 'Failed to retrieve alerts'
      });
    }
  });

  /**
   * POST /api/logs/alerts/:id/resolve - Resolve alert
   */
  fastify.post('/alerts/:id/resolve', {
    preHandler: [authMiddleware, requireAdmin],
    schema: {
      description: 'Resolve alert',
      tags: ['Logger'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      }
    }
  }, async (request: FastifyRequest<{
    Params: { id: string }
  }>, reply: FastifyReply) => {
    try {
      logMonitor.resolveAlert(request.params.id);

      return reply.send({
        success: true,
        message: 'Alert resolved'
      });
    } catch (error) {
      logger.error('Failed to resolve alert', {
        error: error instanceof Error ? error.message : 'Unknown error',
        alertId: request.params.id
      });

      return reply.code(500).send({
        error: 'RESOLVE_FAILED',
        message: 'Failed to resolve alert'
      });
    }
  });

  /**
   * GET /api/logs/rules - Get alert rules
   */
  fastify.get('/rules', {
    preHandler: [authMiddleware, requireAdmin],
    schema: {
      hide: true,
      description: 'Get alert rules',
      tags: ['Logger'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            rules: { type: 'array' },
            total: { type: 'number' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const rules = logMonitor.getRules();

      return reply.send({
        rules,
        total: rules.length
      });
    } catch (error) {
      logger.error('Failed to get alert rules', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return reply.code(500).send({
        error: 'RULES_FAILED',
        message: 'Failed to retrieve alert rules'
      });
    }
  });

  /**
   * POST /api/logs/rules - Create alert rule
   */
  fastify.post('/rules', {
    preHandler: [authMiddleware, requireAdmin],
    schema: {
      hide: true,
      description: 'Create alert rule',
      tags: ['Logger'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['name', 'conditions', 'actions'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          enabled: { type: 'boolean', default: true },
          cooldownMinutes: { type: 'number', default: 15 },
          conditions: { type: 'array' },
          actions: { type: 'array' }
        }
      }
    }
  }, async (request: FastifyRequest<{
    Body: Partial<AlertRule>
  }>, reply: FastifyReply) => {
    try {
      const rule: AlertRule = {
        id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        enabled: true,
        cooldownMinutes: 15,
        ...request.body
      } as AlertRule;

      logMonitor.addRule(rule);

      return reply.send({
        success: true,
        rule
      });
    } catch (error) {
      logger.error('Failed to create alert rule', {
        error: error instanceof Error ? error.message : 'Unknown error',
        rule: request.body
      });

      return reply.code(500).send({
        error: 'CREATE_RULE_FAILED',
        message: 'Failed to create alert rule'
      });
    }
  });

  /**
   * DELETE /api/logs/rules/:id - Delete alert rule
   */
  fastify.delete('/rules/:id', {
    preHandler: [authMiddleware, requireAdmin],
    schema: {
      hide: true,
      description: 'Delete alert rule',
      tags: ['Logger'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      }
    }
  }, async (request: FastifyRequest<{
    Params: { id: string }
  }>, reply: FastifyReply) => {
    try {
      logMonitor.removeRule(request.params.id);

      return reply.send({
        success: true,
        message: 'Alert rule deleted'
      });
    } catch (error) {
      logger.error('Failed to delete alert rule', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ruleId: request.params.id
      });

      return reply.code(500).send({
        error: 'DELETE_RULE_FAILED',
        message: 'Failed to delete alert rule'
      });
    }
  });

  /**
   * GET /api/logs/monitor/dashboard - Get monitoring dashboard data
   */
  fastify.get('/monitor/dashboard', {
    preHandler: [authMiddleware, requireAdmin],
    schema: {
      hide: true,
      description: 'Get monitoring dashboard data',
      tags: ['Logger'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            activeAlerts: { type: 'array' },
            recentAlerts: { type: 'array' },
            stats: { type: 'object' },
            rules: { type: 'object' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const dashboardData = await logMonitor.getDashboardData();
      return reply.send(dashboardData);
    } catch (error) {
      logger.error('Failed to get dashboard data', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return reply.code(500).send({
        error: 'DASHBOARD_FAILED',
        message: 'Failed to retrieve dashboard data'
      });
    }
  });

  /**
   * POST /api/logs/monitor/start - Start monitoring
   */
  fastify.post('/monitor/start', {
    preHandler: [authMiddleware, requireAdmin],
    schema: {
      hide: true,
      description: 'Start log monitoring',
      tags: ['Logger'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          intervalMs: { type: 'number', default: 60000 }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: { intervalMs?: number } }>, reply: FastifyReply) => {
    try {
      const intervalMs = request.body?.intervalMs || 60000;
      logMonitor.start(intervalMs);

      return reply.send({
        success: true,
        message: `Monitoring started with interval ${intervalMs}ms`
      });
    } catch (error) {
      logger.error('Failed to start monitoring', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return reply.code(500).send({
        error: 'START_FAILED',
        message: 'Failed to start monitoring'
      });
    }
  });

  /**
   * POST /api/logs/monitor/stop - Stop monitoring
   */
  fastify.post('/monitor/stop', {
    preHandler: [authMiddleware, requireAdmin],
    schema: {
      hide: true,
      description: 'Stop log monitoring',
      tags: ['Logger'],
      security: [{ bearerAuth: [] }]
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      logMonitor.stop();

      return reply.send({
        success: true,
        message: 'Monitoring stopped'
      });
    } catch (error) {
      logger.error('Failed to stop monitoring', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return reply.code(500).send({
        error: 'STOP_FAILED',
        message: 'Failed to stop monitoring'
      });
    }
  });

  /**
   * POST /api/logs/alerts/test-feishu - Test Feishu alert
   */
  fastify.post('/alerts/test-feishu', {
    preHandler: [authMiddleware, requireAdmin],
    schema: {
      hide: true,
      description: 'Test Feishu alert notification',
      tags: ['Logger'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          webhookUrl: { type: 'string' }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: { webhookUrl?: string } }>, reply: FastifyReply) => {
    try {
      const testAlert = {
        id: 'test_alert_' + Date.now(),
        ruleId: 'test',
        ruleName: 'Test Alert',
        message: 'This is a test alert message',
        severity: 'medium' as const,
        timestamp: new Date(),
        conditions: [],
        data: {},
        resolved: false
      };

      await logMonitor.sendFeishuAlert(testAlert, request.body?.webhookUrl);

      return reply.send({
        success: true,
        message: 'Test alert sent to Feishu'
      });
    } catch (error) {
      logger.error('Failed to send test Feishu alert', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return reply.code(500).send({
        error: 'TEST_FAILED',
        message: 'Failed to send test Feishu alert'
      });
    }
  });
}