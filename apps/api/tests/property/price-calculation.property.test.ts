/**
 * Price Calculation Property-Based Tests
 * 
 * Verifies price calculation invariants using fast-check.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Price calculation helpers (mirrors actual business logic)
const calculateItemSubtotal = (price: number, quantity: number): number => {
  return Math.round(price * quantity * 100) / 100;
};

const calculateCartTotal = (items: { price: number; quantity: number }[]): number => {
  const total = items.reduce((sum, item) => sum + calculateItemSubtotal(item.price, item.quantity), 0);
  return Math.round(total * 100) / 100;
};

const calculateTax = (subtotal: number, taxRate: number): number => {
  return Math.round(subtotal * taxRate * 100) / 100;
};

const calculateDiscount = (subtotal: number, discountPercent: number): number => {
  return Math.round(subtotal * (discountPercent / 100) * 100) / 100;
};

// Use Math.fround for 32-bit float constraints
const MIN_PRICE = Math.fround(0.01);
const MAX_PRICE = Math.fround(10000);
const MAX_SMALL_PRICE = Math.fround(100);
const MAX_MEDIUM_PRICE = Math.fround(1000);
const MAX_TAX_RATE = Math.fround(0.5);
const MAX_PERCENT = Math.fround(100);

describe('Price Calculation Property Tests', () => {
  describe('Item Subtotal Invariants', () => {
    it('should always be non-negative (100+ iterations)', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: MAX_PRICE, noNaN: true }),
          fc.integer({ min: 0, max: 1000 }),
          (price, quantity) => {
            const subtotal = calculateItemSubtotal(price, quantity);
            expect(subtotal).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be zero when quantity is zero', () => {
      fc.assert(
        fc.property(
          fc.float({ min: MIN_PRICE, max: MAX_PRICE, noNaN: true }),
          (price) => {
            const subtotal = calculateItemSubtotal(price, 0);
            expect(subtotal).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should scale linearly with quantity', () => {
      fc.assert(
        fc.property(
          fc.float({ min: MIN_PRICE, max: MAX_SMALL_PRICE, noNaN: true }),
          fc.integer({ min: 1, max: 100 }),
          (price, quantity) => {
            const subtotal1 = calculateItemSubtotal(price, quantity);
            const subtotal2 = calculateItemSubtotal(price, quantity * 2);

            // Allow for floating point tolerance
            expect(subtotal2).toBeCloseTo(subtotal1 * 2, 1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Cart Total Invariants', () => {
    it('should equal sum of item subtotals', () => {
      const itemArb = fc.record({
        price: fc.float({ min: MIN_PRICE, max: MAX_MEDIUM_PRICE, noNaN: true }),
        quantity: fc.integer({ min: 1, max: 10 }),
      });

      fc.assert(
        fc.property(
          fc.array(itemArb, { minLength: 1, maxLength: 10 }),
          (items) => {
            const total = calculateCartTotal(items);
            const sumOfSubtotals = items.reduce(
              (sum, item) => sum + calculateItemSubtotal(item.price, item.quantity),
              0
            );

            expect(total).toBeCloseTo(Math.round(sumOfSubtotals * 100) / 100, 2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be zero for empty cart', () => {
      const total = calculateCartTotal([]);
      expect(total).toBe(0);
    });
  });

  describe('Tax Calculation Invariants', () => {
    it('should be proportional to subtotal', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: MAX_PRICE, noNaN: true }),
          fc.float({ min: 0, max: MAX_TAX_RATE, noNaN: true }),
          (subtotal, taxRate) => {
            const tax = calculateTax(subtotal, taxRate);
            expect(tax).toBeGreaterThanOrEqual(0);
            expect(tax).toBeLessThanOrEqual(subtotal * 0.5 + 0.01);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be zero when tax rate is zero', () => {
      fc.assert(
        fc.property(
          fc.float({ min: MIN_PRICE, max: MAX_PRICE, noNaN: true }),
          (subtotal) => {
            const tax = calculateTax(subtotal, 0);
            expect(tax).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Discount Calculation Invariants', () => {
    it('should never exceed subtotal', () => {
      fc.assert(
        fc.property(
          fc.float({ min: MIN_PRICE, max: MAX_PRICE, noNaN: true }),
          fc.float({ min: 0, max: MAX_PERCENT, noNaN: true }),
          (subtotal, discountPercent) => {
            const discount = calculateDiscount(subtotal, discountPercent);
            expect(discount).toBeLessThanOrEqual(subtotal + 0.01);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be zero when discount percent is zero', () => {
      fc.assert(
        fc.property(
          fc.float({ min: MIN_PRICE, max: MAX_PRICE, noNaN: true }),
          (subtotal) => {
            const discount = calculateDiscount(subtotal, 0);
            expect(discount).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should equal subtotal when discount is 100%', () => {
      fc.assert(
        fc.property(
          fc.float({ min: MIN_PRICE, max: MAX_PRICE, noNaN: true }),
          (subtotal) => {
            const discount = calculateDiscount(subtotal, 100);
            expect(discount).toBeCloseTo(subtotal, 2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

