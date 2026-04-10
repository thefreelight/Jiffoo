import { Page, Locator, expect } from '@playwright/test';

/**
 * CartPage - Page Object for shopping cart
 * 
 * Encapsulates interactions with:
 * - Cart items
 * - Quantity updates
 * - Remove items
 * - Cart totals
 * - Checkout button
 */
export class CartPage {
  readonly page: Page;
  
  // Cart container
  readonly cartContainer: Locator;
  readonly emptyCartMessage: Locator;
  
  // Cart items
  readonly cartItems: Locator;
  readonly itemNames: Locator;
  readonly itemPrices: Locator;
  readonly itemQuantities: Locator;
  readonly itemTotals: Locator;
  readonly removeButtons: Locator;
  
  // Quantity controls
  readonly increaseButtons: Locator;
  readonly decreaseButtons: Locator;
  readonly quantityInputs: Locator;
  
  // Totals
  readonly subtotal: Locator;
  readonly shipping: Locator;
  readonly tax: Locator;
  readonly discount: Locator;
  readonly total: Locator;
  
  // Actions
  readonly checkoutButton: Locator;
  readonly continueShoppingButton: Locator;
  readonly clearCartButton: Locator;
  
  // Coupon
  readonly couponInput: Locator;
  readonly applyCouponButton: Locator;
  readonly couponMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    
    // Container
    this.cartContainer = page.locator('[data-testid="cart"], .cart-container, main');
    this.emptyCartMessage = page.locator('[data-testid="empty-cart"], .empty-cart, :text("cart is empty")');
    
    // Items
    this.cartItems = page.locator('[data-testid="cart-item"], .cart-item, tr.cart-row, .cart-product');
    this.itemNames = page.locator('[data-testid="item-name"], .item-name, .cart-item-name');
    this.itemPrices = page.locator('[data-testid="item-price"], .item-price, .cart-item-price');
    this.itemQuantities = page.locator('[data-testid="item-quantity"], .item-quantity input, .cart-item input[type="number"]');
    this.itemTotals = page.locator('[data-testid="item-total"], .item-total, .cart-item-total');
    this.removeButtons = page.locator('[data-testid="remove-item"], .remove-item, button[aria-label*="remove" i]');
    
    // Quantity controls
    this.increaseButtons = page.locator('[data-testid="increase-qty"], .increase-qty, button:has-text("+")');
    this.decreaseButtons = page.locator('[data-testid="decrease-qty"], .decrease-qty, button:has-text("-")');
    this.quantityInputs = page.locator('[data-testid="quantity-input"], input[name*="quantity"], input[type="number"]');
    
    // Totals
    this.subtotal = page.locator('[data-testid="subtotal"], .subtotal, :text("Subtotal") + *');
    this.shipping = page.locator('[data-testid="shipping"], .shipping, :text("Shipping") + *');
    this.tax = page.locator('[data-testid="tax"], .tax, :text("Tax") + *');
    this.discount = page.locator('[data-testid="discount"], .discount, :text("Discount") + *');
    this.total = page.locator('[data-testid="total"], .cart-total, .order-total');
    
    // Actions
    this.checkoutButton = page.locator('[data-testid="checkout"], button:has-text("Checkout"), a:has-text("Checkout")');
    this.continueShoppingButton = page.locator('[data-testid="continue-shopping"], a:has-text("Continue Shopping")');
    this.clearCartButton = page.locator('[data-testid="clear-cart"], button:has-text("Clear Cart")');
    
    // Coupon
    this.couponInput = page.locator('[data-testid="coupon-input"], input[name="coupon"], input[placeholder*="coupon" i]');
    this.applyCouponButton = page.locator('[data-testid="apply-coupon"], button:has-text("Apply")');
    this.couponMessage = page.locator('[data-testid="coupon-message"], .coupon-message');
  }

  /**
   * Navigate to cart page
   */
  async goto(locale: string = 'en'): Promise<void> {
    await this.page.goto(`/${locale}/cart`);
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Wait for cart to load
   */
  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Check if cart is empty
   */
  async isEmpty(): Promise<boolean> {
    const emptyVisible = await this.emptyCartMessage.isVisible().catch(() => false);
    if (emptyVisible) return true;
    
    const itemCount = await this.cartItems.count();
    return itemCount === 0;
  }

  /**
   * Get number of items in cart
   */
  async getItemCount(): Promise<number> {
    return this.cartItems.count();
  }

  /**
   * Get item name by index
   */
  async getItemName(index: number): Promise<string | null> {
    return this.itemNames.nth(index).textContent();
  }

  /**
   * Get item price by index
   */
  async getItemPrice(index: number): Promise<string | null> {
    return this.itemPrices.nth(index).textContent();
  }

  /**
   * Get item quantity by index
   */
  async getItemQuantity(index: number): Promise<number> {
    const input = this.quantityInputs.nth(index);
    const value = await input.inputValue();
    return parseInt(value, 10) || 1;
  }

  /**
   * Update item quantity
   */
  async updateQuantity(index: number, quantity: number): Promise<void> {
    const input = this.quantityInputs.nth(index);
    await input.fill(quantity.toString());
    await input.press('Enter');
    await this.page.waitForTimeout(500); // Wait for update
  }

  /**
   * Increase item quantity
   */
  async increaseQuantity(index: number): Promise<void> {
    await this.increaseButtons.nth(index).click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Decrease item quantity
   */
  async decreaseQuantity(index: number): Promise<void> {
    await this.decreaseButtons.nth(index).click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Remove item from cart
   */
  async removeItem(index: number): Promise<void> {
    await this.removeButtons.nth(index).click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Clear entire cart
   */
  async clearCart(): Promise<void> {
    if (await this.clearCartButton.isVisible()) {
      await this.clearCartButton.click();
      await this.page.waitForTimeout(500);
    }
  }

  /**
   * Get cart subtotal
   */
  async getSubtotal(): Promise<string | null> {
    return this.subtotal.textContent();
  }

  /**
   * Get cart total
   */
  async getTotal(): Promise<string | null> {
    return this.total.textContent();
  }

  /**
   * Apply coupon code
   */
  async applyCoupon(code: string): Promise<void> {
    await this.couponInput.fill(code);
    await this.applyCouponButton.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Check if coupon was applied successfully
   */
  async isCouponApplied(): Promise<boolean> {
    const message = await this.couponMessage.textContent();
    if (!message) return false;
    return message.toLowerCase().includes('applied') || message.toLowerCase().includes('success');
  }

  /**
   * Proceed to checkout
   */
  async proceedToCheckout(): Promise<void> {
    await this.checkoutButton.click();
    await this.page.waitForURL(/checkout/);
  }

  /**
   * Continue shopping
   */
  async continueShopping(): Promise<void> {
    await this.continueShoppingButton.click();
  }

  /**
   * Verify cart has items
   */
  async verifyHasItems(): Promise<void> {
    const count = await this.getItemCount();
    expect(count).toBeGreaterThan(0);
  }

  /**
   * Verify cart is empty
   */
  async verifyIsEmpty(): Promise<void> {
    const empty = await this.isEmpty();
    expect(empty).toBeTruthy();
  }

  /**
   * Get all item names
   */
  async getAllItemNames(): Promise<string[]> {
    const names: string[] = [];
    const count = await this.itemNames.count();
    
    for (let i = 0; i < count; i++) {
      const name = await this.itemNames.nth(i).textContent();
      if (name) names.push(name.trim());
    }
    
    return names;
  }
}
