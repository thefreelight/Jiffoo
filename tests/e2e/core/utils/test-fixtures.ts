/**
 * Extended Test Fixtures
 *
 * Provides enhanced Playwright test fixtures with strict assertions,
 * API interception, authentication helpers, and test data management.
 *
 * Requirements: 27.3, 27.4
 */

import { test as base, expect, Page, APIRequestContext } from '@playwright/test';
import { StrictAssertions, createStrictAssertions } from './strict-assertions';
import { ApiInterceptor, createApiInterceptor } from './api-interceptor';
import { AuthHelper, createAuthHelper, DEFAULT_CREDENTIALS } from './auth-helper';
import { DataFactory, createDataFactory, UserData, ProductData } from './data-factory';

// ============================================
// Types
// ============================================

export interface TestUser {
  id?: string;
  email: string;
  password: string;
  username: string;
}

export interface TestProduct {
  id?: string;
  name: string;
  price: number;
  stock: number;
}

export interface TestFixtures {
  // Assertion utilities
  strict: StrictAssertions;

  // API utilities
  apiInterceptor: ApiInterceptor;

  // Auth utilities
  auth: AuthHelper;

  // Data factory
  dataFactory: DataFactory;

  // Pre-created test data
  testUser: TestUser;
  testProduct: TestProduct;

  // Authenticated page (logged in as user)
  authenticatedPage: Page;

  // Admin authenticated page
  adminPage: Page;
}

// ============================================
// Base URL Configuration
// ============================================

const getBaseUrl = (): string => {
  return process.env.BASE_URL || 'http://localhost:3001';
};

const getApiBaseUrl = (): string => {
  return process.env.API_BASE_URL || 'http://localhost:3000';
};

// ============================================
// Extended Test Fixtures
// ============================================

export const test = base.extend<TestFixtures>({
  /**
   * Strict assertions utility
   */
  strict: async ({ page }, use) => {
    const strict = createStrictAssertions(page);
    await use(strict);
  },

  /**
   * API interceptor utility
   */
  apiInterceptor: async ({ page }, use) => {
    const interceptor = createApiInterceptor(page);
    await interceptor.start();
    await use(interceptor);
    // Cleanup
    await interceptor.stop();
  },

  /**
   * Authentication helper
   */
  auth: async ({ page }, use) => {
    const auth = createAuthHelper(page);
    await use(auth);
    // Cleanup: logout if logged in
    try {
      if (await auth.isLoggedIn()) {
        await auth.clearAuthState();
      }
    } catch {
      // Ignore cleanup errors
    }
  },

  /**
   * Data factory for creating test data
   */
  dataFactory: async ({ request }, use) => {
    const factory = createDataFactory(request, getApiBaseUrl());
    await use(factory);
    // Cleanup all created test data
    await factory.cleanup();
  },

  /**
   * Pre-created test user
   */
  testUser: async ({ dataFactory }, use) => {
    // Create a unique test user
    const user = await dataFactory.createUser({
      email: `test-${Date.now()}@example.com`,
      password: 'TestPassword123!',
      username: `testuser-${Date.now()}`,
    });

    await use({
      id: user.id,
      email: user.email,
      password: user.password,
      username: user.username,
    });

    // Cleanup is handled by dataFactory
  },

  /**
   * Pre-created test product
   */
  testProduct: async ({ dataFactory }, use) => {
    // Create a unique test product
    const product = await dataFactory.createProduct({
      name: `Test Product ${Date.now()}`,
      price: 99.99,
      stock: 100,
    });

    await use({
      id: product.id,
      name: product.name,
      price: product.price,
      stock: product.stock,
    });

    // Cleanup is handled by dataFactory
  },

  /**
   * Page with user authentication
   */
  authenticatedPage: async ({ page, auth }, use) => {
    await auth.loginAsUser();
    await use(page);
    // Cleanup
    await auth.clearAuthState();
  },

  /**
   * Page with admin authentication
   */
  adminPage: async ({ page, auth }, use) => {
    await auth.loginAsAdmin();
    await use(page);
    // Cleanup
    await auth.clearAuthState();
  },
});

// ============================================
// Re-export expect
// ============================================

export { expect };

// ============================================
// Helper Functions
// ============================================

/**
 * Create a test with all fixtures
 */
export function createTest() {
  return test;
}

/**
 * Skip test if condition is true
 */
export function skipIf(condition: boolean, reason: string) {
  if (condition) {
    test.skip(true, reason);
  }
}

/**
 * Skip test in CI environment
 */
export function skipInCI(reason: string = 'Skipped in CI') {
  skipIf(!!process.env.CI, reason);
}

/**
 * Only run test in CI environment
 */
export function onlyInCI(reason: string = 'Only runs in CI') {
  skipIf(!process.env.CI, reason);
}

// ============================================
// Test Utilities
// ============================================

/**
 * Wait for network to be idle
 */
export async function waitForNetworkIdle(page: Page, timeout: number = 5000): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout });
}

/**
 * Wait for all images to load
 */
export async function waitForImages(page: Page, timeout: number = 10000): Promise<void> {
  // Wait for network to be idle, which typically means images are loaded
  await page.waitForLoadState('networkidle', { timeout });
}

/**
 * Take a screenshot with timestamp
 */
export async function takeScreenshot(
  page: Page,
  name: string
): Promise<Buffer> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return page.screenshot({
    path: `test-results/screenshots/${name}-${timestamp}.png`,
    fullPage: true,
  });
}

/**
 * Log page console messages
 */
export function logConsoleMessages(page: Page): void {
  page.on('console', msg => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      console.log(`[${type.toUpperCase()}] ${msg.text()}`);
    }
  });
}

/**
 * Log page errors
 */
export function logPageErrors(page: Page): void {
  page.on('pageerror', error => {
    console.error('[PAGE ERROR]', error.message);
  });
}
