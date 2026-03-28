/**
 * Mall Public Routes
 * Provides store context and global configuration for Shop/Admin frontend
 */

import { FastifyInstance } from 'fastify';
import { systemSettingsService } from '@/core/admin/system-settings/service';
import { ThemeManagementService } from '@/core/admin/theme-management/service';
import { managedPackageService } from '@/core/admin/managed-package/service';
import { sendSuccess, sendError } from '@/utils/response';
import { errorResponseSchema } from '@/utils/schema-helpers';

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
                                platformBranding: {
                                    type: 'object',
                                    properties: {
                                        mode: { type: 'string', enum: ['oss', 'managed'] },
                                        showPoweredByJiffoo: { type: 'boolean' },
                                        poweredByHref: { type: ['string', 'null'] },
                                        poweredByLabel: { type: 'string' }
                                    }
                                },
                                theme: {
                                    type: 'object',
                                    additionalProperties: true
                                },
                                defaultLocale: { type: 'string' },
                                supportedLocales: {
                                    type: 'array',
                                    items: { type: 'string' }
                                },
                                currency: { type: 'string' },
                                checkout: {
                                    type: 'object',
                                    properties: {
                                        countriesRequireStatePostal: {
                                            type: 'array',
                                            items: { type: 'string' }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                500: errorResponseSchema,
            }
        }
    }, async (_request, reply) => {
        try {
            // Parallel fetch settings and theme
            const [platformName, activeTheme, currency, defaultLocale, countriesRequireStatePostal, managedStatus] = await Promise.all([
                systemSettingsService.getString('branding.platform_name', 'Jiffoo Mall'),
                ThemeManagementService.getActiveTheme(),
                systemSettingsService.getShopCurrency(),
                systemSettingsService.getShopLocale(),
                systemSettingsService.getCheckoutCountriesRequireStatePostal(),
                managedPackageService.getStatus().catch(() => ({ mode: 'oss' as const, package: null })),
            ]);

            return sendSuccess(reply, {
                storeName: platformName as string,
                platformBranding: {
                    mode: managedStatus.mode,
                    showPoweredByJiffoo: managedStatus.mode !== 'managed',
                    poweredByHref: managedStatus.mode === 'managed' ? null : 'https://jiffoo.com',
                    poweredByLabel: 'Jiffoo',
                },
                theme: activeTheme, // Includes slug & config
                defaultLocale,
                supportedLocales: ['en', 'zh-Hant'], // Alpha Gate: Only En + SC
                currency,
                checkout: {
                    countriesRequireStatePostal,
                },
            });
        } catch (error: any) {
            return sendError(reply, 500, 'CONTEXT_FETCH_FAILED', error.message);
        }
    });
}
