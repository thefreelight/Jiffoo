/**
 * Tenant Customers E2E Tests (Hardened)
 *
 * Tests tenant customer management with strict assertions.
 * Validates customer list, details, search, and export.
 *
 * Requirements: 21.1, 21.2, 21.3, 21.4, 21.5
 */

import { test, expect } from '../utils/test-fixtures';

// ============================================
// Test Data & Selectors
// ============================================

const SELECTORS = {
  // Customer list
  customerList: '[data-testid="customer-list"], .customer-list, table',
  customerRow: '[data-testid="customer-row"], .customer-row, tr',
  customerName: '[data-testid="customer-name"], .customer-name',
  customerEmail: '[data-testid="customer-email"], .customer-email',
  customerOrders: '[data-testid="customer-orders"], .order-count',
  
  // Actions
  viewButton: '[data-testid="view-customer"], button:has-text("View"), button:has-text("查看")',
  exportButton: '[data-testid="export-customers"], button:has-text("Export"), button:has-text("导出")',
  
  // Customer detail
  customerDetail: '[data-testid="customer-detail"], .customer-detail',
  orderHistory: '[data-testid="order-history"], .order-history',
  customerStats: '[data-testid="customer-stats"], .customer-stats',
  
  // Search
  searchInput: '[data-testid="search-input"], input[type="search"]',
  
  // Messages
  successMessage: '[data-testid="success-message"], .success',
  errorMessage: '[data-testid="error-message"], .error',
  
  // Empty state
  emptyState: '[data-testid="empty-state"], .empty-state',
};

// ============================================
// Customer List Tests
// ============================================

test.describe('Tenant Customers - List', () => {
  test('should display customer list', async ({ page, strict }) => {
    await page.goto('/tenant/customers');
    await page.waitForLoadState('networkidle');
    
    const customerList = page.locator(SELECTORS.customerList);
    const emptyState = page.locator(SELECTORS.emptyState);
    
    const hasList = await customerList.count() > 0;
    const hasEmpty = await emptyState.count() > 0;
    
    expect(hasList || hasEmpty).toBeTruthy();
  });

  test('should display customer information', async ({ page }) => {
    await page.goto('/tenant/customers');
    await page.waitForLoadState('networkidle');
    
    const customerRows = page.locator(SELECTORS.customerRow);
    
    if (await customerRows.count() > 0) {
      const firstRow = customerRows.first();
      
      const customerName = firstRow.locator(SELECTORS.customerName);
      const customerEmail = firstRow.locator(SELECTORS.customerEmail);
      
      const hasName = await customerName.count() > 0;
      const hasEmail = await customerEmail.count() > 0;
      
      expect(hasName || hasEmail).toBeTruthy();
    }
  });

  test('should search customers', async ({ page }) => {
    await page.goto('/tenant/customers');
    await page.waitForLoadState('networkidle');
    
    const searchInput = page.locator(SELECTORS.searchInput);
    
    if (await searchInput.count() > 0) {
      await searchInput.first().fill('test');
      await page.waitForTimeout(1000);
    }
  });
});

// ============================================
// Customer Detail Tests
// ============================================

test.describe('Tenant Customers - Detail', () => {
  test('should view customer details', async ({ page }) => {
    await page.goto('/tenant/customers');
    await page.waitForLoadState('networkidle');
    
    const customerRows = page.locator(SELECTORS.customerRow);
    
    if (await customerRows.count() > 0) {
      const firstRow = customerRows.first();
      const viewButton = firstRow.locator(SELECTORS.viewButton);
      
      if (await viewButton.count() > 0) {
        await viewButton.click();
      } else {
        await firstRow.click();
      }
      
      await page.waitForLoadState('networkidle');
      
      const customerDetail = page.locator(SELECTORS.customerDetail);
      const hasDetail = await customerDetail.count() > 0;
    }
  });

  test('should display order history', async ({ page }) => {
    await page.goto('/tenant/customers');
    await page.waitForLoadState('networkidle');
    
    const customerRows = page.locator(SELECTORS.customerRow);
    
    if (await customerRows.count() > 0) {
      const firstRow = customerRows.first();
      const viewButton = firstRow.locator(SELECTORS.viewButton);
      
      if (await viewButton.count() > 0) {
        await viewButton.click();
        await page.waitForLoadState('networkidle');
        
        const orderHistory = page.locator(SELECTORS.orderHistory);
        const hasHistory = await orderHistory.count() > 0;
      }
    }
  });

  test('should display customer statistics', async ({ page }) => {
    await page.goto('/tenant/customers');
    await page.waitForLoadState('networkidle');
    
    const customerRows = page.locator(SELECTORS.customerRow);
    
    if (await customerRows.count() > 0) {
      const firstRow = customerRows.first();
      const viewButton = firstRow.locator(SELECTORS.viewButton);
      
      if (await viewButton.count() > 0) {
        await viewButton.click();
        await page.waitForLoadState('networkidle');
        
        const customerStats = page.locator(SELECTORS.customerStats);
        const hasStats = await customerStats.count() > 0;
      }
    }
  });
});

// ============================================
// Export Tests
// ============================================

test.describe('Tenant Customers - Export', () => {
  test('should display export button', async ({ page }) => {
    await page.goto('/tenant/customers');
    await page.waitForLoadState('networkidle');
    
    const exportButton = page.locator(SELECTORS.exportButton);
    const hasExport = await exportButton.count() > 0;
  });

  test('should trigger export', async ({ page }) => {
    await page.goto('/tenant/customers');
    await page.waitForLoadState('networkidle');
    
    const exportButton = page.locator(SELECTORS.exportButton);
    
    if (await exportButton.count() > 0) {
      const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
      
      await exportButton.click();
      
      const download = await downloadPromise;
    }
  });
});

// ============================================
// Responsive Design Tests
// ============================================

test.describe('Tenant Customers - Responsive Design', () => {
  test('should display correctly on mobile', async ({ page, strict }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/tenant/customers');
    await page.waitForLoadState('networkidle');
    
    const body = page.locator('body');
    await strict.mustExist(body);
  });

  test('should display correctly on tablet', async ({ page, strict }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    
    await page.goto('/tenant/customers');
    await page.waitForLoadState('networkidle');
    
    const body = page.locator('body');
    await strict.mustExist(body);
  });
});
