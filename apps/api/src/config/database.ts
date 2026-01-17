import { PrismaClient } from '@prisma/client';
import { env } from './env';

/**
 * Base Prisma Client
 * Configured with environment-specific logging
 */
const prisma = new PrismaClient({
  log: env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

export { prisma };

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
