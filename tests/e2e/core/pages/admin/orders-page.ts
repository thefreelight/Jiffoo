import { Page, Locator, expect } from '@playwright/test';

/**
 * AdminOrdersPage - Page Object for admin order management
 * 
 * Encapsulates interactions with order listing and management
 */
export class AdminOrdersPage {
  readonly page: Page;
  
  // Page header
  readonly pageTitle: Locator;
  
  // Search and filters
  readonly searchInput: Locator;
  readonly statusFilter: Locator;
  readonly dateFilter: Locator;
  
  // Order table
  readonly orderTable: Locator;
  readonly orderRows: Locator;
  readonly orderIds: Locator;
  readonly orderStatus: Locator;
  readonly orderTotals: Locator;
  readonly orderDates: Locator;
  
  // Actions
  readonly viewButtons: Locator;
  readonly updateStatusButtons: Locator;
  
  // Status update modal
  readonly statusModal: Locator;
  readonly statusSelect: Locator;
  readonly saveStatusButton: Locator;
  readonly cancelButton: Locator;
  
  // Pagination
  readonly pagination: Locator;
  readonly prevPageButton: Locator;
  readonly nextPageButton: Locator;
  
  // Empty state
  readonly emptyState: Locator;

  constructor(page: Page) {
    this.page = page;
    
    // Header
    this.pageTitle = page.locator('h1, [data-testid="page-title"]');
    
    // Search/Filter
    this.searchInput = page.locator('[data-testid="search"], input[placeholder*="search" i], input[name="search"]');
    this.statusFilter = page.locator('[data-testid="status-filter"], select[name="status"]');
    this.dateFilter = page.locator('[data-testid="date-filter"], input[type="date"]');
    
    // Table
    this.orderTable = page.locator('table, [data-testid="orders-table"], .orders-list');
    this.orderRows = page.locator('tbody tr, [data-testid="order-row"], .order-item');
    this.orderIds = page.locator('[data-testid="order-id"], .order-id');
    this.orderStatus = page.locator('[data-testid="order-status"], .order-status, .status-badge');
    this.orderTotals = page.locator('[data-testid="order-total"], .order-total');
    this.orderDates = page.locator('[data-testid="order-date"], .order-date');
    
    // Actions
    this.viewButtons = page.locator('[data-testid="view-order"], button:has-text("View"), a:has-text("View")');
    this.updateStatusButtons = page.locator('[data-testid="update-status"], button:has-text("Update Status")');
    
    // Modal
    this.statusModal = page.locator('[data-testid="status-modal"], .modal, [role="dialog"]');
    this.statusSelect = page.locator('[data-testid="status-select"], select[name="status"]');
    this.saveStatusButton = page.locator('[data-testid="save-status"], button:has-text("Save"), button:has-text("Update")');
    this.cancelButton = page.locator('[data-testid="cancel"], button:has-text("Cancel")');
    
    // Pagination
    this.pagination = page.locator('[data-testid="pagination"], .pagination');
    this.prevPageButton = page.locator('[data-testid="prev-page"], button:has-text("Previous")');
    this.nextPageButton = page.locator('[data-testid="next-page"], button:has-text("Next")');
    
    // Empty
    this.emptyState = page.locator('[data-testid="empty-state"], .empty-state, :text("No orders")');
  }

  /**
   * Navigate to orders page
   */
  async goto(): Promise<void> {
    await this.page.goto('/orders');
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Wait for page to load
   */
  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get order count
   */
  async getOrderCount(): Promise<number> {
    return this.orderRows.count();
  }

  /**
   * Check if orders list is empty
   */
  async isEmpty(): Promise<boolean> {
    const emptyVisible = await this.emptyState.isVisible().catch(() => false);
    if (emptyVisible) return true;
    return (await this.getOrderCount()) === 0;
  }

  /**
   * Search for orders
   */
  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.searchInput.press('Enter');
    await this.page.waitForTimeout(500);
  }

  /**
   * View order by index
   */
  async viewOrder(index: number): Promise<void> {
    await this.viewButtons.nth(index).click();
  }

  /**
   * Get order ID by index
   */
  async getOrderId(index: number): Promise<string | null> {
    return this.orderIds.nth(index).textContent();
  }

  /**
   * Get order status by index
   */
  async getOrderStatus(index: number): Promise<string | null> {
    return this.orderStatus.nth(index).textContent();
  }

  /**
   * Filter by status
   */
  async filterByStatus(status: string): Promise<void> {
    await this.statusFilter.selectOption(status);
    await this.page.waitForTimeout(500);
  }

  /**
   * Update order status
   */
  async updateStatus(index: number, newStatus: string): Promise<void> {
    await this.updateStatusButtons.nth(index).click();
    await this.statusModal.waitFor({ state: 'visible' });
    await this.statusSelect.selectOption(newStatus);
    await this.saveStatusButton.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Verify orders are displayed
   */
  async verifyOrdersDisplayed(): Promise<void> {
    const count = await this.getOrderCount();
    expect(count).toBeGreaterThan(0);
  }

  /**
   * Go to next page
   */
  async nextPage(): Promise<void> {
    await this.nextPageButton.click();
    await this.page.waitForTimeout(500);
  }
}
