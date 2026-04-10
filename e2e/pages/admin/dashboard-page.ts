import { Page, Locator, expect } from '@playwright/test';

/**
 * AdminDashboardPage - Page Object for admin dashboard
 * 
 * Encapsulates interactions with the main admin dashboard
 */
export class AdminDashboardPage {
  readonly page: Page;
  
  // Layout elements
  readonly sidebar: Locator;
  readonly header: Locator;
  readonly mainContent: Locator;
  readonly userMenu: Locator;
  
  // Navigation links
  readonly dashboardLink: Locator;
  readonly productsLink: Locator;
  readonly ordersLink: Locator;
  readonly usersLink: Locator;
  readonly pluginsLink: Locator;
  readonly settingsLink: Locator;
  readonly analyticsLink: Locator;
  
  // Dashboard widgets
  readonly statsCards: Locator;
  readonly recentOrders: Locator;
  readonly salesChart: Locator;
  
  // Quick actions
  readonly addProductButton: Locator;
  readonly viewOrdersButton: Locator;

  constructor(page: Page) {
    this.page = page;
    
    // Layout
    this.sidebar = page.locator('aside, nav[role="navigation"], [data-testid="sidebar"], .sidebar');
    this.header = page.locator('header, [data-testid="header"]');
    this.mainContent = page.locator('main, [data-testid="main-content"], .main-content');
    this.userMenu = page.locator('[data-testid="user-menu"], .user-menu, .avatar-menu');
    
    // Navigation
    this.dashboardLink = page.locator('a[href="/"], a[href="/dashboard"], a:has-text("Dashboard")');
    this.productsLink = page.locator('a[href*="products"], a:has-text("Products")');
    this.ordersLink = page.locator('a[href*="orders"], a:has-text("Orders")');
    this.usersLink = page.locator('a[href*="users"], a:has-text("Users"), a:has-text("Customers")');
    this.pluginsLink = page.locator('a[href*="plugins"], a:has-text("Plugins")');
    this.settingsLink = page.locator('a[href*="settings"], a:has-text("Settings")');
    this.analyticsLink = page.locator('a[href*="analytics"], a:has-text("Analytics")');
    
    // Widgets
    this.statsCards = page.locator('[data-testid="stats-card"], .stats-card, .stat-card, .dashboard-card');
    this.recentOrders = page.locator('[data-testid="recent-orders"], .recent-orders');
    this.salesChart = page.locator('[data-testid="sales-chart"], .sales-chart, canvas');
    
    // Actions
    this.addProductButton = page.locator('[data-testid="add-product"], button:has-text("Add Product"), a:has-text("Add Product")');
    this.viewOrdersButton = page.locator('[data-testid="view-orders"], a:has-text("View Orders")');
  }

  /**
   * Navigate to dashboard
   */
  async goto(): Promise<void> {
    await this.page.goto('/');
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Wait for dashboard to load
   */
  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Check if sidebar is visible
   */
  async isSidebarVisible(): Promise<boolean> {
    return this.sidebar.isVisible();
  }

  /**
   * Navigate to products page
   */
  async goToProducts(): Promise<void> {
    await this.productsLink.first().click();
    await this.page.waitForURL(/products/);
  }

  /**
   * Navigate to orders page
   */
  async goToOrders(): Promise<void> {
    await this.ordersLink.first().click();
    await this.page.waitForURL(/orders/);
  }

  /**
   * Navigate to users page
   */
  async goToUsers(): Promise<void> {
    await this.usersLink.first().click();
    await this.page.waitForURL(/users/);
  }

  /**
   * Navigate to plugins page
   */
  async goToPlugins(): Promise<void> {
    await this.pluginsLink.first().click();
    await this.page.waitForURL(/plugins/);
  }

  /**
   * Navigate to settings page
   */
  async goToSettings(): Promise<void> {
    await this.settingsLink.first().click();
    await this.page.waitForURL(/settings/);
  }

  /**
   * Get number of stats cards
   */
  async getStatsCardCount(): Promise<number> {
    return this.statsCards.count();
  }

  /**
   * Open user menu
   */
  async openUserMenu(): Promise<void> {
    await this.userMenu.click();
  }

  /**
   * Logout from admin
   */
  async logout(): Promise<void> {
    await this.openUserMenu();
    const logoutButton = this.page.locator('button:has-text("Logout"), a:has-text("Logout"), [data-testid="logout"]');
    await logoutButton.click();
    await this.page.waitForURL(/login/);
  }

  /**
   * Verify dashboard is displayed
   */
  async verifyDashboardDisplayed(): Promise<void> {
    await expect(this.mainContent).toBeVisible();
  }

  /**
   * Check if user is on dashboard
   */
  async isOnDashboard(): Promise<boolean> {
    const url = this.page.url();
    return url.endsWith('/') || url.includes('dashboard');
  }
}
