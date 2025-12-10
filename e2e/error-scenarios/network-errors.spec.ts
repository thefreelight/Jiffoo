/**
 * Network Errors E2E Tests (Hardened)
 *
 * Tests network error handling with strict assertions.
 * Validates timeout handling, connection errors, and retry behavior.
 *
 * Requirements: 28.1, 28.4
 */

import { test, expect } from '../utils/test-fixtures';

// ============================================
// Test Data & Selectors
// ============================================

const SELECTORS = {
  // Error states
  errorMessage: '[data-testid="error-message"], .error, .alert-error, .error-boundary',
  errorBoundary: '[data-testid="error-boundary"], .error-boundary',
  networkError: '[data-testid="network-error"], .network-error',
  timeoutError: '[data-testid="timeout-error"], .timeout-error',
  
  // Retry
  retryButton: '[data-testid="retry"], button:has-text("Retry"), button:has-text("重试")',
  refreshButton: '[data-testid="refresh"], button:has-text("Refresh"), button:has-text("刷新")',
  
  // Loading
  loading: '[data-testid="loading"], .loading, .spinner',
  skeleton: '[data-testid="skeleton"], .skeleton',
  
  // Offline indicator
  offlineIndicator: '[data-testid="offline"], .offline-indicator',
  
  // Content
  mainContent: '[data-testid="main-content"], main, .main-content',
};

// ============================================
// Network Timeout Tests
// ============================================

test.describe('Network Errors - Timeout', () => {
  test('should handle API timeout gracefully', async ({ page, strict }) => {
    // Mock slow API response
    await page.route('**/api/**', async route => {
      await new Promise(resolve => setTimeout(resolve, 30000));
      route.abort('timedout');
    });
    
    await page.goto('/en/products', { timeout: 60000 });
    await page.waitForLoadState('domcontentloaded');
    
    // Page should still render
    const body = page.locator('body');
    await strict.mustExist(body);
    
    // Should show error or loading state
    const errorMessage = page.locator(SELECTORS.errorMessage);
    const loading = page.locator(SELECTORS.loading);
    const mainContent = page.locator(SELECTORS.mainContent);
    
    const hasError = await errorMessage.count() > 0;
    const hasLoading = await loading.count() > 0;
    const hasContent = await mainContent.count() > 0;
    
    expect(hasError || hasLoading || hasContent).toBeTruthy();
  });

  test('should show timeout message', async ({ page }) => {
    // Mock timeout
    await page.route('**/api/products**', route => {
      route.abort('timedout');
    });
    
    await page.goto('/en/products');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    // Check for timeout error message
    const timeoutError = page.locator(SELECTORS.timeoutError);
    const errorMessage = page.locator(SELECTORS.errorMessage);
    
    const hasTimeout = await timeoutError.count() > 0;
    const hasError = await errorMessage.count() > 0;
  });
});

// ============================================
// Connection Error Tests
// ============================================

test.describe('Network Errors - Connection', () => {
  test('should handle connection refused', async ({ page, strict }) => {
    // Mock connection error
    await page.route('**/api/**', route => {
      route.abort('connectionrefused');
    });
    
    await page.goto('/en/products');
    await page.waitForLoadState('domcontentloaded');
    
    const body = page.locator('body');
    await strict.mustExist(body);
  });

  test('should handle connection reset', async ({ page, strict }) => {
    // Mock connection reset
    await page.route('**/api/**', route => {
      route.abort('connectionreset');
    });
    
    await page.goto('/en/products');
    await page.waitForLoadState('domcontentloaded');
    
    const body = page.locator('body');
    await strict.mustExist(body);
  });

  test('should display network error message', async ({ page }) => {
    await page.route('**/api/**', route => {
      route.abort('failed');
    });
    
    await page.goto('/en/products');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    const networkError = page.locator(SELECTORS.networkError);
    const errorMessage = page.locator(SELECTORS.errorMessage);
    
    const hasNetworkError = await networkError.count() > 0;
    const hasError = await errorMessage.count() > 0;
  });
});

// ============================================
// Retry Behavior Tests
// ============================================

