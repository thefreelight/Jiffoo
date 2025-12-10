/**
 * Order Test Fixtures
 * 
 * Provides consistent test order data.
 */

import { TEST_TENANT } from './tenants.fixture';
import { TEST_USER } from './users.fixture';
import { TEST_PRODUCT, TEST_PRODUCT_EXPENSIVE } from './products.fixture';

// ============================================
// Types
// ============================================

export interface TestOrderItem {
  id: string;
  productId: string;
  quantity: number;
  price: number;
  total: number;
}

export interface TestOrder {
  id: string;
  orderNumber: string;
  userId: string;
  tenantId: number;
  status: 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED';
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  items: TestOrderItem[];
  shippingAddress?: {
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
}

// ============================================
// Test Order Items
// ============================================

export const TEST_ORDER_ITEM: TestOrderItem = {
  id: 'test-order-item-001',
  productId: TEST_PRODUCT.id,
  quantity: 2,
  price: TEST_PRODUCT.price,
  total: TEST_PRODUCT.price * 2,
};

export const TEST_ORDER_ITEM_EXPENSIVE: TestOrderItem = {
  id: 'test-order-item-002',
  productId: TEST_PRODUCT_EXPENSIVE.id,
  quantity: 1,
  price: TEST_PRODUCT_EXPENSIVE.price,
  total: TEST_PRODUCT_EXPENSIVE.price,
};

// ============================================
// Test Orders
// ============================================

export const TEST_ORDER: TestOrder = {
  id: 'test-order-001',
  orderNumber: 'ORD-TEST-001',
  userId: TEST_USER.id,
  tenantId: TEST_TENANT.id,
  status: 'PENDING',
  paymentStatus: 'PENDING',
  subtotal: TEST_ORDER_ITEM.total,
  tax: TEST_ORDER_ITEM.total * 0.1,
  shipping: 10.00,
  total: TEST_ORDER_ITEM.total * 1.1 + 10.00,
  items: [TEST_ORDER_ITEM],
  shippingAddress: {
    name: 'Test User',
    address: '123 Test Street',
    city: 'Test City',
    state: 'TS',
    zip: '12345',
    country: 'US',
  },
};

export const TEST_ORDER_PAID: TestOrder = {
  ...TEST_ORDER,
  id: 'test-order-paid',
  orderNumber: 'ORD-TEST-002',
  status: 'PROCESSING',
  paymentStatus: 'PAID',
};

export const TEST_ORDER_SHIPPED: TestOrder = {
  ...TEST_ORDER,
  id: 'test-order-shipped',
  orderNumber: 'ORD-TEST-003',
  status: 'SHIPPED',
  paymentStatus: 'PAID',
};

export const TEST_ORDER_DELIVERED: TestOrder = {
  ...TEST_ORDER,
  id: 'test-order-delivered',
  orderNumber: 'ORD-TEST-004',
  status: 'DELIVERED',
  paymentStatus: 'PAID',
};

export const TEST_ORDER_CANCELLED: TestOrder = {
  ...TEST_ORDER,
  id: 'test-order-cancelled',
  orderNumber: 'ORD-TEST-005',
  status: 'CANCELLED',
  paymentStatus: 'REFUNDED',
};

// ============================================
// All Orders
// ============================================

export const ALL_TEST_ORDERS: TestOrder[] = [
  TEST_ORDER,
  TEST_ORDER_PAID,
  TEST_ORDER_SHIPPED,
  TEST_ORDER_DELIVERED,
  TEST_ORDER_CANCELLED,
];

// ============================================
// Factory Functions
// ============================================

/**
 * Create a custom test order
 */
export function createTestOrder(overrides: Partial<TestOrder> = {}): TestOrder {
  const id = overrides.id ?? `test-order-${Date.now()}`;
  return {
    ...TEST_ORDER,
    id,
    orderNumber: overrides.orderNumber ?? `ORD-${Date.now()}`,
    ...overrides,
  };
}

/**
 * Calculate order totals
 */
export function calculateOrderTotals(items: TestOrderItem[], taxRate = 0.1, shippingCost = 10) {
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const tax = subtotal * taxRate;
  const total = subtotal + tax + shippingCost;
  return { subtotal, tax, shipping: shippingCost, total };
}

export default {
  TEST_ORDER,
  TEST_ORDER_ITEM,
  TEST_ORDER_PAID,
  TEST_ORDER_SHIPPED,
  TEST_ORDER_DELIVERED,
  TEST_ORDER_CANCELLED,
  ALL_TEST_ORDERS,
  createTestOrder,
  calculateOrderTotals,
};

