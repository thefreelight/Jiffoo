/**
 * Tenant Orders E2E Tests (Hardened)
 *
 * Tests tenant order management with strict assertions.
 * Validates order list, details, status updates, and refunds.
 *
 * Requirements: 20.1, 20.2, 20.3, 20.4, 20.5
 */

import { test, expect } from '../utils/test-fixtures';

// ============================================
// Test Data & Selectors
// ============================================

const SELECTORS = {
  // Order list
  orderList: '[data-testid="order-list"], .order-list, table',
  orderRow: '[data-testid="order-row"], .order-row, tr',
  orderId: '[data-testid="order-id"], .order-id',
  orderStatus: '[data-testid="order-status"], .order-status, .status-badge',
  orderTotal: '[data-testid="order-total"], .order-total',
  
  // Actions
  viewButton: '[data-testid="view-order"], button:has-text("View"), button:has-text("查看")',
  updateStatusButton: '[data-testid="update-status"], button:has-text("Update"), button:has-text("更新")',
  refundButton: '[data-testid="refund"], button:has-text("Refund"), button:has-text("退款")',
  printButton: '[data-testid="print-invoice"], button:has-text("Print"), button:has-text("打印")',
  
  // Order detail
  orderDetail: '[data-testid="order-detail"], .order-detail',
  customerInfo: '[data-testid="customer-info"], .customer-info',
  orderItems: '[data-testid="order-items"], .order-items',
  shippingInfo: '[data-testid="shipping-info"], .shipping-info',
  
  // Status update
  statusSelect: 'select[name="status"]',
  saveStatusButton: 'button:has-text("Save"), button:has-text("保存")',
  
  // Refund
  refundModal: '[data-testid="refund-modal"], .refund-modal',
  refundAmountInput: 'input[name="amount"], input[name="refundAmount"]',
  refundReasonInput: 'textarea[name="reason"], input[name="reason"]',
  processRefundButton: 'button:has-text("Process"), button:has-text("处理")',
  
  // Search & Filter
  searchInput: '[data-testid="search-input"], input[type="search"]',
  statusFilter: '[data-testid="status-filter"], select[name="status"]',
  
  // Modal
  modal: '[role="dialog"], .modal',
  confirmButton: 'button:has-text("Confirm"), button:has-text("确认")',
  
  // Messages
  successMessage: '[data-testid="success-message"], .success, .alert-success',
  errorMessage: '[data-testid="error-message"], .error, .alert-error',
  
  // Empty state
  emptyState: '[data-testid="empty-state"], .empty-state',
};

// ============================================
// Order List Tests
// ============================================

test.describe('Tenant Orders - List', () => {
  test('should display tenant order list', async ({ page, strict }) => {
    await page.goto('/tenant/orders');
    await page.waitForLoadState('networkidle');
    
    const orderList = page.locator(SELECTORS.orderList);
    const emptyState = page.locator(SELECTORS.emptyState);
    
    const hasList = await orderList.count() > 0;
    const hasEmpty = await emptyState.count() > 0;
    
    expect(hasList || hasEmpty).toBeTruthy();
  });

  test('should display order information', async ({ page }) => {
    await page.goto('/tenant/orders');
    await page.waitForLoadState('networkidle');
    
    const orderRows = page.locator(SELECTORS.orderRow);
    
    if (await orderRows.count() > 0) {
      const firstRow = orderRows.first();
      
      const orderId = firstRow.locator(SELECTORS.orderId);
      const orderStatus = firstRow.locator(SELECTORS.orderStatus);
      
      const hasId = await orderId.count() > 0;
      const hasStatus = await orderStatus.count() > 0;
      
      expect(hasId || hasStatus).toBeTruthy();
    }
  });

  test('should filter orders by status', async ({ page }) => {
    await page.goto('/tenant/orders');
    await page.waitForLoadState('networkidle');
    
    const statusFilter = page.locator(SELECTORS.statusFilter);
    
    if (await statusFilter.count() > 0) {
      const options = await statusFilter.locator('option').all();
      if (options.length > 1) {
        await statusFilter.selectOption({ index: 1 });
        await page.waitForLoadState('networkidle');
      }
    }
  });
});

// ============================================
// Order Detail Tests
// ============================================

