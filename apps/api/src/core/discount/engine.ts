/**
 * Discount Calculation Engine
 *
 * Handles discount calculation logic with support for multiple discount types
 * and stacking rules.
 */

import { DiscountService } from './service';
import { AppliedDiscount, DiscountType } from './types';
import type { Cart, CartItem } from '@/core/cart/service';

export interface DiscountCalculationResult {
  discountAmount: number;
  appliedDiscounts: AppliedDiscount[];
  shippingDiscount: number;
  subtotal: number;
  finalTotal: number;
}

interface User {
  id: string;
  role?: string;
}

/**
 * Discount Calculation Engine
 */
export class DiscountEngine {
  /**
   * Calculate discounts for a cart
   */
  static async calculateDiscount(
    cart: Cart,
    discountCodes: string[],
    user?: User
  ): Promise<DiscountCalculationResult> {
    const appliedDiscounts: AppliedDiscount[] = [];
    let totalDiscountAmount = 0;
    let shippingDiscount = 0;
    let hasNonStackableDiscount = false;

    // Extract product IDs from cart
    const productIds = cart.items.map(item => item.productId);

    // Sort discount codes to process non-stackable ones first (to apply best discount)
    const sortedCodes = await this.sortDiscountCodes(discountCodes);

    // Process each discount code
    for (const code of sortedCodes) {
      // Skip if we already have a non-stackable discount
      if (hasNonStackableDiscount) {
        break;
      }

      // Validate the discount code
      const validation = await DiscountService.validateDiscount({
        code,
        userId: user?.id,
        cartTotal: cart.subtotal,
        productIds,
      });

      if (!validation.isValid || !validation.discount) {
        continue;
      }

      const discount = validation.discount;

      // Check if discount is stackable
      if (!discount.stackable && appliedDiscounts.length > 0) {
        continue;
      }

      // Extract product IDs from discount if it has product restrictions
      const discountProductIds = discount.products?.map(p => p.productId) || [];

      // Calculate discount amount based on type
      const discountAmount = this.calculateDiscountAmount(
        cart,
        discount.type,
        discount.value,
        discount.minAmount,
        discountProductIds
      );

      if (discountAmount > 0 || discount.type === DiscountType.FREE_SHIPPING) {
        appliedDiscounts.push({
          id: discount.id,
          code: discount.code,
          type: discount.type,
          value: discount.value,
          discountAmount,
        });

        // Handle different discount types
        if (discount.type === DiscountType.FREE_SHIPPING) {
          shippingDiscount += discountAmount;
        } else {
          totalDiscountAmount += discountAmount;
        }

        // Mark if this is a non-stackable discount
        if (!discount.stackable) {
          hasNonStackableDiscount = true;
        }
      }
    }

    const finalTotal = Math.max(0, cart.subtotal - totalDiscountAmount + cart.tax + cart.shipping - shippingDiscount);

    return {
      discountAmount: totalDiscountAmount,
      appliedDiscounts,
      shippingDiscount,
      subtotal: cart.subtotal,
      finalTotal,
    };
  }

  /**
   * Calculate discount amount based on discount type
   */
  private static calculateDiscountAmount(
    cart: Cart,
    discountType: string,
    discountValue: number,
    minAmount: number | null,
    productIds?: string[]
  ): number {
    // Check minimum amount requirement
    if (minAmount && cart.subtotal < minAmount) {
      return 0;
    }

    // If discount has product restrictions, calculate product-specific discount
    if (productIds && productIds.length > 0) {
      return this.calculateProductSpecificDiscount(
        cart,
        discountType,
        discountValue,
        productIds
      );
    }

    // Otherwise, calculate cart-wide discount
    switch (discountType) {
      case DiscountType.PERCENTAGE:
        return this.calculatePercentageDiscount(cart, discountValue);

      case DiscountType.FIXED_AMOUNT:
        return this.calculateFixedAmountDiscount(cart, discountValue);

      case DiscountType.BUY_X_GET_Y:
        return this.calculateBuyXGetYDiscount(cart, discountValue);

      case DiscountType.FREE_SHIPPING:
        return this.calculateFreeShippingDiscount(cart);

      default:
        return 0;
    }
  }

