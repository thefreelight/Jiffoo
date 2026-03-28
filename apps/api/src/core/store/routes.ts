/**
 * Store Public Routes
 * Provides store context and global configuration for Shop frontend
 */

import { createHash } from 'crypto';
import { FastifyInstance, FastifyReply } from 'fastify';
import { systemSettingsService } from '@/core/admin/system-settings/service';
import { ThemeManagementService } from '@/core/admin/theme-management/service';
import { managedPackageService } from '@/core/admin/managed-package/service';
import { sendSuccess, sendError } from '@/utils/response';
import { createTypedReadResponses } from '@/types/common-dto';
import { CacheService } from '@/core/cache/service';
import { storeContextMiddleware } from '@/middleware/store-context';

function setHttpCache(reply: FastifyReply, data: any, maxAge: number, swr: number) {
  const etag = `"${createHash('md5').update(JSON.stringify(data)).digest('hex')}"`;
  reply.header('Cache-Control', `public, max-age=${maxAge}, stale-while-revalidate=${swr}`);
  reply.header('ETag', etag);
  return etag;
}

const storeContextSchema = {
    type: 'object',
    properties: {
        storeId: { type: 'string' },
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
        'storeId',
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
        preHandler: storeContextMiddleware,
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
            // Read-through cache for store context
            const storeCtxVersion = await CacheService.getStoreContextVersion();
            const cacheKey = `pub:store:context:v${storeCtxVersion}`;
            const cached = await CacheService.get<any>(cacheKey);
            if (cached) {
                const etag = setHttpCache(reply, cached, 60, 120);
                if (request.headers['if-none-match'] === etag) {
                    return reply.code(304).send();
                }
                return sendSuccess(reply, cached);
            }

            // Parallel fetch settings and theme
            const [platformName, activeTheme, currency, logo, defaultLocale, managedStatus] = await Promise.all([
                systemSettingsService.getString('branding.platform_name', 'Jiffoo Store'),
                ThemeManagementService.getActiveTheme('shop'),
                systemSettingsService.getShopCurrency(),
                systemSettingsService.getString('branding.logo', null),
                systemSettingsService.getShopLocale(),
                managedPackageService.getStatus().catch(() => ({ mode: 'oss' as const, package: null })),
            ]);

            const contextData = {
                storeId: '1', // Single merchant version
                storeName: platformName as string,
                logo: logo as string | null,
                domain: null, // Single merchant version
                platformBranding: {
                    mode: managedStatus.mode,
                    showPoweredByJiffoo: managedStatus.mode !== 'managed',
                    poweredByHref: managedStatus.mode === 'managed' ? null : 'https://jiffoo.com',
                    poweredByLabel: 'Jiffoo',
                },
                status: 'active',
                currency,
                defaultLocale,
                supportedLocales: ['en', 'zh-Hant'], // Alpha Gate: Only En + zh-Hant
                theme: activeTheme, // Includes slug & config
                settings: null, // Reserved for future use
            };

            await CacheService.set(cacheKey, contextData, { ttl: 60 });
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
