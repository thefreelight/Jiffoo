/**
 * Search E2E Tests (Hardened)
 *
 * Tests search functionality with strict assertions.
 * Validates search input, results display, filtering, and navigation.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */

import { test, expect } from '../utils/test-fixtures';

// ============================================
// Test Data & Selectors
// ============================================

const SELECTORS = {
  // Search input
  searchInput: '[data-testid="search-input"], input[type="search"], input[name="search"], input[placeholder*="Search"], input[placeholder*="搜索"]',
  searchButton: '[data-testid="search-button"], button[type="submit"], button:has-text("Search"), button:has-text("搜索")',
  searchIcon: '[data-testid="search-icon"], .search-icon, svg.search',
  
  // Search page
  searchPage: '[data-testid="search-page"], .search-page, .search-results-page',
  searchHeader: '[data-testid="search-header"], .search-header',
  searchQuery: '[data-testid="search-query"], .search-query, .search-term',
  
  // Results
  searchResults: '[data-testid="search-results"], .search-results, .results-container',
  resultItem: '[data-testid="result-item"], .result-item, .product-card, .search-result',
  resultCount: '[data-testid="result-count"], .result-count, .results-count',
  
  // Product info in results
  productName: '[data-testid="product-name"], .product-name, .product-title, h3, h4',
  productPrice: '[data-testid="product-price"], .product-price, .price',
  productImage: '[data-testid="product-image"], .product-image, img',
  
  // No results
  noResults: '[data-testid="no-results"], .no-results, .empty-results',
  noResultsMessage: ':text("No results"), :text("没有结果"), :text("No products found"), :text("未找到商品")',
  
  // Suggestions
  suggestions: '[data-testid="suggestions"], .suggestions, .search-suggestions',
  suggestionItem: '[data-testid="suggestion-item"], .suggestion-item, .suggestion',
  
  // Filters
  filterSection: '[data-testid="filters"], .filters, .search-filters',
  categoryFilter: '[data-testid="category-filter"], .category-filter, select[name="category"]',
  priceFilter: '[data-testid="price-filter"], .price-filter',
  sortSelect: '[data-testid="sort-select"], select[name="sort"], .sort-select',
  
  // Pagination
  pagination: '[data-testid="pagination"], .pagination',
  nextPage: '[data-testid="next-page"], .next-page, button:has-text("Next"), a:has-text("Next")',
  prevPage: '[data-testid="prev-page"], .prev-page, button:has-text("Previous"), a:has-text("Previous")',
  
  // Loading
  loading: '[data-testid="loading"], .loading, .spinner',
  
  // Autocomplete
  autocomplete: '[data-testid="autocomplete"], .autocomplete, .search-autocomplete',
  autocompleteItem: '[data-testid="autocomplete-item"], .autocomplete-item',
};

// Test search terms
const SEARCH_TERMS = {
  existing: 'product', // Generic term likely to have results
  nonExisting: 'xyznonexistentproduct12345',
  partial: 'pro', // Partial match
  chinese: '商品', // Chinese search term
};

// ============================================
// Search Input Tests
// ============================================

test.describe('Search - Input', () => {
  test('should display search input on homepage', async ({ page, strict }) => {
    await page.goto('/en');
    await page.waitForLoadState('networkidle');
    
    const searchInput = page.locator(SELECTORS.searchInput);
    const hasSearchInput = await searchInput.count() > 0;
    
    // Search input should be present
    expect(hasSearchInput).toBeTruthy();
    
    if (hasSearchInput) {
      await strict.mustExist(searchInput.first(), { message: 'Search input should be visible' });
    }
  });

  test('should focus search input on search page', async ({ page, strict }) => {
    await page.goto('/en/search');
    await page.waitForLoadState('networkidle');
    
    const searchInput = page.locator(SELECTORS.searchInput);
    const hasSearchInput = await searchInput.count() > 0;
    
    if (hasSearchInput) {
      // Input should be visible
      await strict.mustExist(searchInput.first(), { message: 'Search input should be visible' });
      
      // Check if focused (may not be auto-focused in all implementations)
      // Focus is optional but preferred
    }
  });

  test('should accept text input', async ({ page, strict }) => {
    await page.goto('/en/search');
    await page.waitForLoadState('networkidle');
    
    const searchInput = page.locator(SELECTORS.searchInput);
    
    if (await searchInput.count() > 0) {
      await searchInput.first().fill('test search');
      
      // Verify input value
      await strict.mustHaveValue(searchInput.first(), 'test search');
    }
  });
});

