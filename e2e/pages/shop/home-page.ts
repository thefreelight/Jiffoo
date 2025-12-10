import { Page, Locator, expect } from '@playwright/test';

/**
 * HomePage - Page Object for shop homepage
 * 
 * Encapsulates all interactions with the homepage including:
 * - Hero section
 * - Featured products
 * - Categories
 * - Navigation
 */
export class HomePage {
  readonly page: Page;
  
  // Navigation elements
  readonly header: Locator;
  readonly logo: Locator;
  readonly searchInput: Locator;
  readonly cartIcon: Locator;
  readonly userMenu: Locator;
  
  // Hero section
  readonly heroSection: Locator;
  readonly heroCTA: Locator;
  
  // Product sections
  readonly featuredProducts: Locator;
  readonly productCards: Locator;
  readonly newArrivals: Locator;
  readonly bestSellers: Locator;
  
  // Categories
  readonly categoriesSection: Locator;
  readonly categoryLinks: Locator;
  
  // Footer
  readonly footer: Locator;

  constructor(page: Page) {
    this.page = page;
    
    // Navigation
    this.header = page.locator('header, [data-testid="header"]');
    this.logo = page.locator('[data-testid="logo"], .logo, header a[href="/"]').first();
    this.searchInput = page.locator('[data-testid="search-input"], input[type="search"], input[placeholder*="search" i]');
    this.cartIcon = page.locator('[data-testid="cart-icon"], a[href*="cart"], button:has([data-testid="cart"])');
    this.userMenu = page.locator('[data-testid="user-menu"], .user-menu, [data-testid="account-menu"]');
    
    // Hero
    this.heroSection = page.locator('[data-testid="hero"], .hero, section:first-of-type');
    this.heroCTA = page.locator('[data-testid="hero-cta"], .hero button, .hero a');
    
    // Products
    this.featuredProducts = page.locator('[data-testid="featured-products"], .featured-products, section:has-text("Featured")');
    this.productCards = page.locator('[data-testid="product-card"], .product-card, article');
    this.newArrivals = page.locator('[data-testid="new-arrivals"], section:has-text("New")');
    this.bestSellers = page.locator('[data-testid="best-sellers"], section:has-text("Best")');
    
    // Categories
    this.categoriesSection = page.locator('[data-testid="categories"], .categories, section:has-text("Categories")');
    this.categoryLinks = page.locator('[data-testid="category-link"], .category-link, .categories a');
    
    // Footer
    this.footer = page.locator('footer, [data-testid="footer"]');
  }

  /**
   * Navigate to homepage
   */
  async goto(locale: string = 'en'): Promise<void> {
    await this.page.goto(`/${locale}`);
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Wait for page to be fully loaded
   */
  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Check if header is visible
   */
  async isHeaderVisible(): Promise<boolean> {
    return this.header.isVisible();
  }

  /**
   * Search for a product
   */
  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.searchInput.press('Enter');
  }

  /**
   * Click on cart icon
   */
  async goToCart(): Promise<void> {
    await this.cartIcon.click();
    await this.page.waitForURL(/cart/);
  }

  /**
   * Get number of product cards on page
   */
  async getProductCount(): Promise<number> {
    return this.productCards.count();
  }

  /**
   * Click on a product card by index
   */
  async clickProduct(index: number = 0): Promise<void> {
    await this.productCards.nth(index).click();
    await this.page.waitForURL(/products/);
  }

  /**
   * Click on a category
   */
  async clickCategory(index: number = 0): Promise<void> {
    await this.categoryLinks.nth(index).click();
  }

  /**
   * Verify hero section is displayed
   */
  async verifyHeroSection(): Promise<void> {
    await expect(this.heroSection).toBeVisible();
  }

  /**
   * Verify footer is displayed
   */
  async verifyFooter(): Promise<void> {
    await expect(this.footer).toBeVisible();
  }

  /**
   * Get all visible images on the page
   */
  async getAllImages(): Promise<Locator> {
    return this.page.locator('img');
  }

  /**
   * Verify all images loaded successfully
   */
  async verifyImagesLoaded(): Promise<void> {
    const images = this.page.locator('img');
    const count = await images.count();
    
    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const isVisible = await img.isVisible();
      
      if (isVisible) {
        const naturalWidth = await img.evaluate(
          // @ts-expect-error - naturalWidth exists in browser
          (el) => el.naturalWidth
        );
        
        if (naturalWidth === 0) {
          const src = await img.getAttribute('src');
          throw new Error(`Image failed to load: ${src}`);
        }
      }
    }
  }
}
