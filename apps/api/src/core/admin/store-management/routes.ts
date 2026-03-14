import type { FastifyPluginAsync } from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '@/config/database';
import { authMiddleware, requireAdmin } from '@/core/auth/middleware';
import { sendError, sendSuccess } from '@/utils/response';
import { LOCALES, isSupportedLocale } from '@jiffoo/shared';

type CreateStoreBody = {
  name?: string;
  slug?: string;
  domain?: string;
  status?: string;
  currency?: string;
  defaultLocale?: string;
  supportedLocales?: unknown;
};

const isUniqueConstraintError = (error: unknown): error is Prisma.PrismaClientKnownRequestError =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

type UpdateDefaultStoreLocalizationBody = {
  defaultLocale?: string;
  supportedLocales?: unknown;
};

function normalizeSupportedLocales(
  supportedLocales: unknown,
  defaultLocale: string
): string[] {
  const values = Array.isArray(supportedLocales)
    ? supportedLocales
    : [defaultLocale];

  const normalized = values
    .map((value) => String(value || '').trim())
    .filter((value) => value.length > 0);

  const deduped = Array.from(new Set(normalized));
  if (!deduped.includes(defaultLocale)) {
    deduped.unshift(defaultLocale);
  }

  return deduped;
}

function validateLocales(defaultLocale: string, supportedLocales: string[]): string | null {
  if (!isSupportedLocale(defaultLocale)) {
    return `Unsupported default locale "${defaultLocale}". Supported locales: ${LOCALES.join(', ')}`;
  }

  if (supportedLocales.length === 0) {
    return 'supportedLocales must include at least one locale';
  }

  for (const locale of supportedLocales) {
    if (!isSupportedLocale(locale)) {
      return `Unsupported locale "${locale}". Supported locales: ${LOCALES.join(', ')}`;
    }
  }

  if (!supportedLocales.includes(defaultLocale)) {
    return `supportedLocales must include the default locale "${defaultLocale}"`;
  }

  return null;
}

async function getDefaultStore() {
  return prisma.store.findFirst({
    orderBy: { createdAt: 'asc' },
  });
}

export const adminStoreManagementRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', authMiddleware);
  fastify.addHook('onRequest', requireAdmin);

  fastify.post('/', async (request, reply) => {
    const body = (request.body || {}) as CreateStoreBody;
    const name = String(body.name || '').trim();
    const slug = String(body.slug || '').trim().toLowerCase();
    const domain = body.domain ? String(body.domain).trim() : null;
    const status = String(body.status || 'active').trim().toLowerCase();
    const currency = String(body.currency || 'USD').trim().toUpperCase();
    const defaultLocale = String(body.defaultLocale || 'en').trim();
    const supportedLocales = normalizeSupportedLocales(body.supportedLocales, defaultLocale);

    if (!name) {
      return sendError(reply, 400, 'VALIDATION_ERROR', 'Store name is required');
    }
    if (!slug) {
      return sendError(reply, 400, 'VALIDATION_ERROR', 'Store slug is required');
    }

    const localizationError = validateLocales(defaultLocale, supportedLocales);
    if (localizationError) {
      return sendError(reply, 400, 'VALIDATION_ERROR', localizationError);
    }

    try {
      const store = await prisma.store.create({
        data: {
          name,
          slug,
          domain,
          status,
          currency,
          defaultLocale,
          supportedLocales,
        },
      });

      return sendSuccess(reply, store, undefined, 201);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return sendError(reply, 409, 'CONFLICT', 'Store slug or domain already exists');
      }
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to create store');
    }
  });

  fastify.get('/', async (_request, reply) => {
    try {
      const stores = await prisma.store.findMany({
        orderBy: { createdAt: 'asc' },
      });
      return sendSuccess(reply, stores);
    } catch {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to fetch stores');
    }
  });

  fastify.get('/default/localization', async (_request, reply) => {
    try {
      const store = await getDefaultStore();
      if (!store) {
        return sendError(reply, 404, 'NOT_FOUND', 'Default store not found');
      }

      const supportedLocales = normalizeSupportedLocales(store.supportedLocales, store.defaultLocale);
      return sendSuccess(reply, {
        storeId: store.id,
        storeName: store.name,
        storeSlug: store.slug,
        defaultLocale: store.defaultLocale,
        supportedLocales,
        availableLocales: LOCALES,
      });
    } catch {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to fetch store localization');
    }
  });

  fastify.put('/default/localization', async (request, reply) => {
    const body = (request.body || {}) as UpdateDefaultStoreLocalizationBody;
    const defaultLocale = String(body.defaultLocale || 'en').trim();
    const supportedLocales = normalizeSupportedLocales(body.supportedLocales, defaultLocale);
    const validationError = validateLocales(defaultLocale, supportedLocales);

    if (validationError) {
      return sendError(reply, 400, 'VALIDATION_ERROR', validationError);
    }

    try {
      const store = await getDefaultStore();
      if (!store) {
        return sendError(reply, 404, 'NOT_FOUND', 'Default store not found');
      }

      const updated = await prisma.store.update({
        where: { id: store.id },
        data: {
          defaultLocale,
          supportedLocales,
        },
      });

      return sendSuccess(reply, {
        storeId: updated.id,
        storeName: updated.name,
        storeSlug: updated.slug,
        defaultLocale: updated.defaultLocale,
        supportedLocales: normalizeSupportedLocales(updated.supportedLocales, updated.defaultLocale),
        availableLocales: LOCALES,
      });
    } catch {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to update store localization');
    }
  });

  fastify.get('/:id/stats', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const store = await prisma.store.findUnique({
        where: { id },
        select: { id: true, name: true, slug: true, currency: true, status: true },
      });
      if (!store) {
        return sendError(reply, 404, 'NOT_FOUND', 'Store not found');
      }

      const [orders, products, revenueResult] = await Promise.all([
        prisma.order.count({ where: { storeId: id } }),
        prisma.product.count({ where: { storeId: id } }),
        prisma.order.aggregate({
          _sum: { totalAmount: true },
          where: {
            storeId: id,
            paymentStatus: 'PAID',
            status: { notIn: ['CANCELLED', 'REFUNDED'] },
          },
        }),
      ]);

      return sendSuccess(reply, {
        storeId: store.id,
        storeName: store.name,
        storeSlug: store.slug,
        currency: store.currency,
        status: store.status,
        orders,
        products,
        revenue: Number(revenueResult._sum.totalAmount || 0),
      });
    } catch {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to fetch store stats');
    }
  });
};
