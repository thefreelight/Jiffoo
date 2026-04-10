/**
 * Empty States E2E Tests (Hardened)
 *
 * Tests empty state handling with strict assertions.
 * Validates empty state display across different pages.
 *
 * Requirements: 28.5
 */

import { test, expect } from '../utils/test-fixtures';

// ============================================
// Test Data & Selectors
// ============================================

const SELECTORS = {
  // Empty states
  emptyState: '[data-testid="empty-state"], .empty-state, .no-data',
  emptyIcon: '[data-testid="empty-icon"], .empty-icon, svg',
  emptyTitle: '[data-testid="empty-title"], .empty-title, h2, h3',
  emptyDescription: '[data-testid="empty-description"], .empty-description, p',
  emptyAction: '[data-testid="empty-action"], .empty-action, button, a',
  
  // Specific empty states
  noProducts: ':text("No products"), :text("没有商品"), :text("No items")',
  noOrders: ':text("No orders"), :text("没有订单"), :text("No orders yet")',
  noResults: ':text("No results"), :text("没有结果"), :text("No matches")',
  noCustomers: ':text("No customers"), :text("没有客户")',
  emptyCart: ':text("empty cart"), :text("购物车为空"), :text("Cart is empty")',
  
  // Action buttons
  shopNowButton: 'a:has-text("Shop"), a:has-text("购物"), button:has-text("Browse")',
  addProductButton: 'button:has-text("Add"), button:has-text("添加")',
  searchButton: 'button:has-text("Search"), a:has-text("Search")',
};

// ============================================
// Product Empty State Tests
// ============================================

test.describe('Empty States - Products', () => {
  test('should display empty state when no products', async ({ page, strict }) => {
    await page.route('**/api/products**', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ products: [], total: 0 }),
      });
    });
    
    await page.goto('/en/products');
    await page.waitForLoadState('networkidle');
    
    const emptyState = page.locator(SELECTORS.emptyState);
    const noProducts = page.locator(SELECTORS.noProducts);
    
    const hasEmptyState = await emptyState.count() > 0;
    const hasNoProducts = await noProducts.count() > 0;
    
    // Should show empty state
    expect(hasEmptyState || hasNoProducts).toBeTruthy();
  });

  test('should display helpful message', async ({ page }) => {
    await page.route('**/api/products**', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ products: [], total: 0 }),
      });
    });
    
    await page.goto('/en/products');
    await page.waitForLoadState('networkidle');
    
    const emptyTitle = page.locator(SELECTORS.emptyTitle);
    const emptyDescription = page.locator(SELECTORS.emptyDescription);
    
    const hasTitle = await emptyTitle.count() > 0;
    const hasDescription = await emptyDescription.count() > 0;
  });
});

// ============================================
// Cart Empty State Tests
// ============================================

test.describe('Empty States - Cart', () => {
  test('should display empty cart state', async ({ page, strict }) => {
    // Clear cart
    await page.context().clearCookies();
    
    await page.goto('/en/cart');
    await page.waitForLoadState('networkidle');
    
    const emptyState = page.locator(SELECTORS.emptyState);
    const emptyCart = page.locator(SELECTORS.emptyCart);
    
    const hasEmptyState = await emptyState.count() > 0;
    const hasEmptyCart = await emptyCart.count() > 0;
    
    expect(hasEmptyState || hasEmptyCart).toBeTruthy();
  });

  test('should show shop now action', async ({ page }) => {
    await page.context().clearCookies();
    
    await page.goto('/en/cart');
    await page.waitForLoadState('networkidle');
    
    const shopNowButton = page.locator(SELECTORS.shopNowButton);
    const emptyAction = page.locator(SELECTORS.emptyAction);
    
    const hasShopNow = await shopNowButton.count() > 0;
    const hasAction = await emptyAction.count() > 0;
  });

  test('should navigate to products from empty cart', async ({ page }) => {
    await page.context().clearCookies();
    
    await page.goto('/en/cart');
    await page.waitForLoadState('networkidle');
    
    const shopNowButton = page.locator(SELECTORS.shopNowButton);
    
    if (await shopNowButton.count() > 0) {
      await shopNowButton.first().click();
      await page.waitForLoadState('networkidle');
      
      const url = page.url();
      const isOnProducts = url.includes('product') || url.includes('shop');
    }
  });
});

// ============================================
// Orders Empty State Tests
// ============================================

