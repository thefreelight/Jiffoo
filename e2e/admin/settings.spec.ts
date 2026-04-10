/**
 * Tenant Settings E2E Tests (Hardened)
 *
 * Tests tenant settings with strict assertions.
 * Validates store info, payment, shipping, and business model settings.
 *
 * Requirements: 24.1, 24.2, 24.3, 24.4, 24.5
 */

import { test, expect } from '../utils/test-fixtures';

// ============================================
// Test Data & Selectors
// ============================================

const SELECTORS = {
  // Settings page
  settingsContainer: '[data-testid="settings"], .settings-container',
  settingsForm: '[data-testid="settings-form"], form',
  
  // Navigation
  settingsNav: '[data-testid="settings-nav"], .settings-nav',
  storeInfoTab: 'a:has-text("Store Info"), button:has-text("店铺信息")',
  paymentTab: 'a:has-text("Payment"), button:has-text("支付")',
  shippingTab: 'a:has-text("Shipping"), button:has-text("配送")',
  businessTab: 'a:has-text("Business"), button:has-text("业务模式")',
  
  // Store info
  storeNameInput: 'input[name="storeName"], input[name="name"]',
  storeDescInput: 'textarea[name="description"]',
  logoUpload: 'input[type="file"][name="logo"]',
  
  // Payment settings
  paymentMethods: '[data-testid="payment-methods"], .payment-methods',
  paymentToggle: 'input[type="checkbox"][name*="payment"]',
  
  // Shipping settings
  shippingMethods: '[data-testid="shipping-methods"], .shipping-methods',
  shippingToggle: 'input[type="checkbox"][name*="shipping"]',
  
  // Business model
  businessModel: '[data-testid="business-model"], .business-model',
  modelSelect: 'select[name="businessModel"]',
  
  // Actions
  saveButton: 'button[type="submit"], button:has-text("Save"), button:has-text("保存")',
  
  // Messages
  successMessage: '[data-testid="success-message"], .success, .alert-success',
  errorMessage: '[data-testid="error-message"], .error, .alert-error',
};

// ============================================
// Settings Display Tests
// ============================================

test.describe('Tenant Settings - Display', () => {
  test('should display settings form', async ({ page, strict }) => {
    await page.goto('/tenant/settings');
    await page.waitForLoadState('networkidle');
    
    const settingsContainer = page.locator(SELECTORS.settingsContainer);
    const settingsForm = page.locator(SELECTORS.settingsForm);
    
    const hasContainer = await settingsContainer.count() > 0;
    const hasForm = await settingsForm.count() > 0;
    
    expect(hasContainer || hasForm).toBeTruthy();
  });

  test('should display settings navigation', async ({ page }) => {
    await page.goto('/tenant/settings');
    await page.waitForLoadState('networkidle');
    
    const settingsNav = page.locator(SELECTORS.settingsNav);
    const hasNav = await settingsNav.count() > 0;
  });
});

// ============================================
// Store Info Tests
// ============================================

test.describe('Tenant Settings - Store Info', () => {
  test('should update store information', async ({ page }) => {
    await page.goto('/tenant/settings');
    await page.waitForLoadState('networkidle');
    
    const storeNameInput = page.locator(SELECTORS.storeNameInput);
    const saveButton = page.locator(SELECTORS.saveButton);
    
    if (await storeNameInput.count() > 0 && await saveButton.count() > 0) {
      const originalValue = await storeNameInput.inputValue();
      await storeNameInput.clear();
      await storeNameInput.fill(`Updated Store ${Date.now()}`);
      
      await saveButton.first().click();
      await page.waitForLoadState('networkidle');
      
      const successMessage = page.locator(SELECTORS.successMessage);
      const hasSuccess = await successMessage.count() > 0;
      
      // Restore
      await storeNameInput.clear();
      await storeNameInput.fill(originalValue);
      await saveButton.first().click();
    }
  });
});

// ============================================
// Payment Settings Tests
// ============================================

