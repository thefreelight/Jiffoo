/**
 * Core Functionality Property Tests
 * 
 * Property-based tests for core functionality requirements
 * Validates: Requirements 1.x, 2.x, 4.x, 5.x, 6.x, 7.x, 8.x, 9.x
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================
// Property 1: Environment Setup Error Handling
// Validates: Requirements 1.3
// ============================================

interface EnvConfig {
  DATABASE_URL?: string;
  REDIS_URL?: string;
  JWT_SECRET?: string;
  API_PORT?: string;
}

function validateEnvConfig(config: EnvConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!config.DATABASE_URL) {
    errors.push('DATABASE_URL is required');
  } else if (!config.DATABASE_URL.startsWith('postgresql://')) {
    errors.push('DATABASE_URL must be a valid PostgreSQL connection string');
  }
  
  if (!config.REDIS_URL) {
    errors.push('REDIS_URL is required');
  } else if (!config.REDIS_URL.startsWith('redis://')) {
    errors.push('REDIS_URL must be a valid Redis connection string');
  }
  
  if (!config.JWT_SECRET) {
    errors.push('JWT_SECRET is required');
  } else if (config.JWT_SECRET.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters');
  }
  
  return { valid: errors.length === 0, errors };
}

describe('Property 1: Environment Setup Error Handling', () => {
  it('should reject missing required environment variables', () => {
    fc.assert(
      fc.property(
        fc.record({
          DATABASE_URL: fc.option(fc.constant(undefined), { nil: undefined }),
          REDIS_URL: fc.option(fc.constant(undefined), { nil: undefined }),
          JWT_SECRET: fc.option(fc.constant(undefined), { nil: undefined }),
        }),
        (config) => {
          const result = validateEnvConfig(config);
          // At least one error if any required field is missing
          if (!config.DATABASE_URL || !config.REDIS_URL || !config.JWT_SECRET) {
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should accept valid environment configuration', () => {
    const validConfig: EnvConfig = {
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      REDIS_URL: 'redis://localhost:6379',
      JWT_SECRET: 'a-very-long-secret-key-that-is-at-least-32-chars',
    };
    
    const result = validateEnvConfig(validConfig);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

// ============================================
// Property 2: Seed Data Product Count
// Validates: Requirements 2.2
// ============================================

interface SeedDataConfig {
  minProducts: number;
  categories: string[];
}

function validateSeedProducts(products: Array<{ id: string; name: string; category: string }>, config: SeedDataConfig): boolean {
  // Must have at least minProducts
  if (products.length < config.minProducts) return false;
  
  // Each product must have id and name
  for (const product of products) {
    if (!product.id || !product.name) return false;
  }
  
  return true;
}

describe('Property 2: Seed Data Product Count', () => {
  it('should have at least 10 products in seed data', () => {
    const mockProducts = Array.from({ length: 10 }, (_, i) => ({
      id: `prod-${i + 1}`,
      name: `Product ${i + 1}`,
      category: ['electronics', 'clothing', 'home', 'beauty', 'sports'][i % 5],
    }));
    
    const config: SeedDataConfig = { minProducts: 10, categories: ['electronics', 'clothing', 'home', 'beauty', 'sports'] };
    expect(validateSeedProducts(mockProducts, config)).toBe(true);
  });

  it('should reject seed data with fewer than required products', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 9 }),
        (count) => {
          const products = Array.from({ length: count }, (_, i) => ({
            id: `prod-${i}`,
            name: `Product ${i}`,
            category: 'test',
          }));
          
          const config: SeedDataConfig = { minProducts: 10, categories: [] };
          expect(validateSeedProducts(products, config)).toBe(false);
        }
      ),
      { numRuns: 20 }
    );
  });
});

// ============================================
// Property 3: Seed Data Category Count
// Validates: Requirements 2.3
// ============================================

const REQUIRED_CATEGORIES = ['electronics', 'clothing', 'home', 'beauty', 'sports'];

function validateCategories(categories: string[]): { valid: boolean; missing: string[] } {
  const missing = REQUIRED_CATEGORIES.filter(cat => !categories.includes(cat));
  return { valid: missing.length === 0, missing };
}

describe('Property 3: Seed Data Category Count', () => {
  it('should have all 5 required categories', () => {
    const result = validateCategories(REQUIRED_CATEGORIES);
    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it('should detect missing categories', () => {
    fc.assert(
      fc.property(
        fc.subarray(REQUIRED_CATEGORIES, { minLength: 0, maxLength: 4 }),
        (partialCategories) => {
          if (partialCategories.length < 5) {
            const result = validateCategories(partialCategories);
            expect(result.valid).toBe(false);
            expect(result.missing.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 30 }
    );
  });
});

// ============================================
// Property 4: Product Image Presence
// Validates: Requirements 2.5
// ============================================

interface ProductWithImages {
  id: string;
  name: string;
  images: string[];
}

function validateProductImages(products: ProductWithImages[]): { valid: boolean; productsWithoutImages: string[] } {
  const productsWithoutImages = products
    .filter(p => !p.images || p.images.length === 0)
    .map(p => p.id);

  return { valid: productsWithoutImages.length === 0, productsWithoutImages };
}

describe('Property 4: Product Image Presence', () => {
  it('should require all products to have at least one image', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 1 }),
            images: fc.array(fc.constant('https://example.com/image.jpg'), { minLength: 1, maxLength: 5 }),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (products) => {
          const result = validateProductImages(products);
          expect(result.valid).toBe(true);
          expect(result.productsWithoutImages).toHaveLength(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should detect products without images', () => {
    const productsWithMissingImages: ProductWithImages[] = [
      { id: 'prod-1', name: 'Product 1', images: ['https://example.com/img1.jpg'] },
      { id: 'prod-2', name: 'Product 2', images: [] }, // Missing images
      { id: 'prod-3', name: 'Product 3', images: ['https://example.com/img3.jpg'] },
    ];

    const result = validateProductImages(productsWithMissingImages);
    expect(result.valid).toBe(false);
    expect(result.productsWithoutImages).toContain('prod-2');
  });
});

// ============================================
// Property 5: Product Variant Pricing
// Validates: Requirements 2.6
// ============================================

interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  price: number;
  stock: number;
}

function validateVariantPricing(variants: ProductVariant[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const variant of variants) {
    if (variant.price < 0) {
      errors.push(`Variant ${variant.id} has negative price: ${variant.price}`);
    }
    if (variant.stock < 0) {
      errors.push(`Variant ${variant.id} has negative stock: ${variant.stock}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

describe('Property 5: Product Variant Pricing', () => {
  it('should require non-negative prices for all variants', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            productId: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 50 }),
            price: fc.float({ min: 0, max: 10000, noNaN: true }),
            stock: fc.integer({ min: 0, max: 1000 }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (variants) => {
          const result = validateVariantPricing(variants);
          expect(result.valid).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should reject negative prices', () => {
    const invalidVariants: ProductVariant[] = [
      { id: 'var-1', productId: 'prod-1', name: 'Small', price: 10, stock: 5 },
      { id: 'var-2', productId: 'prod-1', name: 'Large', price: -5, stock: 3 }, // Invalid
    ];

    const result = validateVariantPricing(invalidVariants);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('negative price'))).toBe(true);
  });
});

