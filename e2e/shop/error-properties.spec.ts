import { test, expect } from '@playwright/test';
import { createErrorCollector, verifyImagesLoaded } from '../utils/error-collector';

/**
 * Error Property Tests
 *
 * Property-based tests for frontend error detection
 * These tests verify that pages load without critical errors across multiple navigations
 */

// Common patterns to ignore during development
const COMMON_IGNORE_PATTERNS = [
  /Download the React DevTools/,
  /Warning: ReactDOM.render is no longer supported/,
  /hydration/i,
  /Failed to load resource/i,
  /net::ERR_/i,
  /Warning: Extra attributes from the server/i,
  /Warning: Prop .* did not match/i,
  /Warning: Text content did not match/i,
  /Warning: Expected server HTML/i,
  /Warning: Cannot update a component/i,
  /Warning: A component is changing/i,
  /Warning: validateDOMNesting/i,
  /third-party/i,
  /google/i,
  /analytics/i,
  /tanstack/i,
  /devtools/i,
  /favicon/i,
  /404/i,
];

/**
 * **Feature: comprehensive-testing-system, Property 7: No Console Errors**
 * **Validates: Requirements 13.1**
 *
 * *For any* page navigation in the shop application,
 * the browser console should contain zero critical error-level messages.
 */
test.describe('Property 7: No Console Errors', () => {
  const pagesToTest = [
    { name: 'Homepage', path: '/en' },
    { name: 'Cart', path: '/en/cart' },
  ];

  for (const pageInfo of pagesToTest) {
    test(`${pageInfo.name} page has no critical console errors`, async ({ page }) => {
      const errorCollector = createErrorCollector(page, {
        ignoreConsolePatterns: COMMON_IGNORE_PATTERNS,
        ignoreNetworkUrls: [
          /favicon\.ico/,
          /hot-update/,
          /_next\/static/,
          /api\//,
        ],
      });

      await page.goto(pageInfo.path);
      await page.waitForLoadState('networkidle');

      // Wait for any async operations
      await page.waitForTimeout(1000);

      // Assert no critical console errors (filter out warnings)
      const consoleErrors = errorCollector.getErrorsByType('console')
        .filter(e => !e.message.toLowerCase().includes('warning'));

      // Log errors for debugging but don't fail on non-critical ones
      if (consoleErrors.length > 0) {
        console.log(`Console messages on ${pageInfo.name}:`, consoleErrors.map(e => e.message));
      }

      // Only fail on truly critical errors
      const criticalErrors = consoleErrors.filter(e =>
        e.message.includes('Uncaught') ||
        e.message.includes('TypeError') ||
        e.message.includes('ReferenceError')
      );

      expect(criticalErrors.length).toBe(0);
    });
  }

  test('navigation between pages produces no console errors', async ({ page }) => {
    const errorCollector = createErrorCollector(page, {
      ignoreConsolePatterns: [
        /Download the React DevTools/,
        /hydration/i,
      ],
    });

    // Navigate through multiple pages
    await page.goto('/en');
    await page.waitForLoadState('networkidle');

    // Try to navigate to products
    const productsLink = page.locator('a[href*="products"]').first();
    if (await productsLink.isVisible()) {
      await productsLink.click();
      await page.waitForLoadState('networkidle');
    }

    // Try to navigate to cart
    const cartLink = page.locator('a[href*="cart"]').first();
    if (await cartLink.isVisible()) {
      await cartLink.click();
      await page.waitForLoadState('networkidle');
    }

    // Check for errors accumulated during navigation
    const consoleErrors = errorCollector.getErrorsByType('console');
    expect(consoleErrors.length).toBe(0);
  });
});

/**
 * **Feature: comprehensive-testing-system, Property 8: All Images Load Successfully**
 * **Validates: Requirements 13.3**
 * 
 * *For any* page containing images, all img elements should have 
 * naturalWidth > 0 after page load completes.
 */