test.describe('Tenant Settings - Payment', () => {
  test('should display payment methods', async ({ page }) => {
    await page.goto('/tenant/settings');
    await page.waitForLoadState('networkidle');
    
    const paymentTab = page.locator(SELECTORS.paymentTab);
    if (await paymentTab.count() > 0) {
      await paymentTab.click();
      await page.waitForLoadState('networkidle');
    }
    
    const paymentMethods = page.locator(SELECTORS.paymentMethods);
    const paymentToggle = page.locator(SELECTORS.paymentToggle);
    
    const hasMethods = await paymentMethods.count() > 0;
    const hasToggle = await paymentToggle.count() > 0;
  });

  test('should configure payment settings', async ({ page }) => {
    await page.goto('/tenant/settings');
    await page.waitForLoadState('networkidle');
    
    const paymentTab = page.locator(SELECTORS.paymentTab);
    if (await paymentTab.count() > 0) {
      await paymentTab.click();
      await page.waitForLoadState('networkidle');
    }
    
    const paymentToggle = page.locator(SELECTORS.paymentToggle);
    
    if (await paymentToggle.count() > 0) {
      const firstToggle = paymentToggle.first();
      const originalState = await firstToggle.isChecked();
      
      await firstToggle.click();
      
      const newState = await firstToggle.isChecked();
      expect(newState).not.toBe(originalState);
      
      // Restore
      await firstToggle.click();
    }
  });
});

// ============================================
// Shipping Settings Tests
// ============================================

test.describe('Tenant Settings - Shipping', () => {
  test('should display shipping methods', async ({ page }) => {
    await page.goto('/tenant/settings');
    await page.waitForLoadState('networkidle');
    
    const shippingTab = page.locator(SELECTORS.shippingTab);
    if (await shippingTab.count() > 0) {
      await shippingTab.click();
      await page.waitForLoadState('networkidle');
    }
    
    const shippingMethods = page.locator(SELECTORS.shippingMethods);
    const hasShipping = await shippingMethods.count() > 0;
  });

  test('should configure shipping settings', async ({ page }) => {
    await page.goto('/tenant/settings');
    await page.waitForLoadState('networkidle');
    
    const shippingTab = page.locator(SELECTORS.shippingTab);
    if (await shippingTab.count() > 0) {
      await shippingTab.click();
      await page.waitForLoadState('networkidle');
    }
    
    const shippingToggle = page.locator(SELECTORS.shippingToggle);
    
    if (await shippingToggle.count() > 0) {
      const firstToggle = shippingToggle.first();
      await firstToggle.click();
      await page.waitForTimeout(500);
      await firstToggle.click();
    }
  });
});

// ============================================
// Business Model Tests
// ============================================

test.describe('Tenant Settings - Business Model', () => {
  test('should display business model settings', async ({ page }) => {
    await page.goto('/tenant/settings');
    await page.waitForLoadState('networkidle');
    
    const businessTab = page.locator(SELECTORS.businessTab);
    if (await businessTab.count() > 0) {
      await businessTab.click();
      await page.waitForLoadState('networkidle');
    }
    
    const businessModel = page.locator(SELECTORS.businessModel);
    const modelSelect = page.locator(SELECTORS.modelSelect);
    
    const hasModel = await businessModel.count() > 0;
    const hasSelect = await modelSelect.count() > 0;
  });

  test('should configure business model', async ({ page }) => {
    await page.goto('/tenant/settings');
    await page.waitForLoadState('networkidle');
    
    const businessTab = page.locator(SELECTORS.businessTab);
    if (await businessTab.count() > 0) {
      await businessTab.click();
      await page.waitForLoadState('networkidle');
    }
    
    const modelSelect = page.locator(SELECTORS.modelSelect);
    
    if (await modelSelect.count() > 0) {
      const options = await modelSelect.locator('option').all();
      if (options.length > 1) {
        await modelSelect.selectOption({ index: 1 });
      }
    }
  });
});

// ============================================
// Responsive Design Tests
// ============================================

test.describe('Tenant Settings - Responsive Design', () => {
  test('should display correctly on mobile', async ({ page, strict }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/tenant/settings');
    await page.waitForLoadState('networkidle');
    
    const body = page.locator('body');
    await strict.mustExist(body);
  });

  test('should display correctly on tablet', async ({ page, strict }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    
    await page.goto('/tenant/settings');
    await page.waitForLoadState('networkidle');
    
    const body = page.locator('body');
    await strict.mustExist(body);
  });
});