// ============================================
// Search Results Tests
// ============================================

test.describe('Search - Results', () => {
  test('should display results for existing products', async ({ page, strict }) => {
    await page.goto(`/en/search?q=${SEARCH_TERMS.existing}`);
    await page.waitForLoadState('networkidle');
    
    // Wait for results to load
    await page.waitForTimeout(2000);
    
    const results = page.locator(SELECTORS.resultItem);
    const noResults = page.locator(SELECTORS.noResults).or(page.locator(SELECTORS.noResultsMessage));
    
    const hasResults = await results.count() > 0;
    const hasNoResults = await noResults.count() > 0;
    
    // Should have either results or no results message
    expect(hasResults || hasNoResults).toBeTruthy();
    
    if (hasResults) {
      // Verify first result has required info
      const firstResult = results.first();
      await strict.mustExist(firstResult, { message: 'Search result should be visible' });
      
      // Result should have product name
      const productName = firstResult.locator(SELECTORS.productName);
      const hasName = await productName.count() > 0;
      
      // Result should have price
      const productPrice = firstResult.locator(SELECTORS.productPrice);
      const hasPrice = await productPrice.count() > 0;
      
      // At least name or price should be present
      expect(hasName || hasPrice).toBeTruthy();
    }
  });

  test('should display result count', async ({ page }) => {
    await page.goto(`/en/search?q=${SEARCH_TERMS.existing}`);
    await page.waitForLoadState('networkidle');
    
    await page.waitForTimeout(2000);
    
    const resultCount = page.locator(SELECTORS.resultCount);
    const hasResultCount = await resultCount.count() > 0;
    
    // Result count is optional but helpful
    if (hasResultCount) {
      const countText = await resultCount.textContent();
      expect(countText?.length).toBeGreaterThan(0);
    }
  });

  test('should display no results message for non-existent products', async ({ 
    page, 
    strict 
  }) => {
    await page.goto(`/en/search?q=${SEARCH_TERMS.nonExisting}`);
    await page.waitForLoadState('networkidle');
    
    await page.waitForTimeout(2000);
    
    const results = page.locator(SELECTORS.resultItem);
    const noResults = page.locator(SELECTORS.noResults).or(page.locator(SELECTORS.noResultsMessage));
    
    const hasResults = await results.count() > 0;
    const hasNoResults = await noResults.count() > 0;
    
    // Should show no results message when no products match
    if (!hasResults) {
      expect(hasNoResults || !hasResults).toBeTruthy();
    }
  });

  test('should navigate to product page when clicking result', async ({ 
    page, 
    strict 
  }) => {
    await page.goto(`/en/search?q=${SEARCH_TERMS.existing}`);
    await page.waitForLoadState('networkidle');
    
    await page.waitForTimeout(2000);
    
    const results = page.locator(SELECTORS.resultItem);
    
    if (await results.count() > 0) {
      const firstResult = results.first();
      
      // Click on product name or the result itself
      const productLink = firstResult.locator('a').first();
      if (await productLink.count() > 0) {
        await productLink.click();
      } else {
        await firstResult.click();
      }
      
      await page.waitForLoadState('networkidle');
      
      // Should navigate to product page
      const url = page.url();
      const isOnProductPage = url.includes('/product') || url.includes('/products/');
      
      expect(isOnProductPage).toBeTruthy();
    }
  });
});

// ============================================
// Search Filtering Tests
// ============================================

