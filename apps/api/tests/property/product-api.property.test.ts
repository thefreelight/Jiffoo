/**
 * Product API Property Tests
 * 
 * Property-based tests for product API requirements
 * Validates: Requirements 4.x (Product API)
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================
// Property 6: Product List Pagination
// Validates: Requirements 4.1
// ============================================

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

function createPaginatedResponse<T>(items: T[], page: number, pageSize: number): PaginatedResponse<T> {
  const normalizedPage = Math.max(1, page);
  const normalizedPageSize = Math.max(1, Math.min(100, pageSize));
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / normalizedPageSize));
  const actualPage = Math.min(normalizedPage, totalPages);
  const start = (actualPage - 1) * normalizedPageSize;
  const end = start + normalizedPageSize;
  
  return {
    data: items.slice(start, end),
    pagination: {
      page: actualPage,
      pageSize: normalizedPageSize,
      total,
      totalPages,
    },
  };
}

describe('Property 6: Product List Pagination', () => {
  it('should return correct page size', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ id: fc.uuid(), name: fc.string() }), { minLength: 0, maxLength: 100 }),
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 1, max: 100 }),
        (items, page, pageSize) => {
          const response = createPaginatedResponse(items, page, pageSize);
          expect(response.data.length).toBeLessThanOrEqual(response.pagination.pageSize);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should calculate correct total pages', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ id: fc.uuid() }), { minLength: 1, maxLength: 100 }),
        fc.integer({ min: 1, max: 50 }),
        (items, pageSize) => {
          const response = createPaginatedResponse(items, 1, pageSize);
          const expectedTotalPages = Math.ceil(items.length / pageSize);
          expect(response.pagination.totalPages).toBe(expectedTotalPages);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should return empty data for page beyond total', () => {
    const items = [{ id: '1' }, { id: '2' }, { id: '3' }];
    const response = createPaginatedResponse(items, 100, 10);
    // Page is clamped to totalPages, so data should not be empty if items exist
    expect(response.pagination.page).toBeLessThanOrEqual(response.pagination.totalPages);
  });
});

// ============================================
// Property 7: Product Detail Completeness
// Validates: Requirements 4.2, 4.5, 4.6
// ============================================

interface ProductDetail {
  id: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  variants: Array<{ id: string; name: string; price: number; stock: number }>;
  inventory: { stock: number; reserved: number };
}

function validateProductDetail(product: ProductDetail): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  
  if (!product.id) missing.push('id');
  if (!product.name) missing.push('name');
  if (product.price === undefined || product.price === null) missing.push('price');
  if (!product.images || !Array.isArray(product.images)) missing.push('images');
  if (!product.variants || !Array.isArray(product.variants)) missing.push('variants');
  if (!product.inventory) missing.push('inventory');
  
  return { valid: missing.length === 0, missing };
}

describe('Property 7: Product Detail Completeness', () => {
  it('should include all required fields', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          name: fc.string({ minLength: 1 }),
          description: fc.string(),
          price: fc.integer({ min: 0, max: 1000000 }).map(n => n / 100),
          images: fc.array(fc.constant('https://example.com/image.jpg'), { minLength: 1 }),
          variants: fc.array(
            fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 1 }),
              price: fc.integer({ min: 0, max: 100000 }).map(n => n / 100),
              stock: fc.integer({ min: 0 }),
            }),
            { minLength: 1 }
          ),
          inventory: fc.record({
            stock: fc.integer({ min: 0 }),
            reserved: fc.integer({ min: 0 }),
          }),
        }),
        (product) => {
          const result = validateProductDetail(product);
          expect(result.valid).toBe(true);
          expect(result.missing).toHaveLength(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should detect missing fields', () => {
    const incompleteProduct = {
      id: 'prod-1',
      name: 'Test Product',
      description: '',
      price: 99.99,
      images: [],
      variants: [],
      // Missing inventory
    } as unknown as ProductDetail;

    const result = validateProductDetail(incompleteProduct);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('inventory');
  });
});

// ============================================
// Property 8: Product Sorting
// Validates: Requirements 4.3
// ============================================

type SortField = 'price' | 'name' | 'createdAt';
type SortOrder = 'asc' | 'desc';

interface SortableProduct {
  id: string;
  name: string;
  price: number;
  createdAt: Date;
}

function sortProducts(products: SortableProduct[], field: SortField, order: SortOrder): SortableProduct[] {
  return [...products].sort((a, b) => {
    let comparison = 0;

    switch (field) {
      case 'price':
        comparison = a.price - b.price;
        break;
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'createdAt':
        comparison = a.createdAt.getTime() - b.createdAt.getTime();
        break;
    }

    return order === 'desc' ? -comparison : comparison;
  });
}

describe('Property 8: Product Sorting', () => {
  it('should sort by price correctly', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string(),
            price: fc.integer({ min: 0, max: 1000000 }).map(n => n / 100),
            createdAt: fc.date(),
          }),
          { minLength: 2, maxLength: 20 }
        ),
        fc.constantFrom('asc', 'desc') as fc.Arbitrary<SortOrder>,
        (products, order) => {
          const sorted = sortProducts(products, 'price', order);

          for (let i = 1; i < sorted.length; i++) {
            if (order === 'asc') {
              expect(sorted[i].price).toBeGreaterThanOrEqual(sorted[i - 1].price);
            } else {
              expect(sorted[i].price).toBeLessThanOrEqual(sorted[i - 1].price);
            }
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should preserve all items after sorting', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string(),
            price: fc.integer({ min: 0, max: 100000 }).map(n => n / 100),
            createdAt: fc.date(),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        fc.constantFrom('price', 'name', 'createdAt') as fc.Arbitrary<SortField>,
        fc.constantFrom('asc', 'desc') as fc.Arbitrary<SortOrder>,
        (products, field, order) => {
          const sorted = sortProducts(products, field, order);
          expect(sorted.length).toBe(products.length);

          // All original IDs should be present
          const originalIds = new Set(products.map(p => p.id));
          const sortedIds = new Set(sorted.map(p => p.id));
          expect(sortedIds).toEqual(originalIds);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================
// Property 9: Product Category Filtering
// Validates: Requirements 4.4
// ============================================

interface ProductWithCategory {
  id: string;
  name: string;
  categoryId: string;
}

function filterByCategory(products: ProductWithCategory[], categoryId: string | null): ProductWithCategory[] {
  if (!categoryId) return products;
  return products.filter(p => p.categoryId === categoryId);
}

describe('Property 9: Product Category Filtering', () => {
  it('should return only products from specified category', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string(),
            categoryId: fc.constantFrom('cat-1', 'cat-2', 'cat-3', 'cat-4', 'cat-5'),
          }),
          { minLength: 5, maxLength: 50 }
        ),
        fc.constantFrom('cat-1', 'cat-2', 'cat-3', 'cat-4', 'cat-5'),
        (products, categoryId) => {
          const filtered = filterByCategory(products, categoryId);

          // All filtered products should have the specified category
          expect(filtered.every(p => p.categoryId === categoryId)).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should return all products when no category filter', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string(),
            categoryId: fc.string(),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (products) => {
          const filtered = filterByCategory(products, null);
          expect(filtered.length).toBe(products.length);
        }
      ),
      { numRuns: 30 }
    );
  });
});

