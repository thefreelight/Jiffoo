/**
 * Inventory Property Tests
 * 
 * Property-based tests for inventory reservation invariants using fast-check
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Pure functions for inventory calculations (no DB dependency)

/**
 * Calculate available stock after reservations
 */
function calculateAvailableStock(totalStock: number, reservedQuantity: number): number {
  return Math.max(0, totalStock - reservedQuantity);
}

/**
 * Check if stock is sufficient for requested quantity
 */
function isStockSufficient(available: number, requested: number): boolean {
  return available >= requested;
}

/**
 * Calculate total reserved quantity from reservations
 */
function calculateTotalReserved(reservations: Array<{ quantity: number; status: string }>): number {
  return reservations
    .filter(r => r.status === 'ACTIVE')
    .reduce((sum, r) => sum + r.quantity, 0);
}

/**
 * Simulate creating a reservation
 */
function createReservation(
  stock: number,
  currentReserved: number,
  requestedQty: number
): { success: boolean; newReserved: number } {
  const available = calculateAvailableStock(stock, currentReserved);
  if (available >= requestedQty) {
    return { success: true, newReserved: currentReserved + requestedQty };
  }
  return { success: false, newReserved: currentReserved };
}

/**
 * Simulate confirming a reservation (decrement actual stock)
 */
function confirmReservation(
  stock: number,
  reservedQty: number
): { newStock: number; newReserved: number } {
  return {
    newStock: stock - reservedQty,
    newReserved: 0, // Reservation is cleared after confirmation
  };
}

describe('Inventory Property Tests', () => {
  describe('Available Stock Invariants', () => {
    it('should never be negative (100+ iterations)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10000 }), // totalStock
          fc.integer({ min: 0, max: 15000 }), // reservedQuantity (can exceed stock)
          (totalStock, reservedQuantity) => {
            const available = calculateAvailableStock(totalStock, reservedQuantity);
            expect(available).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should equal total stock when no reservations', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10000 }),
          (totalStock) => {
            const available = calculateAvailableStock(totalStock, 0);
            expect(available).toBe(totalStock);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should decrease by reserved amount when reserved < stock', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10000 }),
          (totalStock) => {
            const reserved = Math.floor(totalStock / 2); // Always less than stock
            const available = calculateAvailableStock(totalStock, reserved);
            expect(available).toBe(totalStock - reserved);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Reservation Creation Invariants', () => {
    it('should succeed when available stock is sufficient', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10, max: 1000 }), // stock
          fc.integer({ min: 0, max: 5 }),     // currentReserved (small)
          fc.integer({ min: 1, max: 5 }),     // requestedQty (small)
          (stock, currentReserved, requestedQty) => {
            const available = calculateAvailableStock(stock, currentReserved);
            if (available >= requestedQty) {
              const result = createReservation(stock, currentReserved, requestedQty);
              expect(result.success).toBe(true);
              expect(result.newReserved).toBe(currentReserved + requestedQty);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should fail when available stock is insufficient', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),  // stock
          fc.integer({ min: 50, max: 200 }), // currentReserved (high)
          fc.integer({ min: 1, max: 100 }),  // requestedQty
          (stock, currentReserved, requestedQty) => {
            const available = calculateAvailableStock(stock, currentReserved);
            if (available < requestedQty) {
              const result = createReservation(stock, currentReserved, requestedQty);
              expect(result.success).toBe(false);
              expect(result.newReserved).toBe(currentReserved); // Unchanged
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve reservation count on failure', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10 }),   // stock (low)
          fc.integer({ min: 0, max: 10 }),   // currentReserved
          fc.integer({ min: 100, max: 200 }), // requestedQty (high - will fail)
          (stock, currentReserved, requestedQty) => {
            const result = createReservation(stock, currentReserved, requestedQty);
            if (!result.success) {
              expect(result.newReserved).toBe(currentReserved);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Reservation Confirmation Invariants', () => {
    it('should decrement stock by reserved quantity', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10, max: 1000 }), // stock
          fc.integer({ min: 1, max: 10 }),    // reservedQty (always <= stock/10)
          (stock, reservedQty) => {
            const adjustedReserved = Math.min(reservedQty, stock);
            const result = confirmReservation(stock, adjustedReserved);
            expect(result.newStock).toBe(stock - adjustedReserved);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should clear reservation after confirmation', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10, max: 1000 }),
          fc.integer({ min: 1, max: 10 }),
          (stock, reservedQty) => {
            const result = confirmReservation(stock, Math.min(reservedQty, stock));
            expect(result.newReserved).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Total Reserved Calculation Invariants', () => {
    it('should only count ACTIVE reservations', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              quantity: fc.integer({ min: 1, max: 100 }),
              status: fc.constantFrom('ACTIVE', 'RELEASED', 'CONFIRMED'),
            }),
            { minLength: 0, maxLength: 20 }
          ),
          (reservations) => {
            const total = calculateTotalReserved(reservations);
            const expectedTotal = reservations
              .filter(r => r.status === 'ACTIVE')
              .reduce((sum, r) => sum + r.quantity, 0);
            expect(total).toBe(expectedTotal);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return 0 for empty reservations', () => {
      const total = calculateTotalReserved([]);
      expect(total).toBe(0);
    });

    it('should return 0 when all reservations are non-ACTIVE', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              quantity: fc.integer({ min: 1, max: 100 }),
              status: fc.constantFrom('RELEASED', 'CONFIRMED'),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (reservations) => {
            const total = calculateTotalReserved(reservations);
            expect(total).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Stock Conservation Invariant', () => {
    it('should maintain: totalStock = available + reserved (for valid states)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10000 }), // totalStock
          fc.integer({ min: 0, max: 10000 }), // reservedQuantity
          (totalStock, reservedQuantity) => {
            // Only test valid states where reserved <= total
            if (reservedQuantity <= totalStock) {
              const available = calculateAvailableStock(totalStock, reservedQuantity);
              expect(available + reservedQuantity).toBe(totalStock);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