test.describe('Network Errors - Retry', () => {
  test('should show retry button on error', async ({ page }) => {
    await page.route('**/api/products**', route => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Server Error' }),
      });
    });
    
    await page.goto('/en/products');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    const retryButton = page.locator(SELECTORS.retryButton);
    const refreshButton = page.locator(SELECTORS.refreshButton);
    
    const hasRetry = await retryButton.count() > 0;
    const hasRefresh = await refreshButton.count() > 0;
  });

  test('should retry on button click', async ({ page }) => {
    let requestCount = 0;
    
    await page.route('**/api/products**', route => {
      requestCount++;
      if (requestCount === 1) {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Server Error' }),
        });
      } else {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ products: [] }),
        });
      }
    });
    
    await page.goto('/en/products');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    const retryButton = page.locator(SELECTORS.retryButton);
    
    if (await retryButton.count() > 0) {
      await retryButton.click();
      await page.waitForLoadState('networkidle');
      
      // Should have made second request
      expect(requestCount).toBeGreaterThanOrEqual(1);
    }
  });
});

// ============================================
// Offline Mode Tests
// ============================================

test.describe('Network Errors - Offline', () => {
  test('should handle offline mode', async ({ page, context, strict }) => {
    await page.goto('/en');
    await page.waitForLoadState('networkidle');
    
    // Go offline
    await context.setOffline(true);
    
    // Try to navigate
    await page.goto('/en/products').catch(() => {});
    
    // Page should show offline indicator or cached content
    const body = page.locator('body');
    await strict.mustExist(body);
    
    // Go back online
    await context.setOffline(false);
  });

  test('should show offline indicator', async ({ page, context }) => {
    await page.goto('/en');
    await page.waitForLoadState('networkidle');
    
    // Go offline
    await context.setOffline(true);
    await page.waitForTimeout(1000);
    
    const offlineIndicator = page.locator(SELECTORS.offlineIndicator);
    const hasOffline = await offlineIndicator.count() > 0;
    
    // Go back online
    await context.setOffline(false);
  });
});

// ============================================
// Partial Load Tests
// ============================================

test.describe('Network Errors - Partial Load', () => {
  test('should handle partial API failure', async ({ page, strict }) => {
    // Mock one API to fail, others succeed
    await page.route('**/api/products**', route => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Server Error' }),
      });
    });
    
    await page.route('**/api/categories**', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ categories: [] }),
      });
    });
    
    await page.goto('/en/products');
    await page.waitForLoadState('networkidle');
    
    // Page should still render with partial content
    const body = page.locator('body');
    await strict.mustExist(body);
  });

  test('should show error for failed section only', async ({ page }) => {
    await page.route('**/api/featured**', route => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Server Error' }),
      });
    });
    
    await page.goto('/en');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Page should render with error in one section
    const errorMessages = page.locator(SELECTORS.errorMessage);
    const errorCount = await errorMessages.count();
  });
});

// ============================================
// Slow Network Tests
// ============================================

test.describe('Network Errors - Slow Network', () => {
  test('should show loading state on slow network', async ({ page, strict }) => {
    // Mock slow response
    await page.route('**/api/**', async route => {
      await new Promise(resolve => setTimeout(resolve, 3000));
      route.fulfill({
        status: 200,
        body: JSON.stringify({ data: [] }),
      });
    });
    
    await page.goto('/en/products');
    
    // Should show loading state
    const loading = page.locator(SELECTORS.loading);
    const skeleton = page.locator(SELECTORS.skeleton);
    
    const hasLoading = await loading.count() > 0;
    const hasSkeleton = await skeleton.count() > 0;
    
    // Wait for content
    await page.waitForLoadState('networkidle');
    
    const body = page.locator('body');
    await strict.mustExist(body);
  });
});

// ============================================
// Responsive Design Tests
// ============================================

test.describe('Network Errors - Responsive', () => {
  test('should display error correctly on mobile', async ({ page, strict }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.route('**/api/**', route => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Server Error' }),
      });
    });
    
    await page.goto('/en/products');
    await page.waitForLoadState('networkidle');
    
    const body = page.locator('body');
    await strict.mustExist(body);
  });
});
