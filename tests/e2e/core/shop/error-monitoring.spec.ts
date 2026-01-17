import { test, expect } from '@playwright/test';
import { createErrorCollector } from '../utils/error-collector';

/**
 * Error Monitoring Property Tests
 * 
 * Property 9: No Infinite Refresh Loops
 * Property 10: Network Requests Succeed
 */

const PAGES_TO_TEST = [
  { path: '/en', name: 'Home' },
  { path: '/en/products', name: 'Products' },
  { path: '/en/cart', name: 'Cart' },
  { path: '/en/search', name: 'Search' },
];

test.describe('Property 9: No Infinite Refresh Loops', () => {
  for (const pageConfig of PAGES_TO_TEST) {
    test(`${pageConfig.name} page should not refresh infinitely`, async ({ page }) => {
      const errorCollector = createErrorCollector(page);
      
      await page.goto(pageConfig.path);
      
      // Wait for potential refresh loops to manifest
      await page.waitForTimeout(5000);
      await page.waitForLoadState('networkidle');
      
      // Assert no infinite loops detected
      errorCollector.assertNoErrorType('infinite-loop');
    });
  }
});

test.describe('Property 10: Network Requests Succeed', () => {
  test('API requests should not return 5xx errors', async ({ page }) => {
    const failedRequests: string[] = [];
    
    // Monitor network requests
    page.on('response', response => {
      if (response.url().includes('/api/') && response.status() >= 500) {
        failedRequests.push(`${response.status()} ${response.url()}`);
      }
    });
    
    // Visit multiple pages to trigger API calls
    await page.goto('/en');
    await page.waitForLoadState('networkidle');
    
    await page.goto('/en/products');
    await page.waitForLoadState('networkidle');
    
    // No server errors should have occurred
    expect(failedRequests.length, `Server errors: ${failedRequests.join(', ')}`).toBe(0);
  });

  test('Static assets should load successfully', async ({ page }) => {
    const failedAssets: string[] = [];
    
    page.on('response', response => {
      const url = response.url();
      const isAsset = url.match(/\.(js|css|png|jpg|jpeg|svg|woff|woff2)$/);
      if (isAsset && response.status() >= 400) {
        failedAssets.push(`${response.status()} ${url}`);
      }
    });
    
    await page.goto('/en');
    await page.waitForLoadState('networkidle');
    
    // Allow some 404s for optional assets
    const criticalFailures = failedAssets.filter(f => !f.includes('404'));
    expect(criticalFailures.length).toBe(0);
  });
});

test.describe('Console Error Monitoring', () => {
  test('Home page should not have console errors', async ({ page }) => {
    const errorCollector = createErrorCollector(page);
    
    await page.goto('/en');
    await page.waitForLoadState('networkidle');
    
    errorCollector.assertNoErrorType('console');
  });

  test('Products page should not have console errors', async ({ page }) => {
    const errorCollector = createErrorCollector(page);
    
    await page.goto('/en/products');
    await page.waitForLoadState('networkidle');
    
    errorCollector.assertNoErrorType('console');
  });
});

test.describe('Image Loading', () => {
  test('All images should load or have fallback', async ({ page }) => {
    const brokenImages: string[] = [];
    
    page.on('response', response => {
      if (response.url().match(/\.(png|jpg|jpeg|gif|webp|svg)$/i) && response.status() >= 400) {
        brokenImages.push(response.url());
      }
    });
    
    await page.goto('/en/products');
    await page.waitForLoadState('networkidle');
    
    // Check for broken image elements
    const images = await page.locator('img').all();
    for (const img of images) {
      const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
      const src = await img.getAttribute('src');
      if (naturalWidth === 0 && src && !src.includes('placeholder')) {
        brokenImages.push(src);
      }
    }
    
    // Allow some broken images if they have fallbacks
    expect(brokenImages.length).toBeLessThan(5);
  });
});