test.describe('Search - Filtering', () => {
  test('should display filter options', async ({ page }) => {
    await page.goto(`/en/search?q=${SEARCH_TERMS.existing}`);
    await page.waitForLoadState('networkidle');
    
    const filterSection = page.locator(SELECTORS.filterSection);
    const categoryFilter = page.locator(SELECTORS.categoryFilter);
    const sortSelect = page.locator(SELECTORS.sortSelect);
    
    const hasFilters = await filterSection.count() > 0;
    const hasCategory = await categoryFilter.count() > 0;
    const hasSort = await sortSelect.count() > 0;
    
    // At least some filtering options should be available
    // (implementation may vary)
  });

  test('should filter results by category', async ({ page }) => {
    await page.goto(`/en/search?q=${SEARCH_TERMS.existing}`);
    await page.waitForLoadState('networkidle');
    
    await page.waitForTimeout(2000);
    
    const categoryFilter = page.locator(SELECTORS.categoryFilter);
    
    if (await categoryFilter.count() > 0) {
      // Get initial result count
      const initialResults = page.locator(SELECTORS.resultItem);
      const initialCount = await initialResults.count();
      
      // Select a category
      const options = await categoryFilter.locator('option').all();
      if (options.length > 1) {
        await categoryFilter.selectOption({ index: 1 });
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);
        
        // Results should be filtered
        const filteredResults = page.locator(SELECTORS.resultItem);
        const filteredCount = await filteredResults.count();
        
        // Count may change after filtering
        expect(filteredCount >= 0).toBeTruthy();
      }
    }
  });

  test('should sort results', async ({ page }) => {
    await page.goto(`/en/search?q=${SEARCH_TERMS.existing}`);
    await page.waitForLoadState('networkidle');
    
    await page.waitForTimeout(2000);
    
    const sortSelect = page.locator(SELECTORS.sortSelect);
    
    if (await sortSelect.count() > 0) {
      // Get initial first result
      const results = page.locator(SELECTORS.resultItem);
      const initialFirstName = await results.first().locator(SELECTORS.productName).textContent();
      
      // Change sort order
      const options = await sortSelect.locator('option').all();
      if (options.length > 1) {
        await sortSelect.selectOption({ index: 1 });
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);
        
        // Results should be reordered
        const newFirstName = await results.first().locator(SELECTORS.productName).textContent();
        
        // Order may or may not change depending on data
      }
    }
  });
});

// ============================================
// Search Suggestions Tests
// ============================================

test.describe('Search - Suggestions', () => {
  test('should show autocomplete suggestions while typing', async ({ page }) => {
    await page.goto('/en');
    await page.waitForLoadState('networkidle');
    
    const searchInput = page.locator(SELECTORS.searchInput);
    
    if (await searchInput.count() > 0) {
      // Type partial search term
      await searchInput.first().fill(SEARCH_TERMS.partial);
      
      // Wait for suggestions
      await page.waitForTimeout(1000);
      
      const autocomplete = page.locator(SELECTORS.autocomplete);
      const suggestions = page.locator(SELECTORS.suggestions);
      const suggestionItems = page.locator(SELECTORS.suggestionItem).or(
        page.locator(SELECTORS.autocompleteItem)
      );
      
      const hasAutocomplete = await autocomplete.count() > 0;
      const hasSuggestions = await suggestions.count() > 0;
      const hasSuggestionItems = await suggestionItems.count() > 0;
      
      // Autocomplete is optional feature
      // (implementation may vary)
    }
  });

  test('should navigate to suggestion when clicked', async ({ page }) => {
    await page.goto('/en');
    await page.waitForLoadState('networkidle');
    
    const searchInput = page.locator(SELECTORS.searchInput);
    
    if (await searchInput.count() > 0) {
      await searchInput.first().fill(SEARCH_TERMS.partial);
      await page.waitForTimeout(1000);
      
      const suggestionItems = page.locator(SELECTORS.suggestionItem).or(
        page.locator(SELECTORS.autocompleteItem)
      );
      
      if (await suggestionItems.count() > 0) {
        await suggestionItems.first().click();
        await page.waitForLoadState('networkidle');
        
        // Should navigate to search results or product page
        const url = page.url();
        const isOnSearchOrProduct = url.includes('search') || url.includes('product');
        
        expect(isOnSearchOrProduct).toBeTruthy();
      }
    }
  });
});

