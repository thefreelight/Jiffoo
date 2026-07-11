/**
 * Redis client for syncing translations to the shared cache.
 *
 * Core API reads from these keys via TranslationService.
 * Key patterns:
 *   i18n:c:{entityType}:{entityId}:{locale}  -> content translations
 *   i18n:ui:{locale}:{namespace}             -> UI text translations
 *   i18n:locales                             -> available locales JSON array
 */

import Redis from 'ioredis';

const CONTENT_KEY_PREFIX = 'i18n:c';
const UI_KEY_PREFIX = 'i18n:ui';
const LOCALES_KEY = 'i18n:locales';

/** Content translation TTL: 24 hours (plugin refreshes on write) */
const CONTENT_TTL = 86400;
/** UI translation TTL: 24 hours */
const UI_TTL = 86400;

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 1000, 10000),
      lazyConnect: true,
    });
  }
  return redis;
}

// ============================================================================
// Content Translation Sync
// ============================================================================

/**
 * Sync all translations for a single entity+locale to Redis.
 * Core API reads: GET i18n:c:{entityType}:{entityId}:{locale}
 * Value: JSON { "name": "...", "description": "..." }
 */
export async function syncContentToRedis(
  entityType: string,
  entityId: string,
  locale: string,
  fields: Record<string, string>
): Promise<void> {
  try {
    const key = `${CONTENT_KEY_PREFIX}:${entityType}:${entityId}:${locale}`;
    const r = getRedis();

    if (Object.keys(fields).length === 0) {
      await r.del(key);
      return;
    }

    await r.set(key, JSON.stringify(fields), 'EX', CONTENT_TTL);
  } catch (err) {
    console.warn('[i18n] Redis sync failed (content):', err instanceof Error ? err.message : err);
  }
}

/**
 * Remove all Redis content translation keys for an entity.
 */
export async function removeContentFromRedis(
  entityType: string,
  entityId: string,
  locale?: string
): Promise<void> {
  try {
    const r = getRedis();
    if (locale) {
      await r.del(`${CONTENT_KEY_PREFIX}:${entityType}:${entityId}:${locale}`);
    } else {
      const pattern = `${CONTENT_KEY_PREFIX}:${entityType}:${entityId}:*`;
      const keys = await scanKeys(r, pattern);
      if (keys.length > 0) {
        await r.del(...keys);
      }
    }
  } catch (err) {
    console.warn('[i18n] Redis remove failed (content):', err instanceof Error ? err.message : err);
  }
}

// ============================================================================
// UI Translation Sync
// ============================================================================

/**
 * Sync all UI translations for a locale+namespace to Redis.
 * Frontend reads via plugin API, which reads from Redis.
 */
export async function syncUIToRedis(
  locale: string,
  namespace: string,
  messages: Record<string, string>
): Promise<void> {
  try {
    const key = `${UI_KEY_PREFIX}:${locale}:${namespace}`;
    const r = getRedis();

    if (Object.keys(messages).length === 0) {
      await r.del(key);
      return;
    }

    await r.set(key, JSON.stringify(messages), 'EX', UI_TTL);
  } catch (err) {
    console.warn('[i18n] Redis sync failed (ui):', err instanceof Error ? err.message : err);
  }
}

/**
 * Read UI translations from Redis.
 */
export async function getUIFromRedis(
  locale: string,
  namespace: string
): Promise<Record<string, string> | null> {
  const r = getRedis();
  const raw = await r.get(`${UI_KEY_PREFIX}:${locale}:${namespace}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ============================================================================
// Available Locales
// ============================================================================

/**
 * Sync the list of enabled locales to Redis.
 * Core API and frontend can check this to know which locales exist.
 */
export async function syncLocalesToRedis(locales: string[]): Promise<void> {
  try {
    const r = getRedis();
    await r.set(LOCALES_KEY, JSON.stringify(locales), 'EX', CONTENT_TTL);
  } catch (err) {
    console.warn('[i18n] Redis sync failed (locales):', err instanceof Error ? err.message : err);
  }
}

// ============================================================================
// Helpers
// ============================================================================

async function scanKeys(r: Redis, pattern: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor = '0';
  do {
    const [nextCursor, batch] = await r.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
    cursor = nextCursor;
    keys.push(...batch);
  } while (cursor !== '0');
  return keys;
}

export async function connectRedis(): Promise<void> {
  try {
    const r = getRedis();
    await r.ping();
  } catch {
    console.warn('[i18n] Redis not available, translations will not be cached');
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redis) {
    try {
      await redis.quit();
    } catch {
      // Ignore errors during disconnect
    }
    redis = null;
  }
}
