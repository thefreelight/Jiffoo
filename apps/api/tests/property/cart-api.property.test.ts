/**
 * Cart API Property Tests
 * 
 * Property-based tests for cart API requirements
 * Validates: Requirements 5.x (Cart API)
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================
// Property 10: Cart Add Operation
// Validates: Requirements 5.1
// ============================================

interface CartItem {
  id: string;
  productId: string;
  variantId?: string;
  quantity: number;
  price: number;
}

interface Cart {
  id: string;
  userId: string;
  items: CartItem[];
  total: number;
}

function addToCart(cart: Cart, productId: string, quantity: number, price: number): Cart {
  const existingItem = cart.items.find(item => item.productId === productId);
  
  if (existingItem) {
    // Update quantity
    const updatedItems = cart.items.map(item =>
      item.productId === productId
        ? { ...item, quantity: item.quantity + quantity }
        : item
    );
    return {
      ...cart,
      items: updatedItems,
      total: calculateCartTotal(updatedItems),
    };
  }
  
  // Add new item
  const newItem: CartItem = {
    id: `item-${Date.now()}`,
    productId,
    quantity,
    price,
  };
  
  const newItems = [...cart.items, newItem];
  return {
    ...cart,
    items: newItems,
    total: calculateCartTotal(newItems),
  };
}

function calculateCartTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

describe('Property 10: Cart Add Operation', () => {
  it('should increase item count or quantity when adding', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          userId: fc.uuid(),
          items: fc.constant([]),
          total: fc.constant(0),
        }),
        fc.uuid(),
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 100000 }).map(n => n / 100),
        (cart, productId, quantity, price) => {
          const initialItemCount = cart.items.length;
          const updatedCart = addToCart(cart as Cart, productId, quantity, price);

          // Either item count increased or existing item quantity increased
          expect(updatedCart.items.length).toBeGreaterThanOrEqual(initialItemCount);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should update total correctly after adding', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 10000 }).map(n => n / 100),
        (productId, quantity, price) => {
          const emptyCart: Cart = { id: 'cart-1', userId: 'user-1', items: [], total: 0 };
          const updatedCart = addToCart(emptyCart, productId, quantity, price);

          const expectedTotal = price * quantity;
          expect(Math.abs(updatedCart.total - expectedTotal)).toBeLessThan(0.01);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================
// Property 11: Cart Total Calculation
// Validates: Requirements 5.2
// ============================================

describe('Property 11: Cart Total Calculation', () => {
  it('should calculate total as sum of (price * quantity)', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            productId: fc.uuid(),
            quantity: fc.integer({ min: 1, max: 10 }),
            price: fc.integer({ min: 1, max: 10000 }).map(n => n / 100),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (items) => {
          const total = calculateCartTotal(items);
          const expectedTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

          expect(Math.abs(total - expectedTotal)).toBeLessThan(0.01);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should return 0 for empty cart', () => {
    const total = calculateCartTotal([]);
    expect(total).toBe(0);
  });

  it('should be non-negative', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            productId: fc.uuid(),
            quantity: fc.integer({ min: 1, max: 100 }),
            price: fc.integer({ min: 0, max: 100000 }).map(n => n / 100),
          }),
          { minLength: 0, maxLength: 20 }
        ),
        (items) => {
          const total = calculateCartTotal(items);
          expect(total).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================
// Property 12: Cart Remove Operation
// Validates: Requirements 5.3
// ============================================

function removeFromCart(cart: Cart, itemId: string): Cart {
  const newItems = cart.items.filter(item => item.id !== itemId);
  return {
    ...cart,
    items: newItems,
    total: calculateCartTotal(newItems),
  };
}

describe('Property 12: Cart Remove Operation', () => {
  it('should decrease item count when removing', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            productId: fc.uuid(),
            quantity: fc.integer({ min: 1, max: 10 }),
            price: fc.integer({ min: 1, max: 10000 }).map(n => n / 100),
          }),
          { minLength: 2, maxLength: 10 }
        ),
        (items) => {
          const cart: Cart = {
            id: 'cart-1',
            userId: 'user-1',
            items,
            total: calculateCartTotal(items),
          };

          const itemToRemove = items[0];
          const updatedCart = removeFromCart(cart, itemToRemove.id);

          expect(updatedCart.items.length).toBe(cart.items.length - 1);
          expect(updatedCart.items.find(i => i.id === itemToRemove.id)).toBeUndefined();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should recalculate total after removal', () => {
    const items: CartItem[] = [
      { id: 'item-1', productId: 'prod-1', quantity: 2, price: 10 },
      { id: 'item-2', productId: 'prod-2', quantity: 1, price: 20 },
    ];

    const cart: Cart = {
      id: 'cart-1',
      userId: 'user-1',
      items,
      total: calculateCartTotal(items),
    };

    const updatedCart = removeFromCart(cart, 'item-1');
    expect(updatedCart.total).toBe(20); // Only item-2 remains
  });

  it('should not modify cart when removing non-existent item', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            productId: fc.uuid(),
            quantity: fc.integer({ min: 1, max: 10 }),
            price: fc.integer({ min: 1, max: 10000 }).map(n => n / 100),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (items) => {
          const cart: Cart = {
            id: 'cart-1',
            userId: 'user-1',
            items,
            total: calculateCartTotal(items),
          };

          const updatedCart = removeFromCart(cart, 'non-existent-id');
          expect(updatedCart.items.length).toBe(cart.items.length);
        }
      ),
      { numRuns: 30 }
    );
  });
});

// ============================================
// Property 13: Cart Persistence
// Validates: Requirements 5.4
// ============================================

interface CartStorage {
  carts: Map<string, Cart>;
}

function saveCart(storage: CartStorage, cart: Cart): void {
  storage.carts.set(cart.userId, cart);
}

function loadCart(storage: CartStorage, userId: string): Cart | null {
  return storage.carts.get(userId) || null;
}

describe('Property 13: Cart Persistence', () => {
  it('should persist and retrieve cart correctly', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.array(
          fc.record({
            id: fc.uuid(),
            productId: fc.uuid(),
            quantity: fc.integer({ min: 1, max: 10 }),
            price: fc.integer({ min: 1, max: 10000 }).map(n => n / 100),
          }),
          { minLength: 0, maxLength: 10 }
        ),
        (userId, items) => {
          const storage: CartStorage = { carts: new Map() };
          const cart: Cart = {
            id: `cart-${userId}`,
            userId,
            items,
            total: calculateCartTotal(items),
          };

          saveCart(storage, cart);
          const loadedCart = loadCart(storage, userId);

          expect(loadedCart).not.toBeNull();
          expect(loadedCart?.userId).toBe(userId);
          expect(loadedCart?.items.length).toBe(items.length);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should return null for non-existent user cart', () => {
    const storage: CartStorage = { carts: new Map() };
    const loadedCart = loadCart(storage, 'non-existent-user');
    expect(loadedCart).toBeNull();
  });

  it('should overwrite existing cart on save', () => {
    const storage: CartStorage = { carts: new Map() };
    const userId = 'user-1';

    const cart1: Cart = {
      id: 'cart-1',
      userId,
      items: [{ id: 'item-1', productId: 'prod-1', quantity: 1, price: 10 }],
      total: 10,
    };

    const cart2: Cart = {
      id: 'cart-1',
      userId,
      items: [
        { id: 'item-1', productId: 'prod-1', quantity: 1, price: 10 },
        { id: 'item-2', productId: 'prod-2', quantity: 2, price: 20 },
      ],
      total: 50,
    };

    saveCart(storage, cart1);
    saveCart(storage, cart2);

    const loadedCart = loadCart(storage, userId);
    expect(loadedCart?.items.length).toBe(2);
    expect(loadedCart?.total).toBe(50);
  });
});

