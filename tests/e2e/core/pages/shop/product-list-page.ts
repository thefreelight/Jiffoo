import { Page, Locator, expect } from '@playwright/test';

/**
 * ProductListPage - Page Object for product listing/search results
 * 
 * Encapsulates interactions with:
 * - Product grid
 * - Filters (category, price, etc.)
 * - Sorting
 * - Pagination
 */
export class ProductListPage {
  readonly page: Page;
  
  // Product grid
  readonly productGrid: Locator;
  readonly productCards: Locator;
  readonly productNames: Locator;
  readonly productPrices: Locator;
  readonly productImages: Locator;
  
  // Filters
  readonly filterSidebar: Locator;
  readonly categoryFilter: Locator;
  readonly priceFilter: Locator;
  readonly priceMinInput: Locator;
  readonly priceMaxInput: Locator;
  readonly applyFiltersButton: Locator;
  readonly clearFiltersButton: Locator;
  
  // Sorting
  readonly sortDropdown: Locator;
  readonly sortOptions: Locator;
  
  // Pagination
  readonly pagination: Locator;
  readonly prevPageButton: Locator;
  readonly nextPageButton: Locator;
  readonly pageNumbers: Locator;
  
  // Results info
  readonly resultsCount: Locator;
  readonly noResultsMessage: Locator;
  
  // Loading state
  readonly loadingSpinner: Locator;

  constructor(page: Page) {
    this.page = page;
    
    // Product grid
    this.productGrid = page.locator('[data-testid="product-grid"], .product-grid, .products-container');
    this.productCards = page.locator('[data-testid="product-card"], .product-card, article');
    this.productNames = page.locator('[data-testid="product-name"], .product-name, .product-card h3, .product-card h2');
    this.productPrices = page.locator('[data-testid="product-price"], .product-price, .price');
    this.productImages = page.locator('[data-testid="product-image"], .product-card img');
    
    // Filters
    this.filterSidebar = page.locator('[data-testid="filters"], .filters, aside');
    this.categoryFilter = page.locator('[data-testid="category-filter"], .category-filter');
    this.priceFilter = page.locator('[data-testid="price-filter"], .price-filter');
    this.priceMinInput = page.locator('[data-testid="price-min"], input[name="minPrice"], input[placeholder*="min" i]');
    this.priceMaxInput = page.locator('[data-testid="price-max"], input[name="maxPrice"], input[placeholder*="max" i]');
    this.applyFiltersButton = page.locator('[data-testid="apply-filters"], button:has-text("Apply")');
    this.clearFiltersButton = page.locator('[data-testid="clear-filters"], button:has-text("Clear")');
    
    // Sorting
    this.sortDropdown = page.locator('[data-testid="sort-dropdown"], select[name="sort"], .sort-select');
    this.sortOptions = page.locator('[data-testid="sort-option"], option');
    
    // Pagination
    this.pagination = page.locator('[data-testid="pagination"], .pagination, nav[aria-label*="pagination" i]');
    this.prevPageButton = page.locator('[data-testid="prev-page"], button:has-text("Previous"), a:has-text("Previous")');
    this.nextPageButton = page.locator('[data-testid="next-page"], button:has-text("Next"), a:has-text("Next")');
    this.pageNumbers = page.locator('[data-testid="page-number"], .pagination button, .pagination a');
    
    // Results info
    this.resultsCount = page.locator('[data-testid="results-count"], .results-count');
    this.noResultsMessage = page.locator('[data-testid="no-results"], .no-results, :text("No products found")');
    
    // Loading
    this.loadingSpinner = page.locator('[data-testid="loading"], .loading, .spinner');
  }

  /**
   * Navigate to products page
   */
  async goto(locale: string = 'en'): Promise<void> {
    await this.page.goto(`/${locale}/products`);
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Navigate to category page
   */
  async gotoCategory(category: string, locale: string = 'en'): Promise<void> {
    await this.page.goto(`/${locale}/categories/${category}`);
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Navigate to search results
   */
  async gotoSearch(query: string, locale: string = 'en'): Promise<void> {
    await this.page.goto(`/${locale}/search?q=${encodeURIComponent(query)}`);
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Wait for products to load
   */
  async waitForProducts(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    // Wait for either products or no results message
    await Promise.race([
      this.productCards.first().waitFor({ state: 'visible', timeout: 10000 }),
      this.noResultsMessage.waitFor({ state: 'visible', timeout: 10000 }),
    ]).catch(() => {});
  }

  /**
   * Get number of products displayed
   */
  async getProductCount(): Promise<number> {
    return this.productCards.count();
  }

  /**
   * Check if no results message is shown
   */
  async hasNoResults(): Promise<boolean> {
    return this.noResultsMessage.isVisible();
  }

  /**
   * Click on a product by index
   */
  async clickProduct(index: number = 0): Promise<void> {
    await this.productCards.nth(index).click();
    await this.page.waitForURL(/products\/[^/]+/);
  }

  /**
   * Get product name by index
   */
  async getProductName(index: number = 0): Promise<string | null> {
    return this.productNames.nth(index).textContent();
  }

  /**
   * Get product price by index
   */
  async getProductPrice(index: number = 0): Promise<string | null> {
    return this.productPrices.nth(index).textContent();
  }

  /**
   * Sort products by option
   */
  async sortBy(option: string): Promise<void> {
    await this.sortDropdown.selectOption(option);
    await this.waitForProducts();
  }

  /**
   * Filter by price range
   */
  async filterByPrice(min: number, max: number): Promise<void> {
    await this.priceMinInput.fill(min.toString());
    await this.priceMaxInput.fill(max.toString());
    
    if (await this.applyFiltersButton.isVisible()) {
      await this.applyFiltersButton.click();
    }
    
    await this.waitForProducts();
  }

  /**
   * Clear all filters
   */
  async clearFilters(): Promise<void> {
    if (await this.clearFiltersButton.isVisible()) {
      await this.clearFiltersButton.click();
      await this.waitForProducts();
    }
  }

  /**
   * Go to next page
   */
  async nextPage(): Promise<void> {
    await this.nextPageButton.click();
    await this.waitForProducts();
  }

  /**
   * Go to previous page
   */
  async prevPage(): Promise<void> {
    await this.prevPageButton.click();
    await this.waitForProducts();
  }

  /**
   * Go to specific page
   */
  async goToPage(pageNumber: number): Promise<void> {
    await this.pageNumbers.filter({ hasText: pageNumber.toString() }).click();
    await this.waitForProducts();
  }

  /**
   * Check if pagination is visible
   */
  async hasPagination(): Promise<boolean> {
    return this.pagination.isVisible();
  }

  /**
   * Verify products are displayed
   */
  async verifyProductsDisplayed(): Promise<void> {
    const count = await this.getProductCount();
    expect(count).toBeGreaterThan(0);
  }

  /**
   * Get all product names
   */
  async getAllProductNames(): Promise<string[]> {
    const names: string[] = [];
    const count = await this.productNames.count();
    
    for (let i = 0; i < count; i++) {
      const name = await this.productNames.nth(i).textContent();
      if (name) names.push(name.trim());
    }
    
    return names;
  }
}
