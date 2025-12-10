import { Page, Locator, expect } from '@playwright/test';

/**
 * AdminProductsPage - Page Object for admin products management
 */
export class AdminProductsPage {
  readonly page: Page;

  // Table elements
  readonly productsTable: Locator;
  readonly tableRows: Locator;
  readonly searchInput: Locator;
  readonly filterDropdown: Locator;

  // Actions
  readonly addProductButton: Locator;
  readonly bulkDeleteButton: Locator;
  readonly exportButton: Locator;

  // Pagination
  readonly pagination: Locator;
  readonly nextPageButton: Locator;
  readonly prevPageButton: Locator;

  // Modal/Form
  readonly productForm: Locator;
  readonly nameInput: Locator;
  readonly priceInput: Locator;
  readonly descriptionInput: Locator;
  readonly stockInput: Locator;
  readonly saveButton: Locator;
  readonly cancelButton: Locator;

  // Messages
  readonly successToast: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;

    // Table
    this.productsTable = page.locator('table, [data-testid="products-table"]');
    this.tableRows = page.locator('tbody tr, [data-testid="product-row"]');
    this.searchInput = page.locator('input[placeholder*="search" i], [data-testid="search-input"]');
    this.filterDropdown = page.locator('[data-testid="filter-dropdown"], select[name="category"]');

    // Actions
    this.addProductButton = page.locator('button:has-text("Add"), button:has-text("New Product"), [data-testid="add-product"]');
    this.bulkDeleteButton = page.locator('button:has-text("Delete Selected"), [data-testid="bulk-delete"]');
    this.exportButton = page.locator('button:has-text("Export"), [data-testid="export"]');

    // Pagination
    this.pagination = page.locator('[data-testid="pagination"], .pagination, nav[aria-label="pagination"]');
    this.nextPageButton = page.locator('button:has-text("Next"), [aria-label="Next page"]');
    this.prevPageButton = page.locator('button:has-text("Previous"), [aria-label="Previous page"]');

    // Form
    this.productForm = page.locator('form, [data-testid="product-form"]');
    this.nameInput = page.locator('input[name="name"], [data-testid="name-input"]');
    this.priceInput = page.locator('input[name="price"], [data-testid="price-input"]');
    this.descriptionInput = page.locator('textarea[name="description"], [data-testid="description-input"]');
    this.stockInput = page.locator('input[name="stock"], input[name="quantity"], [data-testid="stock-input"]');
    this.saveButton = page.locator('button[type="submit"], button:has-text("Save"), [data-testid="save-button"]');
    this.cancelButton = page.locator('button:has-text("Cancel"), [data-testid="cancel-button"]');

    // Messages
    this.successToast = page.locator('[role="status"]:has-text("success"), .toast-success, [data-testid="success-toast"]');
    this.errorMessage = page.locator('[role="alert"], .error-message, [data-testid="error-message"]');
  }

  async goto(): Promise<void> {
    await this.page.goto('/products');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  async getProductCount(): Promise<number> {
    return this.tableRows.count();
  }

  async searchProducts(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(500);
  }

  async clickAddProduct(): Promise<void> {
    await this.addProductButton.click();
  }

  async fillProductForm(data: { name: string; price: string; description?: string; stock?: string }): Promise<void> {
    await this.nameInput.fill(data.name);
    await this.priceInput.fill(data.price);
    if (data.description) await this.descriptionInput.fill(data.description);
    if (data.stock) await this.stockInput.fill(data.stock);
  }

  async saveProduct(): Promise<void> {
    await this.saveButton.click();
  }

  async editProductByIndex(index: number): Promise<void> {
    const row = this.tableRows.nth(index);
    const editButton = row.locator('button:has-text("Edit"), [data-testid="edit-button"]');
    await editButton.click();
  }

  async deleteProductByIndex(index: number): Promise<void> {
    const row = this.tableRows.nth(index);
    const deleteButton = row.locator('button:has-text("Delete"), [data-testid="delete-button"]');
    await deleteButton.click();
    const confirmButton = this.page.locator('button:has-text("Confirm"), button:has-text("Yes")');
    if (await confirmButton.isVisible()) {
      await confirmButton.click();
    }
  }

  async verifyProductInList(productName: string): Promise<boolean> {
    const productRow = this.page.locator(`tr:has-text("${productName}")`);
    return productRow.isVisible();
  }
}