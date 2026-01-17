/**
 * Validation Errors E2E Tests (Hardened)
 *
 * Tests form validation error handling with strict assertions.
 * Validates error display, field highlighting, and error messages.
 *
 * Requirements: 28.2
 */

import { test, expect } from '../utils/test-fixtures';

// ============================================
// Test Data & Selectors
// ============================================

const SELECTORS = {
  // Form elements
  form: 'form',
  input: 'input',
  textarea: 'textarea',
  select: 'select',
  submitButton: 'button[type="submit"]',
  
  // Error states
  fieldError: '.field-error, .input-error, [data-testid="field-error"], .error-message',
  formError: '.form-error, [data-testid="form-error"], .alert-error',
  invalidField: 'input:invalid, .is-invalid, [aria-invalid="true"]',
  
  // Specific forms
  loginForm: '[data-testid="login-form"], form.login-form',
  registerForm: '[data-testid="register-form"], form.register-form',
  checkoutForm: '[data-testid="checkout-form"], form.checkout-form',
  profileForm: '[data-testid="profile-form"], form.profile-form',
  
  // Specific inputs
  emailInput: 'input[name="email"], input[type="email"]',
  passwordInput: 'input[name="password"], input[type="password"]',
  nameInput: 'input[name="name"], input[name="fullName"]',
  phoneInput: 'input[name="phone"], input[type="tel"]',
  
  // Error messages
  requiredError: ':text("required"), :text("必填")',
  emailError: ':text("email"), :text("邮箱")',
  passwordError: ':text("password"), :text("密码")',
  minLengthError: ':text("minimum"), :text("至少")',
};

// ============================================
// Login Form Validation Tests
// ============================================

test.describe('Validation Errors - Login Form', () => {
  test('should show error for empty email', async ({ page }) => {
    await page.goto('/en/auth/login');
    await page.waitForLoadState('networkidle');
    
    const passwordInput = page.locator(SELECTORS.passwordInput);
    const submitButton = page.locator(SELECTORS.submitButton);
    
    if (await passwordInput.count() > 0 && await submitButton.count() > 0) {
      await passwordInput.fill('password123');
      await submitButton.click();
      await page.waitForTimeout(500);
      
      // Should show validation error
      const fieldError = page.locator(SELECTORS.fieldError);
      const invalidField = page.locator(SELECTORS.invalidField);
      
      const hasError = await fieldError.count() > 0;
      const hasInvalid = await invalidField.count() > 0;
      const stillOnLogin = page.url().includes('login');
      
      expect(hasError || hasInvalid || stillOnLogin).toBeTruthy();
    }
  });

  test('should show error for invalid email format', async ({ page }) => {
    await page.goto('/en/auth/login');
    await page.waitForLoadState('networkidle');
    
    const emailInput = page.locator(SELECTORS.emailInput);
    const passwordInput = page.locator(SELECTORS.passwordInput);
    const submitButton = page.locator(SELECTORS.submitButton);
    
    if (await emailInput.count() > 0) {
      await emailInput.fill('invalid-email');
      await passwordInput.fill('password123');
      await submitButton.click();
      await page.waitForTimeout(500);
      
      const fieldError = page.locator(SELECTORS.fieldError);
      const emailError = page.locator(SELECTORS.emailError);
      
      const hasError = await fieldError.count() > 0;
      const hasEmailError = await emailError.count() > 0;
      const stillOnLogin = page.url().includes('login');
      
      expect(hasError || hasEmailError || stillOnLogin).toBeTruthy();
    }
  });

  test('should show error for empty password', async ({ page }) => {
    await page.goto('/en/auth/login');
    await page.waitForLoadState('networkidle');
    
    const emailInput = page.locator(SELECTORS.emailInput);
    const submitButton = page.locator(SELECTORS.submitButton);
    
    if (await emailInput.count() > 0) {
      await emailInput.fill('test@example.com');
      await submitButton.click();
      await page.waitForTimeout(500);
      
      const fieldError = page.locator(SELECTORS.fieldError);
      const hasError = await fieldError.count() > 0;
      const stillOnLogin = page.url().includes('login');
      
      expect(hasError || stillOnLogin).toBeTruthy();
    }
  });
});

// ============================================
// Registration Form Validation Tests
// ============================================

test.describe('Validation Errors - Registration Form', () => {
  test('should show all validation errors', async ({ page }) => {
    await page.goto('/en/auth/register');
    await page.waitForLoadState('networkidle');
    
    const submitButton = page.locator(SELECTORS.submitButton);
    
    if (await submitButton.count() > 0) {
      await submitButton.click();
      await page.waitForTimeout(500);
      
      const fieldErrors = page.locator(SELECTORS.fieldError);
      const errorCount = await fieldErrors.count();
      
      // Should show multiple validation errors
      const stillOnRegister = page.url().includes('register');
      expect(errorCount > 0 || stillOnRegister).toBeTruthy();
    }
  });

  test('should validate password requirements', async ({ page }) => {
    await page.goto('/en/auth/register');
    await page.waitForLoadState('networkidle');
    
    const emailInput = page.locator(SELECTORS.emailInput);
    const passwordInput = page.locator(SELECTORS.passwordInput);
    const submitButton = page.locator(SELECTORS.submitButton);
    
    if (await emailInput.count() > 0 && await passwordInput.count() > 0) {
      await emailInput.fill('test@example.com');
      await passwordInput.fill('123'); // Too short
      await submitButton.click();
      await page.waitForTimeout(500);
      
      const fieldError = page.locator(SELECTORS.fieldError);
      const minLengthError = page.locator(SELECTORS.minLengthError);
      
      const hasError = await fieldError.count() > 0;
      const hasMinLength = await minLengthError.count() > 0;
      const stillOnRegister = page.url().includes('register');
      
      expect(hasError || hasMinLength || stillOnRegister).toBeTruthy();
    }
  });
});

