/**
 * Vitest Global Setup
 * 
 * This file is loaded before all tests run.
 * Configure global test environment, mocks, and cleanup hooks.
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import dotenv from 'dotenv';
import path from 'path';

// Load tests/.env.test before importing db helpers
dotenv.config({ path: path.resolve(__dirname, './.env.test') });

const dbUrl = process.env.DATABASE_URL_TEST || 'postgresql://test:test@localhost:5432/jiffoo_test?schema=public';

if (!/(^|[_-])test([^a-zA-Z0-9]|$)/i.test(dbUrl)) {
  console.warn(`Unsafe test database URL detected: ${dbUrl}. Continuing in fallback mode.`);
}

process.env.DATABASE_URL_TEST = dbUrl;
process.env.DATABASE_URL = dbUrl;

import { cleanupDatabase, setupTestDatabase, disconnectDatabase } from './helpers/db';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests

// Global setup - runs once before all tests
beforeAll(async () => {
  console.log('\n Setting up test environment...\n');
  await setupTestDatabase();
  await clearWarehouseCache();
});

/**
 * The API caches the default warehouse in Redis (warehouse:default). The
 * playwright E2E suites share this Redis database and claim their own
 * default warehouse, so a stale cache entry would point order stock checks
 * at a warehouse this suite never stocks (and vice versa — the E2E global
 * setup clears the same keys).
 */
async function clearWarehouseCache(): Promise<void> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return;

  try {
    const { default: Redis } = await import('ioredis');
    const redis = new Redis(redisUrl, { maxRetriesPerRequest: 1, lazyConnect: true });
    await redis.connect();
    const keys = await redis.keys('warehouse:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    redis.disconnect();
  } catch (error) {
    console.warn('Test setup: unable to clear warehouse cache in Redis:', error);
  }
}

// Global teardown - runs once after all tests
afterAll(async () => {
  console.log('\n Cleaning up test environment...\n');
  await cleanupDatabase();
  await disconnectDatabase();
});

// Per-test hooks (optional, can be overridden in individual test files)
beforeEach(async () => {
  // Reset any test state if needed
});

afterEach(async () => {
  // Clean up after each test if needed
});
