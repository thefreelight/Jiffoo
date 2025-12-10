/**
 * Product Test Fixtures
 * 
 * Provides consistent test product data.
 */

import { TEST_TENANT } from './tenants.fixture';

// ============================================
// Types
// ============================================

export interface TestProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  stock: number;
  sku?: string;
  tenantId: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  categoryId?: string;
}

// ============================================
// Test Products
// ============================================

export const TEST_PRODUCT: TestProduct = {
  id: 'test-product-001',
  name: 'Test Product',
  slug: 'test-product',
  description: 'A test product for testing purposes',
  price: 29.99,
  compareAtPrice: 39.99,
  stock: 100,
  sku: 'SKU-TEST-001',
  tenantId: TEST_TENANT.id,
  status: 'PUBLISHED',
};

export const TEST_PRODUCT_LOW_STOCK: TestProduct = {
  id: 'test-product-low-stock',
  name: 'Low Stock Product',
  slug: 'low-stock-product',
  description: 'A product with low stock',
  price: 19.99,
  stock: 5,
  sku: 'SKU-LOW-001',
  tenantId: TEST_TENANT.id,
  status: 'PUBLISHED',
};

export const TEST_PRODUCT_OUT_OF_STOCK: TestProduct = {
  id: 'test-product-out-of-stock',
  name: 'Out of Stock Product',
  slug: 'out-of-stock-product',
  description: 'A product that is out of stock',
  price: 49.99,
  stock: 0,
  sku: 'SKU-OUT-001',
  tenantId: TEST_TENANT.id,
  status: 'PUBLISHED',
};

export const TEST_PRODUCT_EXPENSIVE: TestProduct = {
  id: 'test-product-expensive',
  name: 'Expensive Product',
  slug: 'expensive-product',
  description: 'A high-value product',
  price: 999.99,
  compareAtPrice: 1299.99,
  stock: 50,
  sku: 'SKU-EXP-001',
  tenantId: TEST_TENANT.id,
  status: 'PUBLISHED',
};

export const TEST_PRODUCT_DRAFT: TestProduct = {
  id: 'test-product-draft',
  name: 'Draft Product',
  slug: 'draft-product',
  description: 'A product in draft status',
  price: 15.99,
  stock: 25,
  tenantId: TEST_TENANT.id,
  status: 'DRAFT',
};

// ============================================
// All Products
// ============================================

export const ALL_TEST_PRODUCTS: TestProduct[] = [
  TEST_PRODUCT,
  TEST_PRODUCT_LOW_STOCK,
  TEST_PRODUCT_OUT_OF_STOCK,
  TEST_PRODUCT_EXPENSIVE,
  TEST_PRODUCT_DRAFT,
];

export const PUBLISHED_TEST_PRODUCTS = ALL_TEST_PRODUCTS.filter(p => p.status === 'PUBLISHED');

// ============================================
// Factory Functions
// ============================================

/**
 * Create a custom test product
 */
export function createTestProduct(overrides: Partial<TestProduct> = {}): TestProduct {
  const id = overrides.id ?? `test-product-${Date.now()}`;
  return {
    ...TEST_PRODUCT,
    id,
    slug: overrides.slug ?? `product-${id}`,
    sku: overrides.sku ?? `SKU-${id}`,
    ...overrides,
  };
}

/**
 * Get product data for Prisma create
 */
export function getProductCreateData(product: TestProduct) {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    stock: product.stock,
    sku: product.sku,
    tenantId: product.tenantId,
    status: product.status,
  };
}

export default {
  TEST_PRODUCT,
  TEST_PRODUCT_LOW_STOCK,
  TEST_PRODUCT_OUT_OF_STOCK,
  TEST_PRODUCT_EXPENSIVE,
  TEST_PRODUCT_DRAFT,
  ALL_TEST_PRODUCTS,
  PUBLISHED_TEST_PRODUCTS,
  createTestProduct,
  getProductCreateData,
};