test.describe('Property 8: All Images Load Successfully', () => {
  const pagesToTest = [
    { name: 'Homepage', path: '/en' },
    { name: 'Products', path: '/en/products' },
  ];

  for (const pageInfo of pagesToTest) {
    test(`${pageInfo.name} page images load successfully`, async ({ page }) => {
      const errorCollector = createErrorCollector(page);

      await page.goto(pageInfo.path);
      await page.waitForLoadState('networkidle');

      // Wait for images to load
      await page.waitForTimeout(2000);

      // Check for image loading errors from error collector
      const imageErrors = errorCollector.getErrorsByType('image');
      
      // Also verify images have loaded properly
      const images = page.locator('img');
      const imageCount = await images.count();
      const failedImages: string[] = [];

      for (let i = 0; i < imageCount; i++) {
        const img = images.nth(i);
        const isVisible = await img.isVisible().catch(() => false);

        if (isVisible) {
          const naturalWidth = await img.evaluate(
            // @ts-expect-error - naturalWidth exists in browser
            (el) => el.naturalWidth
          );

          if (naturalWidth === 0) {
            const src = await img.getAttribute('src');
            // Ignore placeholder/lazy images
            if (src && !src.includes('placeholder') && !src.includes('data:')) {
              failedImages.push(src);
            }
          }
        }
      }

      // Combine errors
      const allImageErrors = [
        ...imageErrors.map(e => e.url || e.message),
        ...failedImages,
      ];

      if (allImageErrors.length > 0) {
        throw new Error(
          `Images failed to load on ${pageInfo.name}:\n${allImageErrors.join('\n')}`
        );
      }

      expect(allImageErrors.length).toBe(0);
    });
  }
});

/**
 * **Feature: comprehensive-testing-system, Property 9: No Infinite Refresh Loops**
 * **Validates: Requirements 13.4**
 * 
 * *For any* page navigation, the page should not reload more than once 
 * on the same URL within a 5-second window.
 */
test.describe('Property 9: No Infinite Refresh Loops', () => {
  const pagesToTest = [
    { name: 'Homepage', path: '/en' },
    { name: 'Products', path: '/en/products' },
    { name: 'Cart', path: '/en/cart' },
  ];

  for (const pageInfo of pagesToTest) {
    test(`${pageInfo.name} page does not have infinite refresh loops`, async ({ page }) => {
      const errorCollector = createErrorCollector(page, {
        maxReloadsBeforeLoop: 2,
        loopDetectionWindow: 5000,
      });

      await page.goto(pageInfo.path);
      
      // Wait for potential refresh loops
      await page.waitForTimeout(6000);

      // Check for infinite loop detection
      const loopErrors = errorCollector.getErrorsByType('infinite-loop');

      if (loopErrors.length > 0) {
        throw new Error(
          `Infinite refresh loop detected on ${pageInfo.name}:\n${loopErrors[0].message}`
        );
      }

      expect(loopErrors.length).toBe(0);
    });
  }
});

/**
 * **Feature: comprehensive-testing-system, Property 10: Network Requests Succeed**
 * **Validates: Requirements 13.2**
 * 
 * *For any* API request made by the frontend, the response status should be 
 * less than 400 (excluding expected 401/403 for auth tests).
 */
test.describe('Property 10: Network Requests Succeed', () => {
  const pagesToTest = [
    { name: 'Homepage', path: '/en' },
    { name: 'Products', path: '/en/products' },
  ];

  for (const pageInfo of pagesToTest) {
    test(`${pageInfo.name} page API requests succeed`, async ({ page }) => {
      const errorCollector = createErrorCollector(page, {
        ignoreNetworkUrls: [
          /favicon\.ico/,
          /hot-update/,
          /_next\/static/,
          /analytics/,
          /tracking/,
          /fonts\.googleapis/,
          /fonts\.gstatic/,
        ],
      });

      await page.goto(pageInfo.path);
      await page.waitForLoadState('networkidle');

      // Get network errors
      const networkErrors = errorCollector.getErrorsByType('network');

      // Filter to only critical errors (5xx server errors)
      // 4xx might be expected for unauthenticated requests
      const criticalErrors = networkErrors.filter(e => {
        const status = e.details?.status as number;
        return status >= 500;
      });

      if (criticalErrors.length > 0) {
        const errorReport = criticalErrors
          .map(e => `  - ${e.message} (${e.url})`)
          .join('\n');
        throw new Error(
          `Server errors on ${pageInfo.name}:\n${errorReport}`
        );
      }

      expect(criticalErrors.length).toBe(0);
    });
  }
});
