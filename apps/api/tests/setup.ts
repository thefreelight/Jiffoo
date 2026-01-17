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

// Fallback to root .env is DANGEROUS, so we enforce explicit test env
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Please ensure .env.test is configured correctly.');
}

import { cleanupDatabase, setupTestDatabase, disconnectDatabase } from './helpers/db';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests

// Global setup - runs once before all tests
beforeAll(async () => {
  console.log('\n🧪 Setting up test environment...\n');
  await setupTestDatabase();
});

// Global teardown - runs once after all tests
afterAll(async () => {
  console.log('\n🧹 Cleaning up test environment...\n');
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

// Extend Vitest matchers if needed
// expect.extend({
//   toBeValidResponse(received) {
//     // Custom matcher logic
//   },
// });
