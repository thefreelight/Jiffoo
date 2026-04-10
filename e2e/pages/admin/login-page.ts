import { Page, Locator, expect } from '@playwright/test';

/**
 * AdminLoginPage - Page Object for admin login
 * 
 * Encapsulates interactions with the admin login form
 */
export class AdminLoginPage {
  readonly page: Page;
  
  // Form elements
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly rememberMeCheckbox: Locator;
  
  // Messages
  readonly errorMessage: Locator;
  readonly successMessage: Locator;
  
  // Links
  readonly forgotPasswordLink: Locator;

  constructor(page: Page) {
    this.page = page;
    
    // Form
    this.emailInput = page.locator('input[type="email"], input[name="email"], [data-testid="email-input"]');
    this.passwordInput = page.locator('input[type="password"], input[name="password"], [data-testid="password-input"]');
    this.submitButton = page.locator('button[type="submit"], [data-testid="login-button"], button:has-text("Login"), button:has-text("Sign in")');
    this.rememberMeCheckbox = page.locator('input[name="remember"], [data-testid="remember-me"]');
    
    // Messages
    this.errorMessage = page.locator('[data-testid="error-message"], .error-message, .alert-error, [role="alert"]');
    this.successMessage = page.locator('[data-testid="success-message"], .success-message');
    
    // Links
    this.forgotPasswordLink = page.locator('a[href*="forgot"], a[href*="reset"], a:has-text("Forgot")');
  }

  /**
   * Navigate to login page
   */
  async goto(): Promise<void> {
    await this.page.goto('/login');
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Wait for page to load
   */
  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Fill login form
   */
  async fillForm(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
  }

  /**
   * Submit login form
   */
  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  /**
   * Login with credentials
   */
  async login(email: string, password: string): Promise<void> {
    await this.fillForm(email, password);
    await this.submit();
    await this.page.waitForTimeout(500);
  }

  /**
   * Login with test admin credentials
   */
  async loginAsAdmin(): Promise<void> {
    await this.login('admin@example.com', 'Admin123!');
  }

  /**
   * Check if error message is displayed
   */
  async hasError(): Promise<boolean> {
    return this.errorMessage.isVisible();
  }

  /**
   * Get error message text
   */
  async getErrorMessage(): Promise<string | null> {
    return this.errorMessage.textContent();
  }

  /**
   * Check if login was successful (redirected away from login)
   */
  async isLoginSuccessful(): Promise<boolean> {
    const url = this.page.url();
    return !url.includes('login');
  }

  /**
   * Verify form is displayed
   */
  async verifyFormDisplayed(): Promise<void> {
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }
}
