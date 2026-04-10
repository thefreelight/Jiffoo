import { test, expect } from '@playwright/test';

/**
 * Visual Regression Tests
 * 
 * Captures baseline screenshots and compares against them
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5
 */

// Configuration for visual comparison
const VISUAL_CONFIG = {
  // Maximum allowed pixel difference percentage
  threshold: 0.1,
  // Maximum allowed different pixels
  maxDiffPixels: 100,
  // Mask dynamic content
  mask: [] as string[],
};

test.describe('Visual Regression - Shop', () => {
  test.describe.configure({ mode: 'serial' });

  test('homepage visual snapshot', async ({ page }) => {
    await page.goto('/en');
    await page.waitForLoadState('networkidle');
    
    // Wait for images to load
    await page.waitForTimeout(2000);
    
    // Mask dynamic content
    await maskDynamicContent(page);
    
    // Take screenshot and compare
    await expect(page).toHaveScreenshot('shop-homepage.png', {
      fullPage: true,
      threshold: VISUAL_CONFIG.threshold,
      maxDiffPixels: VISUAL_CONFIG.maxDiffPixels,
    });
  });

  test('products page visual snapshot', async ({ page }) => {
    await page.goto('/en/products');
    await page.waitForLoadState('networkidle');
    
    await page.waitForTimeout(2000);
    await maskDynamicContent(page);
    
    await expect(page).toHaveScreenshot('shop-products.png', {
      fullPage: true,
      threshold: VISUAL_CONFIG.threshold,
      maxDiffPixels: VISUAL_CONFIG.maxDiffPixels,
    });
  });

  test('cart page visual snapshot', async ({ page }) => {
    await page.goto('/en/cart');
    await page.waitForLoadState('networkidle');
    
    await page.waitForTimeout(1000);
    await maskDynamicContent(page);
    
    await expect(page).toHaveScreenshot('shop-cart.png', {
      fullPage: true,
      threshold: VISUAL_CONFIG.threshold,
      maxDiffPixels: VISUAL_CONFIG.maxDiffPixels,
    });
  });

  test('login page visual snapshot', async ({ page }) => {
    await page.goto('/en/auth/login');
    await page.waitForLoadState('networkidle');
    
    await page.waitForTimeout(1000);
    await maskDynamicContent(page);
    
    await expect(page).toHaveScreenshot('shop-login.png', {
      fullPage: true,
      threshold: VISUAL_CONFIG.threshold,
      maxDiffPixels: VISUAL_CONFIG.maxDiffPixels,
    });
  });
});

test.describe('Visual Regression - Admin', () => {
  test.describe.configure({ mode: 'serial' });

  test('admin login page visual snapshot', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    await page.waitForTimeout(1000);
    await maskDynamicContent(page);
    
    await expect(page).toHaveScreenshot('admin-login.png', {
      fullPage: true,
      threshold: VISUAL_CONFIG.threshold,
      maxDiffPixels: VISUAL_CONFIG.maxDiffPixels,
    });
  });
});

test.describe('Visual Regression - Responsive', () => {
  test('homepage mobile visual snapshot', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/en');
    await page.waitForLoadState('networkidle');
    
    await page.waitForTimeout(2000);
    await maskDynamicContent(page);
    
    await expect(page).toHaveScreenshot('shop-homepage-mobile.png', {
      fullPage: true,
      threshold: VISUAL_CONFIG.threshold,
      maxDiffPixels: VISUAL_CONFIG.maxDiffPixels,
    });
  });

  test('homepage tablet visual snapshot', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    
    await page.goto('/en');
    await page.waitForLoadState('networkidle');
    
    await page.waitForTimeout(2000);
    await maskDynamicContent(page);
    
    await expect(page).toHaveScreenshot('shop-homepage-tablet.png', {
      fullPage: true,
      threshold: VISUAL_CONFIG.threshold,
      maxDiffPixels: VISUAL_CONFIG.maxDiffPixels,
    });
  });
});

/**
 * Mask dynamic content that changes between runs
 * (timestamps, random data, etc.)
 */
async function maskDynamicContent(page: import('@playwright/test').Page): Promise<void> {
  // Hide timestamps
  await page.evaluate(() => {
    const timestampSelectors = [
      '[data-testid="timestamp"]',
      '.timestamp',
      'time',
      '[datetime]',
    ];
    
    timestampSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        (el as HTMLElement).style.visibility = 'hidden';
      });
    });
  });

  // Hide random/dynamic IDs
  await page.evaluate(() => {
    const dynamicSelectors = [
      '[data-testid="order-id"]',
      '.order-id',
      '[data-testid="session-id"]',
    ];
    
    dynamicSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        (el as HTMLElement).style.visibility = 'hidden';
      });
    });
  });

  // Hide loading spinners
  await page.evaluate(() => {
    const loadingSelectors = [
      '.loading',
      '.spinner',
      '[data-testid="loading"]',
    ];
    
    loadingSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        (el as HTMLElement).style.display = 'none';
      });
    });
  });
}
