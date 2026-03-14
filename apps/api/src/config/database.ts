import { PrismaClient } from '@prisma/client';
import { env } from './env';
import { QueryAnalyzer } from '@/core/performance/query-analyzer';

/**
 * Base Prisma Client
 * Configured with environment-specific logging
 */
const prisma = new PrismaClient({
  log:
    env.NODE_ENV === 'development'
      ? env.PRISMA_LOG_QUERY
        ? ['query', 'info', 'warn', 'error']
        : ['info', 'warn', 'error']
      : ['error'],
});

console.log('[DatabaseConfig] Prisma client created:', !!prisma);


// Note: Prisma v5+ removed $use middleware. Query analyzer middleware is disabled.
// To re-enable, use prisma.$extends() or Prisma client extensions.
// prisma.$use(QueryAnalyzer.createPrismaMiddleware());

// Enable query analyzer in development and production
if (env.NODE_ENV === 'development' || env.NODE_ENV === 'production') {
  QueryAnalyzer.enable();
}

export { prisma, QueryAnalyzer };

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
