/**
 * Admin Health Monitoring Routes
 */

import { FastifyInstance } from 'fastify';
import { HealthMonitoringService } from './service';
import { authMiddleware, requireAdmin } from '@/core/auth/middleware';
import { sendSuccess, sendError } from '@/utils/response';
import type { AlertThresholds } from './types';
import { DEFAULT_ALERT_THRESHOLDS } from './types';

export async function healthMonitoringRoutes(fastify: FastifyInstance) {
    // Apply auth hooks
    fastify.addHook('onRequest', authMiddleware);
    fastify.addHook('onRequest', requireAdmin);

    // GET /api/admin/health/metrics
    fastify.get('/health/metrics', {
        schema: {
            tags: ['admin-health'],
            summary: 'Get comprehensive health metrics',
            security: [{ bearerAuth: [] }],
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'object',
                            properties: {
                                system: {
                                    type: 'object',
                                    properties: {
                                        cpu: {
                                            type: 'object',
                                            properties: {
                                                usage: { type: 'number' },
                                                usagePercent: { type: 'number' },
                                                loadAverage: {
                                                    type: 'array',
                                                    items: { type: 'number' }
                                                },
                                                cores: { type: 'number' }
                                            }
                                        },
                                        memory: {
                                            type: 'object',
                                            properties: {
                                                usage: { type: 'number' },
                                                totalBytes: { type: 'number' },
                                                usedBytes: { type: 'number' },
                                                freeBytes: { type: 'number' },
                                                usagePercent: { type: 'number' }
                                            }
                                        },
                                        disk: {
                                            type: 'object',
                                            properties: {
                                                usage: { type: 'number' },
                                                totalBytes: { type: 'number' },
                                                usedBytes: { type: 'number' },
                                                freeBytes: { type: 'number' },
                                                usagePercent: { type: 'number' }
                                            }
                                        }
                                    }
                                },
                                health: { type: 'object' },
                                database: {
                                    type: 'object',
                                    properties: {
                                        size: { type: 'number' },
                                        active: { type: 'number' },
                                        idle: { type: 'number' },
                                        max: { type: 'number' },
                                        waiting: { type: 'number' },
                                        usage: { type: 'number' }
                                    }
                                },
                                cache: {
                                    type: 'object',
                                    properties: {
                                        hitRate: { type: 'number' },
                                        missRate: { type: 'number' },
                                        keyCount: { type: 'number' },
                                        memoryUsed: { type: 'number' },
                                        memoryPeak: { type: 'number' },
                                        evictedKeys: { type: 'number' },
                                        connectedClients: { type: 'number' },
                                        uptime: { type: 'number' }
                                    }
                                },
                                responseMetrics: {
                                    type: 'array',
                                    items: { type: 'object' }
                                },
                                uptimePercent: { type: 'number' },
                                timestamp: { type: 'string' }
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
            const data = await HealthMonitoringService.getHealthMetrics();
            return sendSuccess(reply, data);
        } catch (error: any) {
            return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message || 'Failed to fetch health metrics');
        }
    });

    // GET /api/admin/health/summary
    fastify.get('/health/summary', {
        schema: {
            tags: ['admin-health'],
            summary: 'Get health summary with alert evaluation',
            security: [{ bearerAuth: [] }],
            querystring: {
                type: 'object',
                properties: {
                    cpuThreshold: { type: 'number' },
                    memoryThreshold: { type: 'number' },
                    diskThreshold: { type: 'number' },
                    errorRateThreshold: { type: 'number' },
                    responseTimeThreshold: { type: 'number' },
                    cacheHitRateThreshold: { type: 'number' }
                }
            },
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
                                    enum: ['healthy', 'degraded', 'unhealthy']
                                },
                                alerts: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            type: { type: 'string' },
                                            value: { type: 'number' },
                                            threshold: { type: 'number' },
                                            severity: {
                                                type: 'string',
                                                enum: ['warning', 'critical']
                                            },
                                            message: { type: 'string' },
                                            triggeredAt: { type: 'string' }
                                        }
                                    }
                                },
                                uptime: { type: 'number' },
                                stats: {
                                    type: 'object',
                                    properties: {
                                        cpuUsage: { type: 'number' },
                                        memoryUsage: { type: 'number' },
                                        diskUsage: { type: 'number' },
                                        errorRate: { type: 'number' },
                                        avgResponseTime: { type: 'number' },
                                        cacheHitRate: { type: 'number' }
                                    }
                                },
                                timestamp: { type: 'string' }
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
            const query = request.query as Partial<AlertThresholds>;

            // Build thresholds from query params or use defaults
            const thresholds: AlertThresholds = {
                cpuThreshold: query.cpuThreshold ?? DEFAULT_ALERT_THRESHOLDS.cpuThreshold,
                memoryThreshold: query.memoryThreshold ?? DEFAULT_ALERT_THRESHOLDS.memoryThreshold,
                diskThreshold: query.diskThreshold ?? DEFAULT_ALERT_THRESHOLDS.diskThreshold,
                errorRateThreshold: query.errorRateThreshold ?? DEFAULT_ALERT_THRESHOLDS.errorRateThreshold,
                responseTimeThreshold: query.responseTimeThreshold ?? DEFAULT_ALERT_THRESHOLDS.responseTimeThreshold,
                cacheHitRateThreshold: query.cacheHitRateThreshold ?? DEFAULT_ALERT_THRESHOLDS.cacheHitRateThreshold,
            };

            const data = await HealthMonitoringService.getHealthSummary(thresholds);
            return sendSuccess(reply, data);
        } catch (error: any) {
            return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message || 'Failed to fetch health summary');
        }
    });
}
