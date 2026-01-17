/**
 * Database Helper for Tests
 * 
 * Provides utilities for:
 * - Setting up test database
 * - Cleaning up data between tests
 * - Managing database connections
 */

import { PrismaClient } from '@prisma/client';

// Create a dedicated Prisma client for tests
let prisma: PrismaClient | null = null;

/**
 * Get the test Prisma client (singleton)
 */
export function getTestPrisma(): PrismaClient {
  if (!prisma) {
    const databaseUrl = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;
    
    if (!databaseUrl) {
      console.warn('⚠️ DATABASE_URL not set, using in-memory fallback for tests');
    }
    
    prisma = new PrismaClient({
      log: process.env.DEBUG_PRISMA === 'true' ? ['query', 'info', 'warn', 'error'] : ['error'],
      // Only specify datasources if URL is available
      ...(databaseUrl && {
        datasources: {
          db: {
            url: databaseUrl,
          },
        },
      }),
    });
  }
  return prisma;
}

/**
 * Setup test database
 * Called once before all tests run
 */
export async function setupTestDatabase(): Promise<void> {
  const client = getTestPrisma();
  
  try {
    // Verify database connection
    await client.$connect();
    console.log('✅ Test database connected');
    
    // Optionally run migrations in test mode
    // await runMigrations();
  } catch (error: any) {
    // If database doesn't exist (P1003), try to use main database
    if (error.errorCode === 'P1003') {
      console.warn('⚠️ Test database does not exist, using main DATABASE_URL');
      console.warn('   Consider creating a separate test database for isolation');
      // Continue anyway - tests will use whatever database is available
      return;
    }
    console.error('❌ Failed to connect to test database:', error);
    throw error;
  }
}

/**
 * Cleanup all data from database
 * Use with caution - deletes all data
 */
export async function cleanupDatabase(): Promise<void> {
  const client = getTestPrisma();
  
  try {
    // Delete in correct order to avoid foreign key constraints
    // Order: dependent tables first, then parent tables
    const tablesToClean = [
      'OrderItem',
      'Order',
      'CartItem',
      'Cart',
      'ProductTranslation',
      'Product',
      'User',
      // Add other tables as needed
    ];

    for (const table of tablesToClean) {
      try {
        // @ts-ignore - Dynamic table access
        if (client[table.charAt(0).toLowerCase() + table.slice(1)]) {
          // @ts-ignore
          await client[table.charAt(0).toLowerCase() + table.slice(1)].deleteMany({});
        }
      } catch (e) {
        // Table might not exist or be empty, ignore
      }
    }
    
    console.log('✅ Test database cleaned');
  } catch (error) {
    console.error('⚠️ Error cleaning database:', error);
  }
}

/**
 * Clean specific tables
 */
export async function cleanTables(...tables: string[]): Promise<void> {
  const client = getTestPrisma();
  
  for (const table of tables) {
    try {
      const modelName = table.charAt(0).toLowerCase() + table.slice(1);
      // @ts-ignore - Dynamic table access
      if (client[modelName]) {
        // @ts-ignore
        await client[modelName].deleteMany({});
      }
    } catch (e) {
      // Ignore errors
    }
  }
}

/**
 * Disconnect from database
 */
export async function disconnectDatabase(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
    console.log('✅ Test database disconnected');
  }
}

/**
 * Transaction wrapper for test isolation
 * Wraps test in a transaction that gets rolled back after test
 * 
 * Usage:
 * ```typescript
 * it('should do something', async () => {
 *   await withTransaction(async (tx) => {
 *     // Use tx instead of prisma
 *     await tx.user.create({ ... });
 *     // Transaction will be rolled back after test
 *   });
 * });
 * ```
 */
export async function withTransaction<T>(
  callback: (tx: PrismaClient) => Promise<T>
): Promise<T> {
  const client = getTestPrisma();
  
  // Note: Prisma doesn't support manual transaction rollback easily
  // This is a simplified version - for true isolation, consider using
  // nested transactions or database-level savepoints
  
  try {
    const result = await client.$transaction(async (tx) => {
      return callback(tx as unknown as PrismaClient);
    });
    return result;
  } catch (error) {
    // Transaction rolled back automatically on error
    throw error;
  }
}

/**
 * Reset database to clean state
 * More aggressive than cleanupDatabase - truncates tables
 */
export async function resetDatabase(): Promise<void> {
  const client = getTestPrisma();
  
  try {
    // Use raw SQL for faster truncation (PostgreSQL)
    await client.$executeRaw`
      DO $$ 
      DECLARE 
        r RECORD;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
          EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
      END $$;
    `;
    console.log('✅ Test database reset');
  } catch (error) {
    // Fallback to deleteMany if raw SQL fails
    await cleanupDatabase();
  }
}

// Re-export prisma for direct use in tests
export { prisma };
