/**
 * Mall Public Routes
 * Provides store context and global configuration for Shop/Admin frontend
 */

import { FastifyInstance } from 'fastify';
import { systemSettingsService } from '@/core/admin/system-settings/service';
import { ThemeManagementService } from '@/core/admin/theme-management/service';

export async function mallRoutes(fastify: FastifyInstance) {
    fastify.get('/context', {
        schema: {
            tags: ['mall'],
            summary: 'Get store context (theme, locale, settings)',
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'object',
                            properties: {
                                storeName: { type: 'string' },
                                theme: {
                                    type: 'object',
                                    additionalProperties: true
                                },
                                defaultLocale: { type: 'string' },
                                supportedLocales: {
                                    type: 'array',
                                    items: { type: 'string' }
                                },
                                currency: { type: 'string' }
                            }
                        }
                    }
                },
                500: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        error: { type: 'string' }
                    }
                }
            }
        }
    }, async (_request, reply) => {
        try {
            // Parallel fetch settings and theme
            const [platformName, activeTheme, currency] = await Promise.all([
                systemSettingsService.getString('branding.platform_name', 'Jiffoo Mall'),
                ThemeManagementService.getActiveTheme(),
                systemSettingsService.getString('general.currency', 'USD'),
            ]);

            return reply.send({
                success: true,
                data: {
                    storeName: platformName as string,
                    theme: activeTheme, // Includes slug & config
                    defaultLocale: 'zh-Hant', // Alpha Gate: Must be zh-Hant default
                    supportedLocales: ['en', 'zh-Hant'], // Alpha Gate: Only En + SC
                    currency: currency as string,
                }
            });
        } catch (error: any) {
            return reply.status(500).send({ success: false, error: error.message });
        }
    });
}