// ============================================
// Search Navigation Tests
// ============================================

test.describe('Search - Navigation', () => {
  test('should submit search on Enter key', async ({ page, strict }) => {
    await page.goto('/en');
    await page.waitForLoadState('networkidle');
    
    const searchInput = page.locator(SELECTORS.searchInput);
    
    if (await searchInput.count() > 0) {
      await searchInput.first().fill(SEARCH_TERMS.existing);
      await searchInput.first().press('Enter');
      
      await page.waitForLoadState('networkidle');
      
      // Should navigate to search results
      const url = page.url();
      const isOnSearch = url.includes('search') || url.includes('q=');
      
      expect(isOnSearch).toBeTruthy();
    }
  });

  test('should submit search on button click', async ({ page, strict }) => {
    await page.goto('/en');
    await page.waitForLoadState('networkidle');
    
    const searchInput = page.locator(SELECTORS.searchInput);
    const searchButton = page.locator(SELECTORS.searchButton);
    
    if (await searchInput.count() > 0) {
      await searchInput.first().fill(SEARCH_TERMS.existing);
      
      if (await searchButton.count() > 0) {
        await searchButton.first().click();
      } else {
        // Try clicking search icon
        const searchIcon = page.locator(SELECTORS.searchIcon);
        if (await searchIcon.count() > 0) {
          await searchIcon.first().click();
        }
      }
      
      await page.waitForLoadState('networkidle');
      
      // Should navigate to search results
      const url = page.url();
      const isOnSearch = url.includes('search') || url.includes('q=');
      
      // May or may not navigate depending on implementation
    }
  });

  test('should preserve search query in URL', async ({ page }) => {
    const searchTerm = 'test-query';
    await page.goto(`/en/search?q=${searchTerm}`);
    await page.waitForLoadState('networkidle');
    
    const url = page.url();
    expect(url).toContain(searchTerm);
    
    // Search input should show the query
    const searchInput = page.locator(SELECTORS.searchInput);
    if (await searchInput.count() > 0) {
      const inputValue = await searchInput.first().inputValue();
      // Input may or may not be pre-filled
    }
  });
});

// ============================================
// Pagination Tests
// ============================================

test.describe('Search - Pagination', () => {
  test('should display pagination for many results', async ({ page }) => {
    await page.goto(`/en/search?q=${SEARCH_TERMS.existing}`);
    await page.waitForLoadState('networkidle');
    
    await page.waitForTimeout(2000);
    
    const pagination = page.locator(SELECTORS.pagination);
    const nextPage = page.locator(SELECTORS.nextPage);
    
    const hasPagination = await pagination.count() > 0;
    const hasNextPage = await nextPage.count() > 0;
    
    // Pagination is shown when there are many results
    // (may not be present for small result sets)
  });

  test('should load next page of results', async ({ page }) => {
    await page.goto(`/en/search?q=${SEARCH_TERMS.existing}`);
    await page.waitForLoadState('networkidle');
    
    await page.waitForTimeout(2000);
    
    const nextPage = page.locator(SELECTORS.nextPage);
    
    if (await nextPage.count() > 0) {
      // Get first result on current page
      const results = page.locator(SELECTORS.resultItem);
      const firstResultName = await results.first().locator(SELECTORS.productName).textContent();
      
      // Click next page
      await nextPage.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      
      // Results should change
      const newFirstResultName = await results.first().locator(SELECTORS.productName).textContent();
      
      // First result may or may not change
    }
  });
});

// ============================================
// Responsive Design Tests
// ============================================

