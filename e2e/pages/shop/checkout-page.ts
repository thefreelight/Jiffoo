import { Page, Locator, expect } from '@playwright/test';

/**
 * CheckoutPage - Page Object for checkout flow
 * 
 * Encapsulates interactions with:
 * - Shipping address form
 * - Payment method selection
 * - Order summary
 * - Place order
 */
export class CheckoutPage {
  readonly page: Page;
  
  // Steps indicator
  readonly stepsIndicator: Locator;
  readonly currentStep: Locator;
  
  // Shipping address form
  readonly shippingForm: Locator;
  readonly firstNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly emailInput: Locator;
  readonly phoneInput: Locator;
  readonly addressInput: Locator;
  readonly address2Input: Locator;
  readonly cityInput: Locator;
  readonly stateInput: Locator;
  readonly zipInput: Locator;
  readonly countrySelect: Locator;
  
  // Shipping method
  readonly shippingMethods: Locator;
  readonly standardShipping: Locator;
  readonly expressShipping: Locator;
  
  // Payment
  readonly paymentSection: Locator;
  readonly paymentMethods: Locator;
  readonly creditCardOption: Locator;
  readonly paypalOption: Locator;
  readonly cardNumberInput: Locator;
  readonly cardExpiryInput: Locator;
  readonly cardCvcInput: Locator;
  readonly cardNameInput: Locator;
  
  // Order summary
  readonly orderSummary: Locator;
  readonly summaryItems: Locator;
  readonly subtotal: Locator;
  readonly shippingCost: Locator;
  readonly tax: Locator;
  readonly total: Locator;
  
  // Actions
  readonly continueButton: Locator;
  readonly backButton: Locator;
  readonly placeOrderButton: Locator;
  
  // Terms
  readonly termsCheckbox: Locator;
  
  // Errors
  readonly errorMessages: Locator;
  readonly formErrors: Locator;

  constructor(page: Page) {
    this.page = page;
    
    // Steps
    this.stepsIndicator = page.locator('[data-testid="checkout-steps"], .checkout-steps, .steps');
    this.currentStep = page.locator('[data-testid="current-step"], .current-step, .step.active');
    
    // Shipping form
    this.shippingForm = page.locator('[data-testid="shipping-form"], .shipping-form, form');
    this.firstNameInput = page.locator('[data-testid="first-name"], input[name="firstName"], input[name="first_name"]');
    this.lastNameInput = page.locator('[data-testid="last-name"], input[name="lastName"], input[name="last_name"]');
    this.emailInput = page.locator('[data-testid="email"], input[name="email"], input[type="email"]');
    this.phoneInput = page.locator('[data-testid="phone"], input[name="phone"], input[type="tel"]');
    this.addressInput = page.locator('[data-testid="address"], input[name="address"], input[name="address1"]');
    this.address2Input = page.locator('[data-testid="address2"], input[name="address2"], input[name="apartment"]');
    this.cityInput = page.locator('[data-testid="city"], input[name="city"]');
    this.stateInput = page.locator('[data-testid="state"], input[name="state"], select[name="state"]');
    this.zipInput = page.locator('[data-testid="zip"], input[name="zip"], input[name="postalCode"]');
    this.countrySelect = page.locator('[data-testid="country"], select[name="country"]');
    
    // Shipping method
    this.shippingMethods = page.locator('[data-testid="shipping-methods"], .shipping-methods');
    this.standardShipping = page.locator('[data-testid="standard-shipping"], input[value="standard"], label:has-text("Standard")');
    this.expressShipping = page.locator('[data-testid="express-shipping"], input[value="express"], label:has-text("Express")');
    
    // Payment
    this.paymentSection = page.locator('[data-testid="payment-section"], .payment-section');
    this.paymentMethods = page.locator('[data-testid="payment-methods"], .payment-methods');
    this.creditCardOption = page.locator('[data-testid="credit-card"], input[value="card"], label:has-text("Credit Card")');
    this.paypalOption = page.locator('[data-testid="paypal"], input[value="paypal"], label:has-text("PayPal")');
    this.cardNumberInput = page.locator('[data-testid="card-number"], input[name="cardNumber"], input[placeholder*="card number" i]');
    this.cardExpiryInput = page.locator('[data-testid="card-expiry"], input[name="expiry"], input[placeholder*="MM/YY" i]');
    this.cardCvcInput = page.locator('[data-testid="card-cvc"], input[name="cvc"], input[placeholder*="CVC" i]');
    this.cardNameInput = page.locator('[data-testid="card-name"], input[name="cardName"], input[placeholder*="name on card" i]');
    
    // Order summary
    this.orderSummary = page.locator('[data-testid="order-summary"], .order-summary');
    this.summaryItems = page.locator('[data-testid="summary-item"], .summary-item');
    this.subtotal = page.locator('[data-testid="subtotal"], .subtotal');
    this.shippingCost = page.locator('[data-testid="shipping-cost"], .shipping-cost');
    this.tax = page.locator('[data-testid="tax"], .tax');
    this.total = page.locator('[data-testid="total"], .order-total, .checkout-total');
    
    // Actions
    this.continueButton = page.locator('[data-testid="continue"], button:has-text("Continue"), button:has-text("Next")');
    this.backButton = page.locator('[data-testid="back"], button:has-text("Back"), a:has-text("Back")');
    this.placeOrderButton = page.locator('[data-testid="place-order"], button:has-text("Place Order"), button:has-text("Complete Order")');
    
    // Terms
    this.termsCheckbox = page.locator('[data-testid="terms"], input[name="terms"], input[type="checkbox"]');
    
    // Errors
    this.errorMessages = page.locator('[data-testid="error"], .error-message, .alert-error');
    this.formErrors = page.locator('.field-error, .input-error, [role="alert"]');
  }

