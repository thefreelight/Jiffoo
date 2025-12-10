import { Page, Locator, expect } from '@playwright/test';

/**
 * ProductPage - Page Object for product detail page
 * 
 * Encapsulates interactions with:
 * - Product images gallery
 * - Product info (name, price, description)
 * - Variant selection
 * - Add to cart
 * - Reviews
 */
export class ProductPage {
  readonly page: Page;
  
  // Product info
  readonly productName: Locator;
  readonly productPrice: Locator;
  readonly productDescription: Locator;
  readonly productSku: Locator;
  readonly stockStatus: Locator;
  
  // Images
  readonly mainImage: Locator;
  readonly thumbnails: Locator;
  readonly imageGallery: Locator;
  
  // Variants
  readonly variantSelector: Locator;
  readonly sizeOptions: Locator;
  readonly colorOptions: Locator;
  
  // Quantity
  readonly quantityInput: Locator;
  readonly increaseQuantity: Locator;
  readonly decreaseQuantity: Locator;
  
  // Actions
  readonly addToCartButton: Locator;
  readonly buyNowButton: Locator;
  readonly wishlistButton: Locator;
  
  // Reviews
  readonly reviewsSection: Locator;
  readonly reviewCount: Locator;
  readonly averageRating: Locator;
  readonly reviewItems: Locator;
  
  // Related products
  readonly relatedProducts: Locator;
  
  // Breadcrumb
  readonly breadcrumb: Locator;

  constructor(page: Page) {
    this.page = page;
    
    // Product info
    this.productName = page.locator('[data-testid="product-name"], h1, .product-title');
    this.productPrice = page.locator('[data-testid="product-price"], .product-price, .price');
    this.productDescription = page.locator('[data-testid="product-description"], .product-description, .description');
    this.productSku = page.locator('[data-testid="product-sku"], .sku');
    this.stockStatus = page.locator('[data-testid="stock-status"], .stock-status, .availability');
    
    // Images
    this.mainImage = page.locator('[data-testid="main-image"], .main-image, .product-image img').first();
    this.thumbnails = page.locator('[data-testid="thumbnail"], .thumbnail, .gallery-thumb');
    this.imageGallery = page.locator('[data-testid="image-gallery"], .image-gallery, .product-gallery');
    
    // Variants
    this.variantSelector = page.locator('[data-testid="variant-selector"], .variant-selector');
    this.sizeOptions = page.locator('[data-testid="size-option"], .size-option, button[data-size]');
    this.colorOptions = page.locator('[data-testid="color-option"], .color-option, button[data-color]');
    
    // Quantity
    this.quantityInput = page.locator('[data-testid="quantity-input"], input[name="quantity"], input[type="number"]');
    this.increaseQuantity = page.locator('[data-testid="increase-quantity"], button:has-text("+"), .quantity-plus');
    this.decreaseQuantity = page.locator('[data-testid="decrease-quantity"], button:has-text("-"), .quantity-minus');
    
    // Actions
    this.addToCartButton = page.locator('[data-testid="add-to-cart"], button:has-text("Add to Cart"), button:has-text("Add to Bag")');
    this.buyNowButton = page.locator('[data-testid="buy-now"], button:has-text("Buy Now")');
    this.wishlistButton = page.locator('[data-testid="wishlist"], button[aria-label*="wishlist" i], .wishlist-btn');
    
    // Reviews
    this.reviewsSection = page.locator('[data-testid="reviews"], .reviews-section, #reviews');
    this.reviewCount = page.locator('[data-testid="review-count"], .review-count');
    this.averageRating = page.locator('[data-testid="average-rating"], .average-rating, .rating');
    this.reviewItems = page.locator('[data-testid="review-item"], .review-item, .review');
    
    // Related
    this.relatedProducts = page.locator('[data-testid="related-products"], .related-products');
    
    // Breadcrumb
    this.breadcrumb = page.locator('[data-testid="breadcrumb"], .breadcrumb, nav[aria-label="breadcrumb"]');
  }

  /**
   * Navigate to product page
   */
  async goto(productId: string, locale: string = 'en'): Promise<void> {
    await this.page.goto(`/${locale}/products/${productId}`);
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Wait for product to load
   */
  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    await this.productName.waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * Get product name
   */
  async getName(): Promise<string | null> {
    return this.productName.textContent();
  }

  /**
   * Get product price
   */
  async getPrice(): Promise<string | null> {
    return this.productPrice.textContent();
  }

  /**
   * Get product description
   */
  async getDescription(): Promise<string | null> {
    return this.productDescription.textContent();
  }

  /**
   * Check if product is in stock
   */
  async isInStock(): Promise<boolean> {
    const stockText = await this.stockStatus.textContent();
    if (!stockText) return true; // Assume in stock if no status shown
    return !stockText.toLowerCase().includes('out of stock');
  }

  /**
   * Select a size variant
   */
  async selectSize(size: string): Promise<void> {
    await this.sizeOptions.filter({ hasText: size }).click();
  }

  /**
   * Select a color variant
   */
  async selectColor(color: string): Promise<void> {
    await this.colorOptions.filter({ hasText: color }).click();
  }

  /**
   * Set quantity
   */
  async setQuantity(quantity: number): Promise<void> {
    await this.quantityInput.fill(quantity.toString());
  }

  /**
   * Increase quantity
   */
  async increaseQty(): Promise<void> {
    await this.increaseQuantity.click();
  }

  /**
   * Decrease quantity
   */
  async decreaseQty(): Promise<void> {
    await this.decreaseQuantity.click();
  }

  /**
   * Get current quantity
   */
  async getQuantity(): Promise<number> {
    const value = await this.quantityInput.inputValue();
    return parseInt(value, 10) || 1;
  }

  /**
   * Add product to cart
   */
  async addToCart(): Promise<void> {
    await this.addToCartButton.click();
    // Wait for cart update indication
    await this.page.waitForTimeout(500);
  }

  /**
   * Click buy now
   */
  async buyNow(): Promise<void> {
    await this.buyNowButton.click();
    await this.page.waitForURL(/checkout/);
  }

  /**
   * Add to wishlist
   */
  async addToWishlist(): Promise<void> {
    await this.wishlistButton.click();
  }

  /**
   * Click on thumbnail image
   */
  async clickThumbnail(index: number): Promise<void> {
    await this.thumbnails.nth(index).click();
  }

  /**
   * Get number of thumbnails
   */
  async getThumbnailCount(): Promise<number> {
    return this.thumbnails.count();
  }

  /**
   * Verify main image is loaded
   */
  async verifyMainImageLoaded(): Promise<void> {
    await expect(this.mainImage).toBeVisible();
    
    const naturalWidth = await this.mainImage.evaluate(
      // @ts-expect-error - naturalWidth exists in browser
      (el) => el.naturalWidth
    );
    
    expect(naturalWidth).toBeGreaterThan(0);
  }

  /**
   * Verify all images loaded
   */
  async verifyAllImagesLoaded(): Promise<void> {
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

  /**
   * Get review count
   */
  async getReviewCount(): Promise<number> {
    const text = await this.reviewCount.textContent();
    if (!text) return 0;
    const match = text.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  }

  /**
   * Scroll to reviews section
   */
  async scrollToReviews(): Promise<void> {
    await this.reviewsSection.scrollIntoViewIfNeeded();
  }
}
