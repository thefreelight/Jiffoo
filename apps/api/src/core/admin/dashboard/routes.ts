import { sendMappedError } from '@/utils/api-errors';
/**
 * Admin Dashboard Routes
 */

import { FastifyInstance } from 'fastify';
import { AdminDashboardService } from './service';
import { sendSuccess, sendError } from '@/utils/response';
import { adminDashboardSchemas } from './schemas';
import { sendKnownError } from '@/utils/api-errors';

export async function adminDashboardRoutes(fastify: FastifyInstance) {
    // Apply auth hooks

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
        } catch (error) { return sendMappedError(reply, error); }
    });
}
