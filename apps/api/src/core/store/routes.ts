import { sendMappedError } from '@/utils/api-errors';
/**
 * Store Public Routes
 * Provides store context and global configuration for Shop frontend
 */

import { createHash } from 'crypto';
import { FastifyInstance, FastifyReply } from 'fastify';
import { systemSettingsService } from '@/core/settings/service';
import { sendSuccess, sendError } from '@/utils/response';
import { createTypedReadResponses } from '@/types/common-dto';
import { STORE_SUPPORTED_LOCALES } from './localization';
import { sendKnownError } from '@/utils/api-errors';

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
        timezone: { type: 'string' },
        checkoutCountriesRequireStatePostal: {
            type: 'array',
            items: { type: 'string', pattern: '^[A-Z]{2}$' },
            description: 'Countries requiring both state/province and postal code at checkout',
        },
        defaultLocale: { type: 'string' },
        supportedLocales: {
            type: 'array',
            items: { type: 'string' }
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
        'timezone',
        'defaultLocale',
        'supportedLocales',
        'settings'
    ],
    additionalProperties: false,
} as const;

export async function storeRoutes(fastify: FastifyInstance) {
    fastify.get('/context', {
        schema: {
            tags: ['store'],
            summary: 'Get store context (locale and settings)',
            response: {
              304: { type: 'null' },
              ...(createTypedReadResponses(storeContextSchema) as any),
            },
        }
    }, async (request, reply) => {
        try {
            const [platformName, currency, logo, defaultLocale, timezone, checkoutCountriesRequireStatePostal] = await Promise.all([
                systemSettingsService.getString('branding.platform_name', 'Jiffoo Store'),
                systemSettingsService.getShopCurrency(),
                systemSettingsService.getString('branding.logo', null),
                systemSettingsService.getShopLocale(),
                systemSettingsService.getTimezone(),
                systemSettingsService.getCheckoutCountriesRequireStatePostal(),
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
                timezone,
                checkoutCountriesRequireStatePostal,
                defaultLocale,
                supportedLocales: STORE_SUPPORTED_LOCALES,
                settings: null, // Reserved for future use
            };

            const etag = setHttpCache(reply, contextData, 60, 120);
            if (request.headers['if-none-match'] === etag) {
                return reply.code(304).send();
            }
            return sendSuccess(reply, contextData);
        } catch (error) { return sendMappedError(reply, error); }
    });
}
