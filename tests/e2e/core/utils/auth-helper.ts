/**
 * Auth Helper Utility
 *
 * Provides authentication helpers for E2E tests.
 * Handles login, logout, and session management.
 *
 * Requirements: 6.1, 10.1
 */

import { Page, expect } from '@playwright/test';

// ============================================
// Types
// ============================================

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthState {
  isLoggedIn: boolean;
  token?: string;
  userId?: string;
  role?: string;
}

// ============================================
// Default Test Credentials
// ============================================

export const DEFAULT_CREDENTIALS = {
  user: {
    email: 'testuser@example.com',
    password: 'TestPassword123!',
  },
  admin: {
    email: 'admin@example.com',
    password: 'AdminPassword123!',
  },
  superAdmin: {
    email: 'superadmin@example.com',
    password: 'SuperAdminPassword123!',
  },
};

// ============================================
// Auth Helper Class
// ============================================

export class AuthHelper {
  constructor(private page: Page) { }

  /**
   * Login as a regular user
   */
  async loginAsUser(
    credentials?: LoginCredentials,
    options?: { waitForRedirect?: boolean }
  ): Promise<void> {
    const { email, password } = credentials || DEFAULT_CREDENTIALS.user;
    const waitForRedirect = options?.waitForRedirect ?? true;

    await this.page.goto('/auth/login');
    await this.page.waitForLoadState('networkidle');

    // Fill login form
    await this.page.fill(
      '[data-testid="email-input"], input[name="email"], input[type="email"]',
      email
    );
    await this.page.fill(
      '[data-testid="password-input"], input[name="password"], input[type="password"]',
      password
    );

    // Submit form
    await this.page.click(
      '[data-testid="login-button"], button[type="submit"]'
    );

    if (waitForRedirect) {
      // Wait for redirect to dashboard or home
      await expect(this.page).toHaveURL(/\/(dashboard|home|$)/, { timeout: 15000 });
    }
  }

  /**
   * Login as an admin user
   */
  async loginAsAdmin(
    credentials?: LoginCredentials,
    options?: { waitForRedirect?: boolean }
  ): Promise<void> {
    const { email, password } = credentials || DEFAULT_CREDENTIALS.admin;
    const waitForRedirect = options?.waitForRedirect ?? true;

    await this.page.goto('/admin/login');
    await this.page.waitForLoadState('networkidle');

    // Fill login form
    await this.page.fill(
      '[data-testid="email-input"], input[name="email"], input[type="email"]',
      email
    );
    await this.page.fill(
      '[data-testid="password-input"], input[name="password"], input[type="password"]',
      password
    );

    // Submit form
    await this.page.click(
      '[data-testid="login-button"], button[type="submit"]'
    );

    if (waitForRedirect) {
      // Wait for redirect to admin dashboard
      await expect(this.page).toHaveURL(/\/admin/, { timeout: 15000 });
    }
  }

  /**
   * Login as a super admin
   */
  async loginAsSuperAdmin(
    credentials?: LoginCredentials,
    options?: { waitForRedirect?: boolean }
  ): Promise<void> {
    const { email, password } = credentials || DEFAULT_CREDENTIALS.superAdmin;
    const waitForRedirect = options?.waitForRedirect ?? true;

    await this.page.goto('/admin/login');
    await this.page.waitForLoadState('networkidle');

    // Fill login form
    await this.page.fill(
      '[data-testid="email-input"], input[name="email"], input[type="email"]',
      email
    );
    await this.page.fill(
      '[data-testid="password-input"], input[name="password"], input[type="password"]',
      password
    );

    // Submit form
    await this.page.click(
      '[data-testid="login-button"], button[type="submit"]'
    );

    if (waitForRedirect) {
      // Wait for redirect to admin dashboard
      await expect(this.page).toHaveURL(/\/admin/, { timeout: 15000 });
    }
  }

