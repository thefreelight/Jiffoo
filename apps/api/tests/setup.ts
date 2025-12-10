/**
 * Global Test Setup
 * 
 * This file is loaded before all tests run.
 * It sets up environment variables, global mocks, and test lifecycle hooks.
 */

import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';

// ============================================
// Environment Variables
// ============================================

// Set test environment
process.env.NODE_ENV = 'test';

// Database - Use test database
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

// JWT secrets for testing
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-key';

// Redis - Use test instance or disable
process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379/1';

// Disable rate limiting in tests
process.env.DISABLE_RATE_LIMITING = 'true';

// ============================================
// Global Mocks
// ============================================

// Mock console methods to reduce noise (optional)
// Uncomment if you want quieter test output
// vi.spyOn(console, 'log').mockImplementation(() => {});
// vi.spyOn(console, 'info').mockImplementation(() => {});

// Mock external services by default
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: 'mock-email-id' } }),
    },
  })),
}));

// ============================================
// Test Lifecycle Hooks
// ============================================

beforeAll(async () => {
  // Global setup before all tests
  console.log('🧪 Test suite starting...');
});

afterAll(async () => {
  // Global cleanup after all tests
  console.log('🧪 Test suite completed.');
});

beforeEach(async () => {
  // Reset mocks before each test
  vi.clearAllMocks();
});

afterEach(async () => {
  // Cleanup after each test
});

// ============================================
// Global Test Utilities
// ============================================

/**
 * Wait for a specified time
 */
export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generate a random test ID
 */
export const generateTestId = () => `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * Expect a promise to reject
 */
export const expectToReject = async (promise: Promise<unknown>, errorMessage?: string) => {
  try {
    await promise;
    throw new Error('Expected promise to reject');
  } catch (error: unknown) {
    if (errorMessage && error instanceof Error) {
      expect(error.message).toContain(errorMessage);
    }
  }
};

