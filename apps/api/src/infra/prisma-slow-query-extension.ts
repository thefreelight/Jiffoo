/**
 * Prisma Slow Query Extension (R5.5)
 *
 * Uses Prisma client extension to measure query duration.
 * Queries exceeding SLOW_QUERY_MS (default 500ms) are logged as structured warnings.
 *
 * Rate limiting: same model logs at most 10 per minute to prevent log flooding.
 */

import { Prisma } from '@prisma/client';
import { winstonLogger } from '@/core/logger/unified-logger';

const SLOW_QUERY_MS = parseInt(process.env.SLOW_QUERY_MS || '500', 10);
const MAX_LOGS_PER_MINUTE = 10;

// Rate limiter: model → timestamps of recent logs
const recentLogs = new Map<string, number[]>();

/**
 * Check if we should log a slow query for this model (rate limited).
 */
function shouldLog(model: string): boolean {
  const now = Date.now();
  const cutoff = now - 60_000; // 1 minute ago

  const recent = (recentLogs.get(model) || []).filter((t) => t > cutoff);
  if (recent.length >= MAX_LOGS_PER_MINUTE) {
    return false;
  }
  recent.push(now);
  recentLogs.set(model, recent);
  return true;
}

/**
 * Periodically clean up old entries to prevent memory leak.
 */
setInterval(() => {
  const cutoff = Date.now() - 60_000;
  for (const [model, timestamps] of recentLogs) {
    const recent = timestamps.filter((t) => t > cutoff);
    if (recent.length === 0) {
      recentLogs.delete(model);
    } else {
      recentLogs.set(model, recent);
    }
  }
}, 60_000).unref();

/**
 * Prisma client extension that measures query duration and logs slow queries.
 *
 * Usage:
 *   const prisma = new PrismaClient().$extends(slowQueryExtension);
 */
export const slowQueryExtension = Prisma.defineExtension((client) => {
  return client.$extends({
    query: {
      async $allOperations({ args, operation, model, query }) {
        const startTime = Date.now();
        const modelName = model || 'unknown';

        try {
          const result = await query(args);
          const durationMs = Date.now() - startTime;

          if (durationMs >= SLOW_QUERY_MS) {
            if (shouldLog(modelName)) {
              winstonLogger.warn('Slow query detected', {
                component: 'SlowQueryExtension',
                model: modelName,
                operation,
                durationMs,
                thresholdMs: SLOW_QUERY_MS,
              });
            }
          }

          return result;
        } catch (error) {
          const durationMs = Date.now() - startTime;

          // Log slow queries that also failed
          if (durationMs >= SLOW_QUERY_MS && shouldLog(modelName)) {
            winstonLogger.warn('Slow query failed', {
              component: 'SlowQueryExtension',
              model: modelName,
              operation,
              durationMs,
              thresholdMs: SLOW_QUERY_MS,
              error: error instanceof Error ? error.message : String(error),
            });
          }

          throw error;
        }
      },
    },
  });
});
