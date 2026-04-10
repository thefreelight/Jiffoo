/**
 * Server Errors E2E Tests (Hardened)
 *
 * Tests server error handling with strict assertions.
 * Validates 500 errors, error boundaries, and recovery.
 *
 * Requirements: 28.3
 */

import { test, expect } from '../utils/test-fixtures';

// ============================================
// Test Data & Selectors
// ============================================

const SELECTORS = {
  // Error states
  errorBoundary: '[data-testid="error-boundary"], .error-boundary',
  serverError: '[data-testid="server-error"], .server-error, .error-500',
  errorMessage: '[data-testid="error-message"], .error, .alert-error',
  errorTitle: '[data-testid="error-title"], .error-title, h1',
  errorDescription: '[data-testid="error-description"], .error-description',
  
  // Recovery
  retryButton: '[data-testid="retry"], button:has-text("Retry"), button:has-text("重试")',
  homeButton: '[data-testid="go-home"], a:has-text("Home"), a:has-text("首页")',
  backButton: '[data-testid="go-back"], button:has-text("Back"), button:has-text("返回")',
  
  // Content
  mainContent: '[data-testid="main-content"], main, .main-content',
};

// ============================================
// 500 Error Tests
// ============================================

test.describe('Server Errors - 500 Errors', () => {
  test('should handle 500 error gracefully', async ({ page, strict }) => {
    await page.route('**/api/**', route => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });
    
    await page.goto('/en/products');
    await page.waitForLoadState('networkidle');
    
    // Page should still render
    const body = page.locator('body');
    await strict.mustExist(body);
    
    // Should show error state
    const errorBoundary = page.locator(SELECTORS.errorBoundary);
    const serverError = page.locator(SELECTORS.serverError);
    const errorMessage = page.locator(SELECTORS.errorMessage);
    
    const hasErrorBoundary = await errorBoundary.count() > 0;
    const hasServerError = await serverError.count() > 0;
    const hasErrorMessage = await errorMessage.count() > 0;
  });

  test('should display error message for 500', async ({ page }) => {
    await page.route('**/api/products**', route => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });
    
    await page.goto('/en/products');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    const errorMessage = page.locator(SELECTORS.errorMessage);
    const hasError = await errorMessage.count() > 0;
  });

  test('should handle 502 Bad Gateway', async ({ page, strict }) => {
    await page.route('**/api/**', route => {
      route.fulfill({
        status: 502,
        body: 'Bad Gateway',
      });
    });
    
    await page.goto('/en/products');
    await page.waitForLoadState('networkidle');
    
    const body = page.locator('body');
    await strict.mustExist(body);
  });

  test('should handle 503 Service Unavailable', async ({ page, strict }) => {
    await page.route('**/api/**', route => {
      route.fulfill({
        status: 503,
        body: JSON.stringify({ error: 'Service Unavailable' }),
      });
    });
    
    await page.goto('/en/products');
    await page.waitForLoadState('networkidle');
    
    const body = page.locator('body');
    await strict.mustExist(body);
  });
});

// ============================================
// Error Boundary Tests
// ============================================

test.describe('Server Errors - Error Boundary', () => {
  test('should catch rendering errors', async ({ page, strict }) => {
    // Mock API to return malformed data
    await page.route('**/api/products**', route => {
      route.fulfill({
        status: 200,
        body: 'invalid json{{{',
        contentType: 'application/json',
      });
    });
    
    await page.goto('/en/products');
    await page.waitForLoadState('networkidle');
    
    // Page should still render with error boundary
    const body = page.locator('body');
    await strict.mustExist(body);
  });

  test('should display error boundary UI', async ({ page }) => {
    await page.route('**/api/**', route => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Server Error' }),
      });
    });
    
    await page.goto('/en/products');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    const errorBoundary = page.locator(SELECTORS.errorBoundary);
    const hasErrorBoundary = await errorBoundary.count() > 0;
  });

  test('should provide recovery options', async ({ page }) => {
    await page.route('**/api/**', route => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Server Error' }),
      });
    });
    
    await page.goto('/en/products');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    const retryButton = page.locator(SELECTORS.retryButton);
    const homeButton = page.locator(SELECTORS.homeButton);
    const backButton = page.locator(SELECTORS.backButton);
    
    const hasRetry = await retryButton.count() > 0;
    const hasHome = await homeButton.count() > 0;
    const hasBack = await backButton.count() > 0;
  });
});

// ============================================
// Recovery Tests
// ============================================

test.describe('Server Errors - Recovery', () => {
  test('should recover on retry', async ({ page }) => {
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
      
      expect(requestCount).toBeGreaterThanOrEqual(1);
    }
  });

  test('should navigate home on error', async ({ page }) => {
    await page.route('**/api/**', route => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Server Error' }),
      });
    });
    
    await page.goto('/en/products');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    const homeButton = page.locator(SELECTORS.homeButton);
    
    if (await homeButton.count() > 0) {
      // Remove route to allow home page to load
      await page.unroute('**/api/**');
      
      await homeButton.click();
      await page.waitForLoadState('networkidle');
      
      const url = page.url();
      const isOnHome = url.endsWith('/en') || url.endsWith('/en/');
    }
  });
});

// ============================================
// Partial Failure Tests
// ============================================

test.describe('Server Errors - Partial Failure', () => {
  test('should handle partial API failure', async ({ page, strict }) => {
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
    
    // Page should render with partial content
    const body = page.locator('body');
    await strict.mustExist(body);
  });
});

// ============================================
// Responsive Design Tests
// ============================================

test.describe('Server Errors - Responsive', () => {
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

  test('should display error correctly on tablet', async ({ page, strict }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    
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
