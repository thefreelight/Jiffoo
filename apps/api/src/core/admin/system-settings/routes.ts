/**
 * System Settings Routes
 * API endpoints for managing platform settings
 */
import { FastifyPluginAsync } from 'fastify';
import { authMiddleware, requireAdmin } from '@/core/auth/middleware';
import { systemSettingsService } from './service';

const systemSettingsRoutes: FastifyPluginAsync = async (fastify) => {
    // Require Admin for all system settings routes
    fastify.addHook('onRequest', authMiddleware);
    fastify.addHook('onRequest', requireAdmin);

    // Get all settings
    fastify.get('/settings', async (request, reply) => {
        try {
            const settings = await systemSettingsService.getAllSettings();
            return reply.send({
                success: true,
                data: settings,
            });
        } catch (error) {
            return reply.status(500).send({
                success: false,
                error: 'Failed to fetch settings',
            });
        }
    });

    // Get settings by category
    fastify.get('/settings/category/:category', async (request, reply) => {
        const { category } = request.params as { category: string };

        try {
            const settings = await systemSettingsService.getSettingsByCategory(category);
            return reply.send({
                success: true,
                data: settings,
            });
        } catch (error) {
            return reply.status(500).send({
                success: false,
                error: 'Failed to fetch settings',
            });
        }
    });

    // Get single setting
    fastify.get('/settings/:key', async (request, reply) => {
        const { key } = request.params as { key: string };

        try {
            const setting = await systemSettingsService.getSettingFull(key);

            if (!setting) {
                return reply.status(404).send({
                    success: false,
                    error: 'Setting not found',
                });
            }

            return reply.send({
                success: true,
                data: setting,
            });
        } catch (error) {
            return reply.status(500).send({
                success: false,
                error: 'Failed to fetch setting',
            });
        }
    });

    // Update single setting
    fastify.put('/settings/:key', async (request, reply) => {
        const { key } = request.params as { key: string };
        const { value } = request.body as { value: any };

        try {
            await systemSettingsService.setSetting(key, value);
            const setting = await systemSettingsService.getSettingFull(key);
            return reply.send({
                success: true,
                data: setting,
                message: 'Setting updated successfully',
            });
        } catch (error: any) {
            return reply.status(400).send({
                success: false,
                error: error.message || 'Failed to update setting',
            });
        }
    });

    // Batch update settings
    fastify.put('/settings/batch', async (request, reply) => {
        const { settings } = request.body as { settings: Record<string, any> };

        if (!settings || typeof settings !== 'object') {
            return reply.status(400).send({
                success: false,
                error: 'Invalid settings object',
            });
        }

        try {
            const updated = await systemSettingsService.batchUpdate(settings);
            return reply.send({
                success: true,
                data: updated,
                message: `${updated.length} settings updated`,
            });
        } catch (error: any) {
            return reply.status(400).send({
                success: false,
                error: error.message || 'Failed to update settings',
            });
        }
    });

    // Reset setting to default
    fastify.post('/settings/:key/reset', async (request, reply) => {
        const { key } = request.params as { key: string };

        try {
            const setting = await systemSettingsService.resetSetting(key);

            return reply.send({
                success: true,
                data: setting,
                message: 'Setting reset to default',
            });
        } catch (error) {
            return reply.status(500).send({
                success: false,
                error: 'Failed to reset setting',
            });
        }
    });

    // Reset all settings
    fastify.post('/settings/reset-all', async (request, reply) => {
        try {
            await systemSettingsService.resetAllSettings();
            return reply.send({
                success: true,
                message: 'All settings reset to defaults',
            });
        } catch (error) {
            return reply.status(500).send({
                success: false,
                error: 'Failed to reset settings',
            });
        }
    });

    // Export settings
    fastify.get('/settings/export', async (request, reply) => {
        try {
            const data = await systemSettingsService.exportSettings();
            return reply.send({
                success: true,
                data,
            });
        } catch (error) {
            return reply.status(500).send({
                success: false,
                error: 'Failed to export settings',
            });
        }
    });

    // Import settings
    fastify.post('/settings/import', async (request, reply) => {
        const { data } = request.body as { data: Record<string, any> };

        if (!data || typeof data !== 'object') {
            return reply.status(400).send({
                success: false,
                error: 'Invalid import data',
            });
        }

        try {
            const count = await systemSettingsService.importSettings(data);
            return reply.send({
                success: true,
                message: `${count} settings imported`,
            });
        } catch (error) {
            return reply.status(500).send({
                success: false,
                error: 'Failed to import settings',
            });
        }
    });
};

export default systemSettingsRoutes;
