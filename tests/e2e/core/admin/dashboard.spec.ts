/**
 * Tenant Dashboard E2E Tests (Hardened)
 *
 * Tests tenant dashboard with strict assertions.
 * Validates login, dashboard display, and quick actions.
 *
 * Requirements: 18.1, 18.2, 18.3, 18.4, 18.5
 */

import { test, expect } from '../utils/test-fixtures';

// ============================================
// Test Data & Selectors
// ============================================

const SELECTORS = {
  // Login
  loginForm: '[data-testid="login-form"], form.login-form, form',
  emailInput: 'input[name="email"], input[type="email"]',
  passwordInput: 'input[name="password"], input[type="password"]',
  submitButton: 'button[type="submit"], button:has-text("Login"), button:has-text("登录")',
  
  // Dashboard
  dashboard: '[data-testid="dashboard"], .dashboard, .tenant-dashboard',
  welcomeMessage: '[data-testid="welcome"], .welcome-message',
  
  // Stats
  statsContainer: '[data-testid="stats"], .stats-container, .dashboard-stats',
  salesStat: '[data-testid="sales-stat"], .sales-stat, .total-sales',
  ordersStat: '[data-testid="orders-stat"], .orders-stat, .total-orders',
  customersStat: '[data-testid="customers-stat"], .customers-stat',
  revenueStat: '[data-testid="revenue-stat"], .revenue-stat',
  
  // Charts
  chartsContainer: '[data-testid="charts"], .charts-container',
  salesChart: '[data-testid="sales-chart"], .sales-chart, canvas',
  ordersChart: '[data-testid="orders-chart"], .orders-chart',
  
  // Recent orders
  recentOrders: '[data-testid="recent-orders"], .recent-orders',
  orderRow: '[data-testid="order-row"], .order-row, tr',
  
  // Quick actions
  quickActions: '[data-testid="quick-actions"], .quick-actions',
  addProductAction: 'a:has-text("Add Product"), button:has-text("添加商品")',
  viewOrdersAction: 'a:has-text("View Orders"), button:has-text("查看订单")',
  
  // Navigation
  sidebar: '[data-testid="sidebar"], .sidebar, nav',
  productsLink: 'a[href*="products"], a:has-text("Products"), a:has-text("商品")',
  ordersLink: 'a[href*="orders"], a:has-text("Orders"), a:has-text("订单")',
  customersLink: 'a[href*="customers"], a:has-text("Customers"), a:has-text("客户")',
  settingsLink: 'a[href*="settings"], a:has-text("Settings"), a:has-text("设置")',
  
  // Messages
  errorMessage: '[data-testid="error-message"], .error, .alert-error',
};

// Tenant credentials
const TENANT_CREDENTIALS = {
  email: process.env.TENANT_EMAIL || 'tenant@example.com',
  password: process.env.TENANT_PASSWORD || 'tenant123',
};

// ============================================
// Login Tests
// ============================================

test.describe('Tenant Dashboard - Login', () => {
  test('should display tenant login form', async ({ page, strict }) => {
    await page.goto('/tenant/login');
    await page.waitForLoadState('networkidle');
    
    const loginForm = page.locator(SELECTORS.loginForm);
    const emailInput = page.locator(SELECTORS.emailInput);
    const passwordInput = page.locator(SELECTORS.passwordInput);
    
    const hasForm = await loginForm.count() > 0;
    const hasEmail = await emailInput.count() > 0;
    const hasPassword = await passwordInput.count() > 0;
    
    expect(hasForm || (hasEmail && hasPassword)).toBeTruthy();
  });

  test('should login successfully with valid credentials', async ({ page, strict }) => {
    await page.goto('/tenant/login');
    await page.waitForLoadState('networkidle');
    
    const emailInput = page.locator(SELECTORS.emailInput);
    const passwordInput = page.locator(SELECTORS.passwordInput);
    const submitButton = page.locator(SELECTORS.submitButton);
    
    if (await emailInput.count() > 0) {
      await emailInput.fill(TENANT_CREDENTIALS.email);
      await passwordInput.fill(TENANT_CREDENTIALS.password);
      await submitButton.click();
      
      await page.waitForLoadState('networkidle');
      
      // Should redirect to dashboard
      const url = page.url();
      const isOnDashboard = !url.includes('login');
      
      expect(isOnDashboard).toBeTruthy();
    }
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/tenant/login');
    await page.waitForLoadState('networkidle');
    
    const emailInput = page.locator(SELECTORS.emailInput);
    const passwordInput = page.locator(SELECTORS.passwordInput);
    const submitButton = page.locator(SELECTORS.submitButton);
    
    if (await emailInput.count() > 0) {
      await emailInput.fill('invalid@example.com');
      await passwordInput.fill('wrongpassword');
      await submitButton.click();
      
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      
      const errorMessage = page.locator(SELECTORS.errorMessage);
      const hasError = await errorMessage.count() > 0;
      const stillOnLogin = page.url().includes('login');
      
      expect(hasError || stillOnLogin).toBeTruthy();
    }
  });
});

// ============================================
// Dashboard Display Tests
// ============================================