  /**
   * Calculate percentage discount
   */
  private static calculatePercentageDiscount(cart: Cart, percentage: number): number {
    const discountDecimal = percentage / 100;
    return Math.round(cart.subtotal * discountDecimal * 100) / 100;
  }

  /**
   * Calculate fixed amount discount
   */
  private static calculateFixedAmountDiscount(cart: Cart, amount: number): number {
    // Don't discount more than the cart subtotal
    return Math.min(amount, cart.subtotal);
  }

  /**
   * Calculate buy-X-get-Y discount
   *
   * Value represents the quantity threshold (e.g., buy 2 get 1 free means value = 3)
   * This implementation gives the cheapest item free for every X items purchased
   */
  private static calculateBuyXGetYDiscount(cart: Cart, threshold: number): number {
    if (cart.items.length === 0 || threshold < 2) {
      return 0;
    }

    // Calculate total items in cart
    const totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);

    // Calculate how many free items the customer gets
    const freeItemsCount = Math.floor(totalItems / threshold);

    if (freeItemsCount === 0) {
      return 0;
    }

    // Sort items by price (ascending) to give cheapest items free
    const sortedItems = [...cart.items].sort((a, b) => a.price - b.price);

    let discount = 0;
    let remainingFreeItems = freeItemsCount;

    // Give the cheapest items for free
    for (const item of sortedItems) {
      if (remainingFreeItems === 0) break;

      const itemsToDiscount = Math.min(remainingFreeItems, item.quantity);
      discount += item.price * itemsToDiscount;
      remainingFreeItems -= itemsToDiscount;
    }

