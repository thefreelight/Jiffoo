/**
 * System Settings Routes
 * API endpoints for managing platform settings
 */
import { FastifyPluginAsync } from 'fastify';
import { authMiddleware, requireAdmin } from '@/core/auth/middleware';
import { systemSettingsService } from './service';
import { sendSuccess, sendError } from '@/utils/response';
import { adminSettingsSchemas } from './schemas';

const systemSettingsRoutes: FastifyPluginAsync = async (fastify) => {
    // Require Admin for all system settings routes
    fastify.addHook('onRequest', authMiddleware);
    fastify.addHook('onRequest', requireAdmin);

    // Get all settings
    fastify.get('/settings', {
        schema: {
            tags: ['admin-settings'],
            summary: 'Get all settings',
            description: 'Get all system settings (admin only)',
            security: [{ bearerAuth: [] }],
            ...adminSettingsSchemas.getSettings,
        }
    }, async (request, reply) => {
        try {
            const settings = await systemSettingsService.getAllSettings();
            return sendSuccess(reply, settings);
        } catch (error: any) {
            return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message || 'Failed to fetch settings');
        }
    });

    // Batch update settings
    fastify.put('/settings/batch', {
        schema: {
            tags: ['admin-settings'],
            summary: 'Batch update settings',
            description: 'Update multiple settings at once (admin only)',
            security: [{ bearerAuth: [] }],
            ...adminSettingsSchemas.batchUpdateSettings,
        }
    }, async (request, reply) => {
        const { settings } = request.body as { settings: Record<string, any> };

        if (!settings || typeof settings !== 'object') {
            return sendError(reply, 400, 'BAD_REQUEST', 'Invalid settings object');
        }

        try {
            const updated = await systemSettingsService.batchUpdate(settings);
            return sendSuccess(reply, updated, `${Object.keys(updated).length} settings updated`);
        } catch (error: any) {
            return sendError(reply, 400, 'BAD_REQUEST', error.message || 'Failed to update settings');
        }
    });
};

export default systemSettingsRoutes;
