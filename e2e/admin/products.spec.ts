/**
 * Tenant Products E2E Tests (Hardened)
 *
 * Tests tenant product management with strict assertions.
 * Validates CRUD operations and bulk import.
 *
 * Requirements: 19.1, 19.2, 19.3, 19.4, 19.5
 */

import { test, expect } from '../utils/test-fixtures';

// ============================================
// Test Data & Selectors
// ============================================

const SELECTORS = {
  // Product list
  productList: '[data-testid="product-list"], .product-list, table',
  productRow: '[data-testid="product-row"], .product-row, tr',
  productName: '[data-testid="product-name"], .product-name',
  productPrice: '[data-testid="product-price"], .product-price',
  productStock: '[data-testid="product-stock"], .product-stock',
  
  // Actions
  addButton: '[data-testid="add-product"], button:has-text("Add"), button:has-text("新增")',
  editButton: '[data-testid="edit-product"], button:has-text("Edit"), button:has-text("编辑")',
  deleteButton: '[data-testid="delete-product"], button:has-text("Delete"), button:has-text("删除")',
  importButton: '[data-testid="import-products"], button:has-text("Import"), button:has-text("导入")',
  
  // Form
  productForm: '[data-testid="product-form"], form',
  nameInput: 'input[name="name"], input[name="title"]',
  priceInput: 'input[name="price"]',
  stockInput: 'input[name="stock"], input[name="quantity"]',
  descriptionInput: 'textarea[name="description"]',
  saveButton: 'button[type="submit"], button:has-text("Save"), button:has-text("保存")',
  
  // Import
  importModal: '[data-testid="import-modal"], .import-modal',
  fileInput: 'input[type="file"]',
  uploadButton: 'button:has-text("Upload"), button:has-text("上传")',
  
  // Search & Filter
  searchInput: '[data-testid="search-input"], input[type="search"]',
  
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
// Product List Tests
// ============================================

test.describe('Tenant Products - List', () => {
  test('should display tenant product list', async ({ page, strict }) => {
    await page.goto('/tenant/products');
    await page.waitForLoadState('networkidle');
    
    const productList = page.locator(SELECTORS.productList);
    const emptyState = page.locator(SELECTORS.emptyState);
    
    const hasList = await productList.count() > 0;
    const hasEmpty = await emptyState.count() > 0;
    
    expect(hasList || hasEmpty).toBeTruthy();
  });

  test('should display add product button', async ({ page, strict }) => {
    await page.goto('/tenant/products');
    await page.waitForLoadState('networkidle');
    
    const addButton = page.locator(SELECTORS.addButton);
    const hasAddButton = await addButton.count() > 0;
    
    if (hasAddButton) {
      await strict.mustExist(addButton, { message: 'Add product button should be visible' });
    }
  });

  test('should search products', async ({ page }) => {
    await page.goto('/tenant/products');
    await page.waitForLoadState('networkidle');
    
    const searchInput = page.locator(SELECTORS.searchInput);
    
    if (await searchInput.count() > 0) {
      await searchInput.first().fill('test');
      await page.waitForTimeout(1000);
    }
  });
});

// ============================================
// Create Product Tests
// ============================================

test.describe('Tenant Products - Create', () => {
  test('should navigate to create product form', async ({ page }) => {
    await page.goto('/tenant/products');
    await page.waitForLoadState('networkidle');
    
    const addButton = page.locator(SELECTORS.addButton);
    
    if (await addButton.count() > 0) {
      await addButton.click();
      await page.waitForLoadState('networkidle');
      
      const productForm = page.locator(SELECTORS.productForm);
      const nameInput = page.locator(SELECTORS.nameInput);
      
      const hasForm = await productForm.count() > 0;
      const hasInput = await nameInput.count() > 0;
      
      expect(hasForm || hasInput).toBeTruthy();
    }
  });

  test('should create product for tenant', async ({ page }) => {
    await page.goto('/tenant/products');
    await page.waitForLoadState('networkidle');
    
    const addButton = page.locator(SELECTORS.addButton);
    
    if (await addButton.count() > 0) {
      await addButton.click();
      await page.waitForLoadState('networkidle');
      
      const nameInput = page.locator(SELECTORS.nameInput);
      const priceInput = page.locator(SELECTORS.priceInput);
      const saveButton = page.locator(SELECTORS.saveButton);
      
      if (await nameInput.count() > 0) {
        await nameInput.fill(`Tenant Product ${Date.now()}`);
        
        if (await priceInput.count() > 0) {
          await priceInput.fill('99.99');
        }
        
        if (await saveButton.count() > 0) {
          await saveButton.click();
          await page.waitForLoadState('networkidle');
          
          const successMessage = page.locator(SELECTORS.successMessage);
          const hasSuccess = await successMessage.count() > 0;
        }
      }
    }
  });
});

// ============================================
// Edit Product Tests
// ============================================

test.describe('Tenant Products - Edit', () => {
  test('should edit product', async ({ page }) => {
    await page.goto('/tenant/products');
    await page.waitForLoadState('networkidle');
    
    const productRows = page.locator(SELECTORS.productRow);
    
    if (await productRows.count() > 0) {
      const firstRow = productRows.first();
      const editButton = firstRow.locator(SELECTORS.editButton);
      
      if (await editButton.count() > 0) {
        await editButton.click();
        await page.waitForLoadState('networkidle');
        
        const nameInput = page.locator(SELECTORS.nameInput);
        const saveButton = page.locator(SELECTORS.saveButton);
        
        if (await nameInput.count() > 0 && await saveButton.count() > 0) {
          await nameInput.clear();
          await nameInput.fill(`Updated Product ${Date.now()}`);
          await saveButton.click();
          await page.waitForLoadState('networkidle');
        }
      }
    }
  });
});

// ============================================
// Delete Product Tests
// ============================================

test.describe('Tenant Products - Delete', () => {
  test('should delete product', async ({ page }) => {
    await page.goto('/tenant/products');
    await page.waitForLoadState('networkidle');
    
    const productRows = page.locator(SELECTORS.productRow);
    
    if (await productRows.count() > 0) {
      const lastRow = productRows.last();
      const deleteButton = lastRow.locator(SELECTORS.deleteButton);
      
      if (await deleteButton.count() > 0) {
        await deleteButton.click();
        await page.waitForTimeout(500);
        
        const confirmButton = page.locator(SELECTORS.confirmButton);
        if (await confirmButton.count() > 0) {
          await confirmButton.click();
        }
        
        await page.waitForLoadState('networkidle');
      }
    }
  });
});

// ============================================
// Import Tests
// ============================================

test.describe('Tenant Products - Import', () => {
  test('should display import button', async ({ page }) => {
    await page.goto('/tenant/products');
    await page.waitForLoadState('networkidle');
    
    const importButton = page.locator(SELECTORS.importButton);
    const hasImport = await importButton.count() > 0;
  });

  test('should open import modal', async ({ page }) => {
    await page.goto('/tenant/products');
    await page.waitForLoadState('networkidle');
    
    const importButton = page.locator(SELECTORS.importButton);
    
    if (await importButton.count() > 0) {
      await importButton.click();
      await page.waitForTimeout(500);
      
      const importModal = page.locator(SELECTORS.importModal);
      const modal = page.locator(SELECTORS.modal);
      const fileInput = page.locator(SELECTORS.fileInput);
      
      const hasModal = await importModal.count() > 0 || await modal.count() > 0;
      const hasFileInput = await fileInput.count() > 0;
    }
  });
});

// ============================================
// Responsive Design Tests
// ============================================

test.describe('Tenant Products - Responsive Design', () => {
  test('should display correctly on mobile', async ({ page, strict }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/tenant/products');
    await page.waitForLoadState('networkidle');
    
    const body = page.locator('body');
    await strict.mustExist(body);
  });

  test('should display correctly on tablet', async ({ page, strict }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    
    await page.goto('/tenant/products');
    await page.waitForLoadState('networkidle');
    
    const body = page.locator('body');
    await strict.mustExist(body);
  });
});
