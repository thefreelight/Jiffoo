import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@/config/database';
import { CacheService } from '@/core/cache/service';
import { LoggerService } from '@/core/logger/unified-logger';
import { isMissingDatabaseObjectError } from '@/utils/prisma-errors';
import { sendError } from '@/utils/response';

/**
 * Store Context Middleware (Single Store)
 *
 * Loads the default store and attaches it to request.storeContext.
 * Multi-tenant routing (domain mapping, X-Store-Id) is available via plugin.
 */

const DEFAULT_STORE_ID = process.env.STORE_DEFAULT_ID || 'store-default';
const STORE_CACHE_TTL = 600; // 10 minutes
const STORE_SCHEMA_OBJECTS = ['stores'];
let hasLoggedMissingDefaultStore = false;
let hasLoggedMissingStoreSchema = false;

function logMissingDefaultStore(requestedStoreId: string) {
  if (hasLoggedMissingDefaultStore) return;
  hasLoggedMissingDefaultStore = true;

  LoggerService.log('warn', 'Default store record missing; continuing without store context', {
    context: 'storeContextMiddleware',
    requestedStoreId,
  });
}

function logMissingStoreSchema(requestedStoreId: string, error: unknown) {
  if (hasLoggedMissingStoreSchema) return;
  hasLoggedMissingStoreSchema = true;

  LoggerService.log('warn', 'Store schema unavailable; continuing without store context', {
    context: 'storeContextMiddleware',
    requestedStoreId,
    error: error instanceof Error ? error.message : String(error),
  });
}

function parseJsonValue<T>(value: unknown, fallback: T): T {
  if (!value) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

/**
 * Get store from cache or database
 */
async function getStoreById(storeId: string) {
  const cacheKey = `store:${storeId}`;

  const cached = await CacheService.get<any>(cacheKey);
  if (cached) return cached;

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: {
      id: true,
      name: true,
      slug: true,
      domain: true,
      status: true,
      currency: true,
      defaultLocale: true,
      supportedLocales: true,
      settings: true,
      logo: true,
      themeConfig: true,
    },
  });

  if (!store) return null;

  const storeData = {
    ...store,
    supportedLocales: parseJsonValue(store.supportedLocales, ['en']),
    settings: parseJsonValue(store.settings, null),
    themeConfig: parseJsonValue(store.themeConfig, null),
  };

  await CacheService.set(cacheKey, storeData, { ttl: STORE_CACHE_TTL });
  return storeData;
}

/**
 * Store context middleware - loads default store
 */
export async function storeContextMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const headerStoreId = request.headers['x-store-id'];
  const requestedStoreId =
    typeof headerStoreId === 'string' && headerStoreId.trim().length > 0
      ? headerStoreId.trim()
      : DEFAULT_STORE_ID;

  try {
    const store = await getStoreById(requestedStoreId);

    if (!store) {
      if (requestedStoreId === DEFAULT_STORE_ID) {
        logMissingDefaultStore(requestedStoreId);
        return;
      }

      return sendError(
        reply,
        500,
        'STORE_CONFIG_ERROR',
        requestedStoreId === DEFAULT_STORE_ID
          ? 'Default store not found. Run database seed first.'
          : `Store ${requestedStoreId} not found.`
      );
    }

    if (store.status !== 'active' && store.status !== 'maintenance') {
      return sendError(
        reply,
        503,
        'STORE_UNAVAILABLE',
        'This store is currently unavailable'
      );
    }

    request.storeContext = store;
  } catch (error: any) {
    if (
      requestedStoreId === DEFAULT_STORE_ID &&
      isMissingDatabaseObjectError(error, STORE_SCHEMA_OBJECTS)
    ) {
      logMissingStoreSchema(requestedStoreId, error);
      return;
    }

    return sendError(
      reply,
      500,
      'INTERNAL_SERVER_ERROR',
      'Failed to resolve store context'
    );
  }
}