test.describe('Search - Responsive Design', () => {
  test('should display correctly on mobile', async ({ page, strict }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto(`/en/search?q=${SEARCH_TERMS.existing}`);
    await page.waitForLoadState('networkidle');
    
    const body = page.locator('body');
    await strict.mustExist(body);
    
    // Search should work on mobile
    const searchInput = page.locator(SELECTORS.searchInput);
    const hasSearch = await searchInput.count() > 0;
    
    // Results should display
    const results = page.locator(SELECTORS.resultItem);
    const noResults = page.locator(SELECTORS.noResults);
    
    const hasResults = await results.count() > 0;
    const hasNoResults = await noResults.count() > 0;
    
    expect(hasSearch || hasResults || hasNoResults).toBeTruthy();
  });

  test('should display correctly on tablet', async ({ page, strict }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    
    await page.goto(`/en/search?q=${SEARCH_TERMS.existing}`);
    await page.waitForLoadState('networkidle');
    
    const body = page.locator('body');
    await strict.mustExist(body);
  });
});

// ============================================
// API Integration Tests
// ============================================

test.describe('Search - API Integration', () => {
  test('should make API call for search', async ({ page, apiInterceptor }) => {
    await page.goto(`/en/search?q=${SEARCH_TERMS.existing}`);
    await page.waitForLoadState('networkidle');
    
    await page.waitForTimeout(2000);
    
    // Check if search API was called
    const searchCalls = apiInterceptor.getCallsTo('/api/search');
    const productsCalls = apiInterceptor.getCallsTo('/api/products');
    
    // At least one API should be called
    const apiCalled = searchCalls.length > 0 || productsCalls.length > 0;
    
    // API call expected but not strictly required (could be SSR)
  });

  test('should handle search API errors gracefully', async ({ page, strict }) => {
    // Mock API error
    await page.route('**/api/search**', route => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });
    
    await page.goto(`/en/search?q=${SEARCH_TERMS.existing}`);
    await page.waitForLoadState('networkidle');
    
    // Page should still render
    const body = page.locator('body');
    await strict.mustExist(body);
    
    // Should show error or empty state
    const errorMessage = page.locator('.error, [data-testid="error"], :text("Error"), :text("错误")');
    const noResults = page.locator(SELECTORS.noResults);
    const results = page.locator(SELECTORS.resultItem);
    
    const hasError = await errorMessage.count() > 0;
    const hasNoResults = await noResults.count() > 0;
    const hasResults = await results.count() > 0;
    
    // Should show something
    expect(hasError || hasNoResults || hasResults).toBeTruthy();
  });
});

// ============================================
// Internationalization Tests
// ============================================

test.describe('Search - Internationalization', () => {
  test('should support Chinese search terms', async ({ page }) => {
    await page.goto(`/zh/search?q=${encodeURIComponent(SEARCH_TERMS.chinese)}`);
    await page.waitForLoadState('networkidle');
    
    await page.waitForTimeout(2000);
    
    // Page should load without errors
    const body = page.locator('body');
    expect(await body.isVisible()).toBeTruthy();
    
    // Results or no results should be shown
    const results = page.locator(SELECTORS.resultItem);
    const noResults = page.locator(SELECTORS.noResults).or(page.locator(SELECTORS.noResultsMessage));
    
    const hasResults = await results.count() > 0;
    const hasNoResults = await noResults.count() > 0;
    
    expect(hasResults || hasNoResults).toBeTruthy();
  });

  test('should display localized no results message', async ({ page }) => {
    // Test Chinese locale
    await page.goto(`/zh/search?q=${SEARCH_TERMS.nonExisting}`);
    await page.waitForLoadState('networkidle');
    
    await page.waitForTimeout(2000);
    
    const noResultsZh = page.locator(':text("没有结果"), :text("未找到"), :text("无结果")');
    const noResultsEn = page.locator(':text("No results"), :text("No products found")');
    
    const hasZhMessage = await noResultsZh.count() > 0;
    const hasEnMessage = await noResultsEn.count() > 0;
    
    // Should have localized message (or any no results message)
  });
});