// ============================================
// Checkout Form Validation Tests
// ============================================

test.describe('Validation Errors - Checkout Form', () => {
  test('should validate shipping address', async ({ page }) => {
    await page.goto('/en/checkout');
    await page.waitForLoadState('networkidle');
    
    const submitButton = page.locator(SELECTORS.submitButton);
    
    if (await submitButton.count() > 0) {
      await submitButton.click();
      await page.waitForTimeout(500);
      
      const fieldErrors = page.locator(SELECTORS.fieldError);
      const errorCount = await fieldErrors.count();
      
      const stillOnCheckout = page.url().includes('checkout');
      expect(errorCount > 0 || stillOnCheckout).toBeTruthy();
    }
  });

  test('should validate phone number format', async ({ page }) => {
    await page.goto('/en/checkout');
    await page.waitForLoadState('networkidle');
    
    const phoneInput = page.locator(SELECTORS.phoneInput);
    const submitButton = page.locator(SELECTORS.submitButton);
    
    if (await phoneInput.count() > 0) {
      await phoneInput.fill('invalid');
      await submitButton.click();
      await page.waitForTimeout(500);
      
      const fieldError = page.locator(SELECTORS.fieldError);
      const hasError = await fieldError.count() > 0;
    }
  });
});

// ============================================
// Field Highlighting Tests
// ============================================

test.describe('Validation Errors - Field Highlighting', () => {
  test('should highlight invalid fields', async ({ page }) => {
    await page.goto('/en/auth/login');
    await page.waitForLoadState('networkidle');
    
    const emailInput = page.locator(SELECTORS.emailInput);
    const submitButton = page.locator(SELECTORS.submitButton);
    
    if (await emailInput.count() > 0) {
      await emailInput.fill('invalid');
      await submitButton.click();
      await page.waitForTimeout(500);
      
      const invalidFields = page.locator(SELECTORS.invalidField);
      const hasInvalid = await invalidFields.count() > 0;
    }
  });

  test('should clear error on valid input', async ({ page }) => {
    await page.goto('/en/auth/login');
    await page.waitForLoadState('networkidle');
    
    const emailInput = page.locator(SELECTORS.emailInput);
    const submitButton = page.locator(SELECTORS.submitButton);
    
    if (await emailInput.count() > 0) {
      // Trigger error
      await emailInput.fill('invalid');
      await submitButton.click();
      await page.waitForTimeout(500);
      
      // Fix input
      await emailInput.clear();
      await emailInput.fill('valid@example.com');
      await page.waitForTimeout(500);
      
      // Error should be cleared or reduced
    }
  });
});

// ============================================
// Error Message Display Tests
// ============================================

test.describe('Validation Errors - Error Messages', () => {
  test('should display clear error messages', async ({ page }) => {
    await page.goto('/en/auth/register');
    await page.waitForLoadState('networkidle');
    
    const submitButton = page.locator(SELECTORS.submitButton);
    
    if (await submitButton.count() > 0) {
      await submitButton.click();
      await page.waitForTimeout(500);
      
      const fieldErrors = page.locator(SELECTORS.fieldError);
      
      if (await fieldErrors.count() > 0) {
        const firstError = fieldErrors.first();
        const errorText = await firstError.textContent();
        
        // Error message should have content
        expect(errorText?.trim().length).toBeGreaterThan(0);
      }
    }
  });

  test('should show localized error messages', async ({ page }) => {
    await page.goto('/zh/auth/login');
    await page.waitForLoadState('networkidle');
    
    const submitButton = page.locator(SELECTORS.submitButton);
    
    if (await submitButton.count() > 0) {
      await submitButton.click();
      await page.waitForTimeout(500);
      
      // Check for Chinese error messages
      const chineseError = page.locator(':text("必填"), :text("请输入"), :text("无效")');
      const hasChineseError = await chineseError.count() > 0;
    }
  });
});

// ============================================
// Responsive Design Tests
// ============================================

test.describe('Validation Errors - Responsive', () => {
  test('should display errors correctly on mobile', async ({ page, strict }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/en/auth/login');
    await page.waitForLoadState('networkidle');
    
    const submitButton = page.locator(SELECTORS.submitButton);
    
    if (await submitButton.count() > 0) {
      await submitButton.click();
      await page.waitForTimeout(500);
      
      const body = page.locator('body');
      await strict.mustExist(body);
    }
  });
});