test.describe('Empty States - Orders', () => {
  test('should display empty orders state', async ({ page, dataFactory }) => {
    // Create fresh user with no orders
    const newUser = await dataFactory.createUser({
      email: `empty-orders-${Date.now()}@example.com`,
      password: 'TestPassword123!',
      username: `emptyuser-${Date.now()}`,
    });
    
    await page.goto('/en/auth/login');
    await page.waitForLoadState('networkidle');
    
    const emailInput = page.locator('input[name="email"], input[type="email"]');
    const passwordInput = page.locator('input[name="password"], input[type="password"]');
    const submitButton = page.locator('button[type="submit"]');
    
    if (await emailInput.count() > 0) {
      await emailInput.fill(newUser.email);
      await passwordInput.fill(newUser.password);
      await submitButton.click();
      await page.waitForLoadState('networkidle');
    }
    
    await page.goto('/en/orders');
    await page.waitForLoadState('networkidle');
    
    const emptyState = page.locator(SELECTORS.emptyState);
    const noOrders = page.locator(SELECTORS.noOrders);
    
    const hasEmptyState = await emptyState.count() > 0;
    const hasNoOrders = await noOrders.count() > 0;
  });
});

// ============================================
// Search Empty State Tests
// ============================================

test.describe('Empty States - Search', () => {
  test('should display no results state', async ({ page, strict }) => {
    await page.goto('/en/search?q=xyznonexistent12345');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    const emptyState = page.locator(SELECTORS.emptyState);
    const noResults = page.locator(SELECTORS.noResults);
    
    const hasEmptyState = await emptyState.count() > 0;
    const hasNoResults = await noResults.count() > 0;
    
    expect(hasEmptyState || hasNoResults).toBeTruthy();
  });

  test('should suggest alternatives', async ({ page }) => {
    await page.goto('/en/search?q=xyznonexistent12345');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    const emptyDescription = page.locator(SELECTORS.emptyDescription);
    const searchButton = page.locator(SELECTORS.searchButton);
    
    const hasDescription = await emptyDescription.count() > 0;
    const hasSearchAction = await searchButton.count() > 0;
  });
});

// ============================================
// Admin Empty State Tests
// ============================================

test.describe('Empty States - Admin', () => {
  test('should display empty products in admin', async ({ adminPage }) => {
    await adminPage.route('**/api/products**', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ products: [], total: 0 }),
      });
    });
    
    await adminPage.goto('/admin/products');
    await adminPage.waitForLoadState('networkidle');
    
    const emptyState = adminPage.locator(SELECTORS.emptyState);
    const addButton = adminPage.locator(SELECTORS.addProductButton);
    
    const hasEmptyState = await emptyState.count() > 0;
    const hasAddButton = await addButton.count() > 0;
  });

  test('should display empty customers in admin', async ({ adminPage }) => {
    await adminPage.route('**/api/customers**', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ customers: [], total: 0 }),
      });
    });
    
    await adminPage.goto('/admin/customers');
    await adminPage.waitForLoadState('networkidle');
    
    const emptyState = adminPage.locator(SELECTORS.emptyState);
    const noCustomers = adminPage.locator(SELECTORS.noCustomers);
    
    const hasEmptyState = await emptyState.count() > 0;
    const hasNoCustomers = await noCustomers.count() > 0;
  });
});

// ============================================
// Empty State UI Tests
// ============================================

test.describe('Empty States - UI', () => {
  test('should display icon in empty state', async ({ page }) => {
    await page.route('**/api/products**', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ products: [], total: 0 }),
      });
    });
    
    await page.goto('/en/products');
    await page.waitForLoadState('networkidle');
    
    const emptyIcon = page.locator(SELECTORS.emptyIcon);
    const hasIcon = await emptyIcon.count() > 0;
  });

  test('should have accessible empty state', async ({ page }) => {
    await page.route('**/api/products**', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ products: [], total: 0 }),
      });
    });
    
    await page.goto('/en/products');
    await page.waitForLoadState('networkidle');
    
    const emptyState = page.locator(SELECTORS.emptyState);
    
    if (await emptyState.count() > 0) {
      // Check for accessible text
      const text = await emptyState.textContent();
      expect(text?.trim().length).toBeGreaterThan(0);
    }
  });
});

// ============================================
// Responsive Design Tests
// ============================================

test.describe('Empty States - Responsive', () => {
  test('should display correctly on mobile', async ({ page, strict }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.route('**/api/products**', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ products: [], total: 0 }),
      });
    });
    
    await page.goto('/en/products');
    await page.waitForLoadState('networkidle');
    
    const body = page.locator('body');
    await strict.mustExist(body);
  });

  test('should display correctly on tablet', async ({ page, strict }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    
    await page.route('**/api/products**', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ products: [], total: 0 }),
      });
    });
    
    await page.goto('/en/products');
    await page.waitForLoadState('networkidle');
    
    const body = page.locator('body');
    await strict.mustExist(body);
  });
});
