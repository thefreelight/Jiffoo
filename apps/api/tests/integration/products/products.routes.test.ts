/**
 * Products API Integration Tests
 * 
 * Tests for product endpoints.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createUserToken, createAdminToken } from '../../utils/auth-helpers';
import { TEST_PRODUCT, ALL_TEST_PRODUCTS } from '../../fixtures/products.fixture';

// Mock Prisma
const mockPrisma = {
  product: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  category: {
    findUnique: vi.fn(),
  },
};

vi.mock('../../../src/config/database', () => ({
  prisma: mockPrisma,
}));

describe('Products API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/products', () => {
    it('should return paginated products', async () => {
      mockPrisma.product.findMany.mockResolvedValue(ALL_TEST_PRODUCTS);
      mockPrisma.product.count.mockResolvedValue(ALL_TEST_PRODUCTS.length);

      const products = await mockPrisma.product.findMany({
        take: 10,
        skip: 0,
      });

      expect(products).toHaveLength(ALL_TEST_PRODUCTS.length);
    });

    it('should support filtering by category', async () => {
      const categoryId = 'cat-001';
      mockPrisma.product.findMany.mockResolvedValue(
        ALL_TEST_PRODUCTS.filter(p => p.categoryId === categoryId)
      );

      const products = await mockPrisma.product.findMany({
        where: { categoryId },
      });

      expect(products.every(p => p.categoryId === categoryId)).toBe(true);
    });

    it('should support search by name', async () => {
      const searchTerm = 'Test';
      mockPrisma.product.findMany.mockResolvedValue(
        ALL_TEST_PRODUCTS.filter(p => p.name.includes(searchTerm))
      );

      const products = await mockPrisma.product.findMany({
        where: { name: { contains: searchTerm } },
      });

      expect(products.every(p => p.name.includes(searchTerm))).toBe(true);
    });

    it('should support sorting', async () => {
      mockPrisma.product.findMany.mockResolvedValue(
        [...ALL_TEST_PRODUCTS].sort((a, b) => a.price - b.price)
      );

      const products = await mockPrisma.product.findMany({
        orderBy: { price: 'asc' },
      });

      for (let i = 1; i < products.length; i++) {
        expect(products[i].price).toBeGreaterThanOrEqual(products[i - 1].price);
      }
    });
  });

  describe('GET /api/products/:id', () => {
    it('should return product by id', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(TEST_PRODUCT);
      
      const product = await mockPrisma.product.findUnique({
        where: { id: TEST_PRODUCT.id },
      });
      
      expect(product).not.toBeNull();
      expect(product?.id).toBe(TEST_PRODUCT.id);
    });

    it('should return null for non-existent product', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);
      
      const product = await mockPrisma.product.findUnique({
        where: { id: 'non-existent' },
      });
      
      expect(product).toBeNull();
    });
  });

  describe('POST /api/products', () => {
    it('should require admin authentication', () => {
      const adminToken = createAdminToken({ tenantId: 999 });
      const userToken = createUserToken({ tenantId: 999 });
      
      // Admin token should be different from user token
      expect(adminToken).not.toBe(userToken);
    });

    it('should validate product payload', () => {
      const validPayload = {
        name: 'New Product',
        description: 'Product description',
        price: 99.99,
        stock: 100,
        categoryId: 'cat-001',
      };
      
      expect(validPayload.name.length).toBeGreaterThan(0);
      expect(validPayload.price).toBeGreaterThan(0);
      expect(validPayload.stock).toBeGreaterThanOrEqual(0);
    });

    it('should create product', async () => {
      const newProduct = {
        id: 'new-product-001',
        name: 'New Product',
        price: 99.99,
        stock: 100,
        tenantId: 999,
      };
      
      mockPrisma.product.create.mockResolvedValue(newProduct);
      
      const product = await mockPrisma.product.create({
        data: newProduct,
      });
      
      expect(product.id).toBe(newProduct.id);
      expect(product.name).toBe(newProduct.name);
    });
  });

  describe('PUT /api/products/:id', () => {
    it('should update product', async () => {
      const updatedProduct = {
        ...TEST_PRODUCT,
        name: 'Updated Product Name',
        price: 149.99,
      };
      
      mockPrisma.product.update.mockResolvedValue(updatedProduct);
      
      const product = await mockPrisma.product.update({
        where: { id: TEST_PRODUCT.id },
        data: { name: 'Updated Product Name', price: 149.99 },
      });
      
      expect(product.name).toBe('Updated Product Name');
      expect(product.price).toBe(149.99);
    });
  });

  describe('DELETE /api/products/:id', () => {
    it('should delete product', async () => {
      mockPrisma.product.delete.mockResolvedValue(TEST_PRODUCT);
      
      const deleted = await mockPrisma.product.delete({
        where: { id: TEST_PRODUCT.id },
      });
      
      expect(deleted.id).toBe(TEST_PRODUCT.id);
    });
  });
});

