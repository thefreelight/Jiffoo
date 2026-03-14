/**
 * Admin Dashboard Routes
 */

import { FastifyInstance } from 'fastify';
import { AdminDashboardService } from './service';
import { authMiddleware, requireAdmin } from '@/core/auth/middleware';
import { sendSuccess, sendError } from '@/utils/response';
import { adminDashboardSchemas } from './schemas';

export async function adminDashboardRoutes(fastify: FastifyInstance) {
    // Apply auth hooks
    fastify.addHook('onRequest', authMiddleware);
    fastify.addHook('onRequest', requireAdmin);

    // GET /api/admin/dashboard/multi-store-stats
    fastify.get('/dashboard/multi-store-stats', {
        schema: {
            tags: ['admin-dashboard'],
            summary: 'Get consolidated stats across all stores',
            security: [{ bearerAuth: [] }],
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'object',
                            properties: {
                                totals: {
                                    type: 'object',
                                    properties: {
                                        totalStores: { type: 'number' },
                                        totalRevenue: { type: 'number' },
                                        totalOrders: { type: 'number' },
                                        totalProducts: { type: 'number' }
                                    }
                                },
                                stores: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            storeId: { type: 'string' },
                                            storeName: { type: 'string' },
                                            storeSlug: { type: 'string' },
                                            currency: { type: 'string' },
                                            status: { type: 'string' },
                                            totalRevenue: { type: 'number' },
                                            totalOrders: { type: 'number' },
                                            totalProducts: { type: 'number' }
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
            const data = await AdminDashboardService.getMultiStoreStats();
            return sendSuccess(reply, data);
        } catch (error: any) {
            return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message || 'Failed to fetch multi-store stats');
        }
    });

    // GET /api/admin/dashboard
    fastify.get('/dashboard', {
        schema: {
            tags: ['admin-dashboard'],
            summary: 'Get admin dashboard aggregated data',
            description: 'Get aggregated metrics, order stats, and recent orders for admin dashboard',
            security: [{ bearerAuth: [] }],
            ...adminDashboardSchemas.getDashboard,
        }
    }, async (request, reply) => {
        try {
            const { include } = request.query as any;
            const includeArray = include ? include.split(',') : [];
            const data = await AdminDashboardService.getDashboardMetrics(includeArray);
            return sendSuccess(reply, data);
        } catch (error: any) {
            return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message || 'Failed to fetch dashboard data');
        }
    });
}
