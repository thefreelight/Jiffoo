import type { FastifyPluginAsync } from 'fastify';
import { authMiddleware, requireAdmin } from '@/core/auth/middleware';
import { systemSettingsService } from '@/core/admin/system-settings/service';
import { sendError, sendSuccess } from '@/utils/response';
import { LOCALES, isSupportedLocale } from '@jiffoo/shared';
import { STORE_SUPPORTED_LOCALES } from '@/core/store/localization';

type LocalizationBody = { defaultLocale?: string; supportedLocales?: unknown };

function normalize(supportedLocales: unknown, defaultLocale: string): string[] {
  const values = Array.isArray(supportedLocales) ? supportedLocales : [defaultLocale];
  const locales = Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
  if (!locales.includes(defaultLocale)) locales.unshift(defaultLocale);
  return locales;
}

function validate(defaultLocale: string, supportedLocales: string[]): string | null {
  if (!isSupportedLocale(defaultLocale)) return `Unsupported default locale "${defaultLocale}". Supported locales: ${LOCALES.join(', ')}`;
  if (supportedLocales.length === 0 || supportedLocales.some((locale) => !isSupportedLocale(locale))) return 'supportedLocales contains an unsupported locale';
  return null;
}

export const adminStoreManagementRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', authMiddleware);
  fastify.addHook('onRequest', requireAdmin);

  fastify.get('/default/localization', async (_request, reply) => {
    try {
      const defaultLocale = await systemSettingsService.getShopLocale();
      const supportedLocales = STORE_SUPPORTED_LOCALES;
      return sendSuccess(reply, { defaultLocale, supportedLocales, availableLocales: LOCALES });
    } catch {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to fetch store localization');
    }
  });

  fastify.put('/default/localization', async (request, reply) => {
    const body = (request.body || {}) as LocalizationBody;
    const defaultLocale = String(body.defaultLocale || 'en').trim();
    const supportedLocales = normalize(body.supportedLocales, defaultLocale);
    const error = validate(defaultLocale, supportedLocales);
    if (error) return sendError(reply, 400, 'VALIDATION_ERROR', error);
    try {
      await systemSettingsService.setSetting('localization.locale', defaultLocale);
      return sendSuccess(reply, { defaultLocale, supportedLocales, availableLocales: LOCALES });
    } catch {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to update store localization');
    }
  });
};
