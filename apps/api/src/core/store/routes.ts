/**
 * Store Public Routes
 * Provides store context and global configuration for Shop frontend
 */

import { createHash } from 'crypto';
import { FastifyInstance, FastifyReply } from 'fastify';
import { systemSettingsService } from '@/core/admin/system-settings/service';
import { ThemeManagementService } from '@/core/admin/theme-management/service';
import { sendSuccess, sendError } from '@/utils/response';
import { createTypedReadResponses } from '@/types/common-dto';
import { STORE_SUPPORTED_LOCALES } from './localization';

function setHttpCache(reply: FastifyReply, data: any, maxAge: number, swr: number) {
  const etag = `"${createHash('md5').update(JSON.stringify(data)).digest('hex')}"`;
  reply.header('Cache-Control', `public, max-age=${maxAge}, stale-while-revalidate=${swr}`);
  reply.header('ETag', etag);
  return etag;
}

const storeContextSchema = {
    type: 'object',
    properties: {
        storeName: { type: 'string' },
        logo: { type: ['string', 'null'] },
        domain: { type: ['string', 'null'] },
        platformBranding: {
            type: 'object',
            properties: {
                mode: { type: 'string', enum: ['oss', 'managed'] },
                showPoweredByJiffoo: { type: 'boolean' },
                poweredByHref: { type: ['string', 'null'] },
                poweredByLabel: { type: 'string' }
            },
            required: ['mode', 'showPoweredByJiffoo', 'poweredByHref', 'poweredByLabel'],
            additionalProperties: false
        },
        status: { type: 'string' },
        currency: { type: 'string' },
        defaultLocale: { type: 'string' },
        supportedLocales: {
            type: 'array',
            items: { type: 'string' }
        },
        theme: {
            type: ['object', 'null'],
            additionalProperties: true
        },
        settings: {
            type: ['object', 'null'],
            additionalProperties: true
        }
    },
    required: [
        'storeName',
        'logo',
        'domain',
        'platformBranding',
        'status',
        'currency',
        'defaultLocale',
        'supportedLocales',
        'theme',
        'settings'
    ],
    additionalProperties: false,
} as const;

export async function storeRoutes(fastify: FastifyInstance) {
    fastify.get('/context', {
        schema: {
            tags: ['store'],
            summary: 'Get store context (theme, locale, settings)',
            response: {
              304: { type: 'null' },
              ...(createTypedReadResponses(storeContextSchema) as any),
            },
        }
    }, async (request, reply) => {
        try {
            // Parallel fetch settings and theme
            const [platformName, activeTheme, currency, logo, defaultLocale] = await Promise.all([
                systemSettingsService.getString('branding.platform_name', 'Jiffoo Store'),
                ThemeManagementService.getActiveTheme('shop'),
                systemSettingsService.getShopCurrency(),
                systemSettingsService.getString('branding.logo', null),
                systemSettingsService.getShopLocale(),
            ]);

            const contextData = {
                storeName: platformName as string,
                logo: logo as string | null,
                domain: null, // Single merchant version
                platformBranding: {
                    mode: 'oss',
                    showPoweredByJiffoo: true,
                    poweredByHref: 'https://jiffoo.com',
                    poweredByLabel: 'Jiffoo',
                },
                status: 'active',
                currency,
                defaultLocale,
                supportedLocales: STORE_SUPPORTED_LOCALES,
                theme: activeTheme, // Includes slug & config
                settings: null, // Reserved for future use
            };

            const etag = setHttpCache(reply, contextData, 60, 120);
            if (request.headers['if-none-match'] === etag) {
                return reply.code(304).send();
            }
            return sendSuccess(reply, contextData);
        } catch (error: any) {
            return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
        }
    });
}