    return Math.round(discount * 100) / 100;
  }

  /**
   * Calculate product-specific discount
   *
   * Applies discount only to eligible products in the cart
   */
  private static calculateProductSpecificDiscount(
    cart: Cart,
    discountType: string,
    discountValue: number,
    productIds: string[]
  ): number {
    // Filter cart items to only include eligible products
    const eligibleItems = cart.items.filter(item =>
      productIds.includes(item.productId)
    );

    if (eligibleItems.length === 0) {
      return 0;
    }

    // Calculate subtotal of eligible items
    const eligibleSubtotal = eligibleItems.reduce(
      (sum, item) => sum + item.subtotal,
      0
    );

    switch (discountType) {
      case DiscountType.PERCENTAGE:
        // Apply percentage discount to eligible items only
        const discountDecimal = discountValue / 100;
        return Math.round(eligibleSubtotal * discountDecimal * 100) / 100;

      case DiscountType.FIXED_AMOUNT:
        // Apply fixed amount, capped at eligible subtotal
        return Math.min(discountValue, eligibleSubtotal);

      case DiscountType.BUY_X_GET_Y:
        // Calculate buy-X-get-Y for eligible items only
        return this.calculateBuyXGetYForItems(eligibleItems, discountValue);

      case DiscountType.FREE_SHIPPING:
        // Product-specific discounts don't affect shipping
        return 0;

      default:
        return 0;
    }
  }

  /**
   * Calculate buy-X-get-Y discount for specific items
   */
  private static calculateBuyXGetYForItems(items: CartItem[], threshold: number): number {
    if (items.length === 0 || threshold < 2) {
      return 0;
    }

    // Calculate total items in eligible set
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

    // Calculate how many free items the customer gets
    const freeItemsCount = Math.floor(totalItems / threshold);

    if (freeItemsCount === 0) {
      return 0;
    }

    // Sort items by price (ascending) to give cheapest items free
    const sortedItems = [...items].sort((a, b) => a.price - b.price);

    let discount = 0;
    let remainingFreeItems = freeItemsCount;

    // Give the cheapest items for free
    for (const item of sortedItems) {
      if (remainingFreeItems === 0) break;

      const itemsToDiscount = Math.min(remainingFreeItems, item.quantity);
      discount += item.price * itemsToDiscount;
      remainingFreeItems -= itemsToDiscount;
    }

    return Math.round(discount * 100) / 100;
  }

  /**
   * Calculate free shipping discount
   */
  private static calculateFreeShippingDiscount(cart: Cart): number {
    return cart.shipping;
  }

  /**
   * Sort discount codes by priority (non-stackable and higher value first)
   */
  private static async sortDiscountCodes(codes: string[]): Promise<string[]> {
    if (codes.length <= 1) {
      return codes;
    }

    // Fetch all discounts
    const discountPromises = codes.map(code =>
      DiscountService.getDiscountByCode(code)
    );
    const discounts = await Promise.all(discountPromises);

    // Create a map of code to discount
    const discountMap = new Map<string, any>();
    discounts.forEach((discount, index) => {
      if (discount) {
        discountMap.set(codes[index], discount);
      }
    });

    // Sort codes: non-stackable first, then by value (descending)
    return codes.sort((a, b) => {
      const discountA = discountMap.get(a);
      const discountB = discountMap.get(b);

      // If discount not found, move to end
      if (!discountA) return 1;
      if (!discountB) return -1;

      // Non-stackable discounts first
      if (!discountA.stackable && discountB.stackable) return -1;
      if (discountA.stackable && !discountB.stackable) return 1;

      // Then sort by value (descending)
      return discountB.value - discountA.value;
    });
  }

  /**
   * Calculate product-level discount
   *
   * Checks if a product has active promotions and returns the best discount
   */
  static async calculateProductDiscount(
    productId: string,
    quantity: number,
    basePrice: number
  ): Promise<number> {
    try {
      const { prisma } = await import('@/config/database');

      // Find all active discounts that apply to this product
      const discounts = await prisma.discount.findMany({
        where: {
          isActive: true,
          products: {
            some: {
              productId,
            },
          },
        },
        include: {
          products: true,
        },
      });

      if (discounts.length === 0) {
        return 0;
      }

      let bestDiscount = 0;
      const now = new Date();
      const itemSubtotal = basePrice * quantity;

      // Evaluate each discount and find the best one
      for (const discount of discounts) {
        // Check time constraints
        if (discount.startDate && now < discount.startDate) {
          continue;
        }
        if (discount.endDate && now > discount.endDate) {
          continue;
        }

        // Check usage limits
        if (discount.maxUses !== null && discount.usedCount >= discount.maxUses) {
          continue;
        }

        // Check minimum amount requirement (based on item subtotal)
        if (discount.minAmount && itemSubtotal < Number(discount.minAmount)) {
          continue;
        }

        // Calculate discount for this product
        let discountAmount = 0;

        switch (discount.type) {
          case DiscountType.PERCENTAGE:
            const discountDecimal = Number(discount.value) / 100;
            discountAmount = Math.round(itemSubtotal * discountDecimal * 100) / 100;
            break;

          case DiscountType.FIXED_AMOUNT:
            // Fixed amount capped at item subtotal
            discountAmount = Math.min(Number(discount.value), itemSubtotal);
            break;

          case DiscountType.BUY_X_GET_Y:
            // Calculate how many free items
            const threshold = Number(discount.value);
            if (threshold >= 2) {
              const freeItemsCount = Math.floor(quantity / threshold);
              discountAmount = Math.round(basePrice * freeItemsCount * 100) / 100;
            }
            break;

          case DiscountType.FREE_SHIPPING:
            // Free shipping doesn't apply to product-level calculations
            discountAmount = 0;
            break;

          default:
            discountAmount = 0;
        }

        // Keep track of the best discount
        if (discountAmount > bestDiscount) {
          bestDiscount = discountAmount;
        }
      }

      return bestDiscount;
    } catch (error) {
      return 0;
    }
  }
}