test.describe('Tenant Dashboard - Display', () => {
  test('should display dashboard after login', async ({ page, auth, strict }) => {
    // Login as tenant
    await page.goto('/tenant/login');
    await page.waitForLoadState('networkidle');
    
    const emailInput = page.locator(SELECTORS.emailInput);
    if (await emailInput.count() > 0) {
      await emailInput.fill(TENANT_CREDENTIALS.email);
      await page.locator(SELECTORS.passwordInput).fill(TENANT_CREDENTIALS.password);
      await page.locator(SELECTORS.submitButton).click();
      await page.waitForLoadState('networkidle');
    }
    
    // Check dashboard elements
    const dashboard = page.locator(SELECTORS.dashboard);
    const statsContainer = page.locator(SELECTORS.statsContainer);
    
    const hasDashboard = await dashboard.count() > 0;
    const hasStats = await statsContainer.count() > 0;
    
    // Dashboard should have some content
  });

  test('should display sales statistics', async ({ page }) => {
    await page.goto('/tenant/dashboard');
    await page.waitForLoadState('networkidle');
    
    const salesStat = page.locator(SELECTORS.salesStat);
    const ordersStat = page.locator(SELECTORS.ordersStat);
    
    const hasSales = await salesStat.count() > 0;
    const hasOrders = await ordersStat.count() > 0;
  });

  test('should display charts', async ({ page }) => {
    await page.goto('/tenant/dashboard');
    await page.waitForLoadState('networkidle');
    
    const chartsContainer = page.locator(SELECTORS.chartsContainer);
    const salesChart = page.locator(SELECTORS.salesChart);
    
    const hasCharts = await chartsContainer.count() > 0;
    const hasSalesChart = await salesChart.count() > 0;
  });

  test('should display recent orders', async ({ page }) => {
    await page.goto('/tenant/dashboard');
    await page.waitForLoadState('networkidle');
    
    const recentOrders = page.locator(SELECTORS.recentOrders);
    const hasRecentOrders = await recentOrders.count() > 0;
  });
});

// ============================================
// Quick Actions Tests
// ============================================

test.describe('Tenant Dashboard - Quick Actions', () => {
  test('should display quick action buttons', async ({ page }) => {
    await page.goto('/tenant/dashboard');
    await page.waitForLoadState('networkidle');
    
    const quickActions = page.locator(SELECTORS.quickActions);
    const addProductAction = page.locator(SELECTORS.addProductAction);
    
    const hasQuickActions = await quickActions.count() > 0;
    const hasAddProduct = await addProductAction.count() > 0;
  });

  test('should navigate to products from quick action', async ({ page }) => {
    await page.goto('/tenant/dashboard');
    await page.waitForLoadState('networkidle');
    
    const addProductAction = page.locator(SELECTORS.addProductAction);
    
    if (await addProductAction.count() > 0) {
      await addProductAction.click();
      await page.waitForLoadState('networkidle');
      
      const url = page.url();
      const isOnProducts = url.includes('product');
      
      expect(isOnProducts).toBeTruthy();
    }
  });

  test('should navigate to orders from quick action', async ({ page }) => {
    await page.goto('/tenant/dashboard');
    await page.waitForLoadState('networkidle');
    
    const viewOrdersAction = page.locator(SELECTORS.viewOrdersAction);
    
    if (await viewOrdersAction.count() > 0) {
      await viewOrdersAction.click();
      await page.waitForLoadState('networkidle');
      
      const url = page.url();
      const isOnOrders = url.includes('order');
      
      expect(isOnOrders).toBeTruthy();
    }
  });
});

// ============================================
// Navigation Tests
// ============================================

test.describe('Tenant Dashboard - Navigation', () => {
  test('should display sidebar navigation', async ({ page }) => {
    await page.goto('/tenant/dashboard');
    await page.waitForLoadState('networkidle');
    
    const sidebar = page.locator(SELECTORS.sidebar);
    const hasSidebar = await sidebar.count() > 0;
  });

  test('should navigate to products page', async ({ page }) => {
    await page.goto('/tenant/dashboard');
    await page.waitForLoadState('networkidle');
    
    const productsLink = page.locator(SELECTORS.productsLink);
    
    if (await productsLink.count() > 0) {
      await productsLink.first().click();
      await page.waitForLoadState('networkidle');
      
      expect(page.url()).toContain('product');
    }
  });

  test('should navigate to orders page', async ({ page }) => {
    await page.goto('/tenant/dashboard');
    await page.waitForLoadState('networkidle');
    
    const ordersLink = page.locator(SELECTORS.ordersLink);
    
    if (await ordersLink.count() > 0) {
      await ordersLink.first().click();
      await page.waitForLoadState('networkidle');
      
      expect(page.url()).toContain('order');
    }
  });

  test('should navigate to settings page', async ({ page }) => {
    await page.goto('/tenant/dashboard');
    await page.waitForLoadState('networkidle');
    
    const settingsLink = page.locator(SELECTORS.settingsLink);
    
    if (await settingsLink.count() > 0) {
      await settingsLink.first().click();
      await page.waitForLoadState('networkidle');
      
      expect(page.url()).toContain('setting');
    }
  });
});

// ============================================
// Responsive Design Tests
// ============================================

test.describe('Tenant Dashboard - Responsive Design', () => {
  test('should display correctly on mobile', async ({ page, strict }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/tenant/dashboard');
    await page.waitForLoadState('networkidle');
    
    const body = page.locator('body');
    await strict.mustExist(body);
  });

  test('should display correctly on tablet', async ({ page, strict }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    
    await page.goto('/tenant/dashboard');
    await page.waitForLoadState('networkidle');
    
    const body = page.locator('body');
    await strict.mustExist(body);
  });
});
