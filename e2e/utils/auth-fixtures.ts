import { test as base, Page, BrowserContext } from '@playwright/test';

/**
 * User roles for authentication
 */
export type UserRole = 'user' | 'admin' | 'super_admin';

/**
 * Test user credentials
 */
export interface TestUser {
  email: string;
  password: string;
  role: UserRole;
  name: string;
}

/**
 * Predefined test users
 */
export const TEST_USERS: Record<UserRole, TestUser> = {
  user: {
    email: 'test-user@example.com',
    password: 'TestUser123!',
    role: 'user',
    name: 'Test User',
  },
  admin: {
    email: 'test-admin@example.com',
    password: 'TestAdmin123!',
    role: 'admin',
    name: 'Test Admin',
  },
  super_admin: {
    email: 'super-admin@example.com',
    password: 'SuperAdmin123!',
    role: 'super_admin',
    name: 'Super Admin',
  },
};

/**
 * Authentication state storage
 */
interface AuthState {
  token: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
}

/**
 * Login to the shop application
 */
export async function loginToShop(
  page: Page,
  user: TestUser = TEST_USERS.user
): Promise<void> {
  await page.goto('/login');
  
  // Fill login form
  await page.fill('[data-testid="email-input"], input[name="email"], input[type="email"]', user.email);
  await page.fill('[data-testid="password-input"], input[name="password"], input[type="password"]', user.password);
  
  // Submit form
  await page.click('[data-testid="login-button"], button[type="submit"]');
  
  // Wait for navigation or success indicator
  await page.waitForURL(/\/(dashboard|account|home|\/)/, { timeout: 10000 }).catch(() => {
    // If no redirect, check for success message
    return page.waitForSelector('[data-testid="login-success"], .success-message', { timeout: 5000 });
  });
}

/**
 * Login to the admin dashboard
 */
export async function loginToAdmin(
  page: Page,
  user: TestUser = TEST_USERS.admin
): Promise<void> {
  await page.goto('/login');
  
  // Fill login form
  await page.fill('[data-testid="email-input"], input[name="email"], input[type="email"]', user.email);
  await page.fill('[data-testid="password-input"], input[name="password"], input[type="password"]', user.password);
  
  // Submit form
  await page.click('[data-testid="login-button"], button[type="submit"]');
  
  // Wait for dashboard
  await page.waitForURL(/\/(dashboard|admin|\/)/, { timeout: 10000 });
}

/**
 * Logout from the application
 */
export async function logout(page: Page): Promise<void> {
  // Try different logout methods
  const logoutButton = page.locator('[data-testid="logout-button"], button:has-text("Logout"), a:has-text("Logout")');
  
  if (await logoutButton.isVisible()) {
    await logoutButton.click();
  } else {
    // Try dropdown menu
    const userMenu = page.locator('[data-testid="user-menu"], .user-menu, .avatar');
    if (await userMenu.isVisible()) {
      await userMenu.click();
      await page.click('[data-testid="logout-option"], button:has-text("Logout")');
    }
  }
  
  // Wait for redirect to login or home
  await page.waitForURL(/\/(login|home|\/)/, { timeout: 10000 });
}

/**
 * Check if user is logged in
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  // Check for common logged-in indicators
  const indicators = [
    '[data-testid="user-menu"]',
    '[data-testid="logout-button"]',
    '.user-avatar',
    '.user-menu',
  ];
  
  for (const selector of indicators) {
    const element = page.locator(selector);
    if (await element.isVisible().catch(() => false)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Set authentication token directly (for faster tests)
 */
export async function setAuthToken(
  context: BrowserContext,
  token: string,
  baseURL: string
): Promise<void> {
  // Set token in localStorage via page
  const page = await context.newPage();
  await page.goto(baseURL);
  
  await page.evaluate((authToken) => {
    localStorage.setItem('token', authToken);
    localStorage.setItem('auth_token', authToken);
  }, token);
  
  await page.close();
}

/**
 * Clear authentication state
 */
export async function clearAuth(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    sessionStorage.clear();
  });
  
  // Clear cookies
  const context = page.context();
  await context.clearCookies();
}

/**
 * Extended test fixtures with authentication
 */
type AuthFixtures = {
  /** Page with logged-in user */
  authenticatedPage: Page;
  /** Page with logged-in admin */
  adminPage: Page;
  /** Login helper function */
  login: (user?: TestUser) => Promise<void>;
  /** Logout helper function */
  logout: () => Promise<void>;
};

/**
 * Extended test with authentication fixtures
 */
export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    await loginToShop(page, TEST_USERS.user);
    await use(page);
    await clearAuth(page);
  },
  
  adminPage: async ({ page }, use) => {
    await loginToAdmin(page, TEST_USERS.admin);
    await use(page);
    await clearAuth(page);
  },
  
  login: async ({ page }, use) => {
    const loginFn = async (user: TestUser = TEST_USERS.user) => {
      await loginToShop(page, user);
    };
    await use(loginFn);
  },
  
  logout: async ({ page }, use) => {
    const logoutFn = async () => {
      await logout(page);
    };
    await use(logoutFn);
  },
});

export { expect } from '@playwright/test';