  /**
   * Navigate to checkout page
   */
  async goto(locale: string = 'en'): Promise<void> {
    await this.page.goto(`/${locale}/checkout`);
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Wait for checkout to load
   */
  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Fill shipping address
   */
  async fillShippingAddress(address: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    address: string;
    address2?: string;
    city: string;
    state: string;
    zip: string;
    country?: string;
  }): Promise<void> {
    await this.firstNameInput.fill(address.firstName);
    await this.lastNameInput.fill(address.lastName);
    await this.emailInput.fill(address.email);
    
    if (address.phone) {
      await this.phoneInput.fill(address.phone);
    }
    
    await this.addressInput.fill(address.address);
    
    if (address.address2) {
      await this.address2Input.fill(address.address2);
    }
    
    await this.cityInput.fill(address.city);
    
    // State might be input or select
    const stateIsSelect = await this.stateInput.evaluate(el => el.tagName === 'SELECT');
    if (stateIsSelect) {
      await this.stateInput.selectOption(address.state);
    } else {
      await this.stateInput.fill(address.state);
    }
    
    await this.zipInput.fill(address.zip);
    
    if (address.country) {
      await this.countrySelect.selectOption(address.country);
    }
  }

  /**
   * Fill with test address
   */
  async fillTestAddress(): Promise<void> {
    await this.fillShippingAddress({
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      phone: '1234567890',
      address: '123 Test Street',
      city: 'Test City',
      state: 'CA',
      zip: '12345',
      country: 'US',
    });
  }

  /**
   * Select shipping method
   */
  async selectShippingMethod(method: 'standard' | 'express'): Promise<void> {
    if (method === 'standard') {
      await this.standardShipping.click();
    } else {
      await this.expressShipping.click();
    }
  }

  /**
   * Select payment method
   */
  async selectPaymentMethod(method: 'card' | 'paypal'): Promise<void> {
    if (method === 'card') {
      await this.creditCardOption.click();
    } else {
      await this.paypalOption.click();
    }
  }

  /**
   * Fill credit card details
   */
  async fillCreditCard(card: {
    number: string;
    expiry: string;
    cvc: string;
    name: string;
  }): Promise<void> {
    await this.cardNumberInput.fill(card.number);
    await this.cardExpiryInput.fill(card.expiry);
    await this.cardCvcInput.fill(card.cvc);
    await this.cardNameInput.fill(card.name);
  }

  /**
   * Fill with test card
   */
  async fillTestCard(): Promise<void> {
    await this.fillCreditCard({
      number: '4242424242424242',
      expiry: '12/25',
      cvc: '123',
      name: 'Test User',
    });
  }

  /**
   * Accept terms and conditions
   */
  async acceptTerms(): Promise<void> {
    await this.termsCheckbox.check();
  }

  /**
   * Continue to next step
   */
  async continue(): Promise<void> {
    await this.continueButton.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Go back to previous step
   */
  async goBack(): Promise<void> {
    await this.backButton.click();
  }

  /**
   * Place order
   */
  async placeOrder(): Promise<void> {
    await this.placeOrderButton.click();
    // Wait for order confirmation or error
    await this.page.waitForURL(/order-(success|confirmation|cancelled)|checkout/, { timeout: 30000 });
  }

  /**
   * Get order total
   */
  async getTotal(): Promise<string | null> {
    return this.total.textContent();
  }

  /**
   * Check if there are form errors
   */
  async hasErrors(): Promise<boolean> {
    const errorCount = await this.formErrors.count();
    return errorCount > 0;
  }

  /**
   * Get error messages
   */
  async getErrorMessages(): Promise<string[]> {
    const errors: string[] = [];
    const count = await this.formErrors.count();
    
    for (let i = 0; i < count; i++) {
      const text = await this.formErrors.nth(i).textContent();
      if (text) errors.push(text.trim());
    }
    
    return errors;
  }

  /**
   * Complete full checkout flow with test data
   */
  async completeTestCheckout(): Promise<void> {
    await this.fillTestAddress();
    await this.continue();
    
    // Select shipping if visible
    if (await this.shippingMethods.isVisible()) {
      await this.selectShippingMethod('standard');
      await this.continue();
    }
    
    // Fill payment if visible
    if (await this.paymentSection.isVisible()) {
      await this.selectPaymentMethod('card');
      await this.fillTestCard();
    }
    
    // Accept terms if visible
    if (await this.termsCheckbox.isVisible()) {
      await this.acceptTerms();
    }
    
    await this.placeOrder();
  }
}