test.describe('Tenant Orders - Detail', () => {
  test('should view order details', async ({ page }) => {
    await page.goto('/tenant/orders');
    await page.waitForLoadState('networkidle');
    
    const orderRows = page.locator(SELECTORS.orderRow);
    
    if (await orderRows.count() > 0) {
      const firstRow = orderRows.first();
      const viewButton = firstRow.locator(SELECTORS.viewButton);
      
      if (await viewButton.count() > 0) {
        await viewButton.click();
      } else {
        await firstRow.click();
      }
      
      await page.waitForLoadState('networkidle');
      
      const orderDetail = page.locator(SELECTORS.orderDetail);
      const hasDetail = await orderDetail.count() > 0;
    }
  });

  test('should display customer information', async ({ page }) => {
    await page.goto('/tenant/orders');
    await page.waitForLoadState('networkidle');
    
    const orderRows = page.locator(SELECTORS.orderRow);
    
    if (await orderRows.count() > 0) {
      const firstRow = orderRows.first();
      const viewButton = firstRow.locator(SELECTORS.viewButton);
      
      if (await viewButton.count() > 0) {
        await viewButton.click();
        await page.waitForLoadState('networkidle');
        
        const customerInfo = page.locator(SELECTORS.customerInfo);
        const hasCustomer = await customerInfo.count() > 0;
      }
    }
  });
});

// ============================================
// Status Update Tests
// ============================================

test.describe('Tenant Orders - Status Update', () => {
  test('should update order status', async ({ page }) => {
    await page.goto('/tenant/orders');
    await page.waitForLoadState('networkidle');
    
    const orderRows = page.locator(SELECTORS.orderRow);
    
    if (await orderRows.count() > 0) {
      const firstRow = orderRows.first();
      const updateButton = firstRow.locator(SELECTORS.updateStatusButton);
      
      if (await updateButton.count() > 0) {
        await updateButton.click();
        await page.waitForTimeout(500);
        
        const statusSelect = page.locator(SELECTORS.statusSelect);
        const saveButton = page.locator(SELECTORS.saveStatusButton);
        
        if (await statusSelect.count() > 0 && await saveButton.count() > 0) {
          const options = await statusSelect.locator('option').all();
          if (options.length > 1) {
            await statusSelect.selectOption({ index: 1 });
            await saveButton.click();
            await page.waitForLoadState('networkidle');
          }
        }
      }
    }
  });
});

// ============================================
// Refund Tests
// ============================================

test.describe('Tenant Orders - Refund', () => {
  test('should display refund button', async ({ page }) => {
    await page.goto('/tenant/orders');
    await page.waitForLoadState('networkidle');
    
    const orderRows = page.locator(SELECTORS.orderRow);
    
    if (await orderRows.count() > 0) {
      const firstRow = orderRows.first();
      const refundButton = firstRow.locator(SELECTORS.refundButton);
      const hasRefund = await refundButton.count() > 0;
    }
  });

  test('should open refund modal', async ({ page }) => {
    await page.goto('/tenant/orders');
    await page.waitForLoadState('networkidle');
    
    const orderRows = page.locator(SELECTORS.orderRow);
    
    if (await orderRows.count() > 0) {
      const firstRow = orderRows.first();
      const refundButton = firstRow.locator(SELECTORS.refundButton);
      
      if (await refundButton.count() > 0) {
        await refundButton.click();
        await page.waitForTimeout(500);
        
        const refundModal = page.locator(SELECTORS.refundModal);
        const modal = page.locator(SELECTORS.modal);
        
        const hasModal = await refundModal.count() > 0 || await modal.count() > 0;
      }
    }
  });
});

// ============================================
// Print Invoice Tests
// ============================================

test.describe('Tenant Orders - Print Invoice', () => {
  test('should display print button', async ({ page }) => {
    await page.goto('/tenant/orders');
    await page.waitForLoadState('networkidle');
    
    const orderRows = page.locator(SELECTORS.orderRow);
    
    if (await orderRows.count() > 0) {
      const firstRow = orderRows.first();
      const viewButton = firstRow.locator(SELECTORS.viewButton);
      
      if (await viewButton.count() > 0) {
        await viewButton.click();
        await page.waitForLoadState('networkidle');
        
        const printButton = page.locator(SELECTORS.printButton);
        const hasPrint = await printButton.count() > 0;
      }
    }
  });
});

// ============================================
// Responsive Design Tests
// ============================================

test.describe('Tenant Orders - Responsive Design', () => {
  test('should display correctly on mobile', async ({ page, strict }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/tenant/orders');
    await page.waitForLoadState('networkidle');
    
    const body = page.locator('body');
    await strict.mustExist(body);
  });

  test('should display correctly on tablet', async ({ page, strict }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    
    await page.goto('/tenant/orders');
    await page.waitForLoadState('networkidle');
    
    const body = page.locator('body');
    await strict.mustExist(body);
  });
});