  /**
   * Logout current user
   */
  async logout(): Promise<void> {
    // Try to find and click user menu
    const userMenu = this.page.locator(
      '[data-testid="user-menu"], [data-testid="profile-menu"], .user-menu'
    );

    if (await userMenu.isVisible()) {
      await userMenu.click();
      await this.page.click(
        '[data-testid="logout-button"], [data-testid="sign-out"], button:has-text("Logout"), button:has-text("Sign out")'
      );
    } else {
      // Fallback: clear storage and navigate to login
      await this.clearAuthState();
      await this.page.goto('/auth/login');
    }

    // Wait for redirect to login page
    await expect(this.page).toHaveURL(/\/(auth\/)?login/, { timeout: 10000 });
  }

  /**
   * Check if user is logged in
   */
  async isLoggedIn(): Promise<boolean> {
    const token = await this.page.evaluate(() => {
      return (
        localStorage.getItem('token') ||
        localStorage.getItem('accessToken') ||
        sessionStorage.getItem('token')
      );
    });
    return !!token;
  }

  /**
   * Get current auth state
   */
  async getAuthState(): Promise<AuthState> {
    const state = await this.page.evaluate(() => {
      const token =
        localStorage.getItem('token') ||
        localStorage.getItem('accessToken') ||
        sessionStorage.getItem('token');
      const userId = localStorage.getItem('userId');
      const role = localStorage.getItem('userRole');

      return {
        isLoggedIn: !!token,
        token: token || undefined,
        userId: userId || undefined,
        role: role || undefined,
      };
    });

    return state;
  }

  /**
   * Clear auth state (logout without UI interaction)
   */
  async clearAuthState(): Promise<void> {
    await this.page.evaluate(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('userId');
      localStorage.removeItem('userRole');
      sessionStorage.removeItem('token');
    });
    // Clear cookies via context
    await this.page.context().clearCookies();
  }

  /**
   * Set auth token directly (for API-based login)
   */
  async setAuthToken(token: string): Promise<void> {
    await this.page.evaluate((t) => {
      localStorage.setItem('token', t);
    }, token);
  }

  /**
   * Wait for authentication to complete
   */
  async waitForAuth(timeout: number = 10000): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (await this.isLoggedIn()) {
        return;
      }
      await this.page.waitForTimeout(100);
    }
    throw new Error('Authentication did not complete within timeout');
  }

  /**
   * Ensure user is logged in, login if not
   */
  async ensureLoggedIn(
    credentials?: LoginCredentials,
    role: 'user' | 'admin' | 'superAdmin' = 'user'
  ): Promise<void> {
    if (await this.isLoggedIn()) {
      return;
    }

    switch (role) {
      case 'admin':
        await this.loginAsAdmin(credentials);
        break;
      case 'superAdmin':
        await this.loginAsSuperAdmin(credentials);
        break;
      default:
        await this.loginAsUser(credentials);
    }
  }

  /**
   * Register a new user
   */
  async register(
    email: string,
    password: string,
    username: string,
    options?: { waitForRedirect?: boolean }
  ): Promise<void> {
    const waitForRedirect = options?.waitForRedirect ?? true;

    await this.page.goto('/auth/register');
    await this.page.waitForLoadState('networkidle');

    // Fill registration form
    await this.page.fill(
      '[data-testid="username-input"], input[name="username"]',
      username
    );
    await this.page.fill(
      '[data-testid="email-input"], input[name="email"], input[type="email"]',
      email
    );
    await this.page.fill(
      '[data-testid="password-input"], input[name="password"], input[type="password"]',
      password
    );

    // Check for confirm password field
    const confirmPassword = this.page.locator(
      '[data-testid="confirm-password-input"], input[name="confirmPassword"]'
    );
    if (await confirmPassword.isVisible()) {
      await confirmPassword.fill(password);
    }

    // Submit form
    await this.page.click(
      '[data-testid="register-button"], button[type="submit"]'
    );

    if (waitForRedirect) {
      // Wait for redirect to dashboard or login
      await expect(this.page).toHaveURL(/\/(dashboard|login|home|$)/, {
        timeout: 15000,
      });
    }
  }
}

/**
 * Create an AuthHelper instance for a page
 */
export function createAuthHelper(page: Page): AuthHelper {
  return new AuthHelper(page);
}
