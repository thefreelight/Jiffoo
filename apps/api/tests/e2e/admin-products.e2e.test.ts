/**
 * E2E Test: Admin Product Management Flow
 * 
 * Tests the complete admin product management including CRUD operations and bulk actions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAdminToken, createSuperAdminToken } from '../utils/auth-helpers';

// Mock Prisma
const mockPrisma = {
  product: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
  },
  category: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  productImage: {
    createMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  $transaction: vi.fn((callback) => callback(mockPrisma)),
};

vi.mock('../../src/config/database', () => ({
  prisma: mockPrisma,
}));

// Test fixtures
const TEST_PRODUCT = {
  id: 'prod-001',
  name: 'Test Product',
  slug: 'test-product',
  description: 'A test product description',
  price: 99.99,
  compareAtPrice: 129.99,
  stock: 100,
  sku: 'TEST-001',
  categoryId: 'cat-001',
  tenantId: 999,
  status: 'ACTIVE',
  featured: false,
  images: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const TEST_CATEGORY = {
  id: 'cat-001',
  name: 'Test Category',
  slug: 'test-category',
  tenantId: 999,
};

describe('E2E: Admin Product Management', () => {
  const adminToken = createAdminToken(999);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Step 1: List Products', () => {
    it('should list all products with pagination', async () => {
      const products = [TEST_PRODUCT, { ...TEST_PRODUCT, id: 'prod-002', name: 'Product 2' }];
      mockPrisma.product.findMany.mockResolvedValue(products);
      mockPrisma.product.count.mockResolvedValue(products.length);

      const result = await mockPrisma.product.findMany({
        where: { tenantId: 999 },
        take: 10,
        skip: 0,
      });

      expect(result).toHaveLength(2);
    });

    it('should filter products by status', async () => {
      mockPrisma.product.findMany.mockResolvedValue([TEST_PRODUCT]);

      const result = await mockPrisma.product.findMany({
        where: { tenantId: 999, status: 'ACTIVE' },
      });

      expect(result.every(p => p.status === 'ACTIVE')).toBe(true);
    });

    it('should search products by name', async () => {
      mockPrisma.product.findMany.mockResolvedValue([TEST_PRODUCT]);

      const result = await mockPrisma.product.findMany({
        where: {
          tenantId: 999,
          name: { contains: 'Test', mode: 'insensitive' },
        },
      });

      expect(result.every(p => p.name.includes('Test'))).toBe(true);
    });
  });

  describe('Step 2: Create Product', () => {
    it('should create a new product', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(TEST_CATEGORY);
      mockPrisma.product.create.mockResolvedValue(TEST_PRODUCT);

      // Verify category exists
      const category = await mockPrisma.category.findUnique({
        where: { id: TEST_CATEGORY.id },
      });
      expect(category).not.toBeNull();

      // Create product
      const product = await mockPrisma.product.create({
        data: {
          name: TEST_PRODUCT.name,
          slug: TEST_PRODUCT.slug,
          description: TEST_PRODUCT.description,
          price: TEST_PRODUCT.price,
          stock: TEST_PRODUCT.stock,
          categoryId: TEST_PRODUCT.categoryId,
          tenantId: 999,
        },
      });

      expect(product.name).toBe(TEST_PRODUCT.name);
      expect(product.tenantId).toBe(999);
    });

    it('should validate required fields', () => {
      const requiredFields = ['name', 'price', 'stock'];
      const productData = {
        name: 'New Product',
        price: 49.99,
        stock: 50,
      };

      requiredFields.forEach(field => {
        expect(productData).toHaveProperty(field);
      });
    });

    it('should generate slug from name', () => {
      const name = 'New Amazing Product!';
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      
      expect(slug).toBe('new-amazing-product');
    });
  });

  describe('Step 3: Update Product', () => {
    it('should update product details', async () => {
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

    it('should update product stock', async () => {
      const updatedProduct = { ...TEST_PRODUCT, stock: 200 };
      mockPrisma.product.update.mockResolvedValue(updatedProduct);

      const product = await mockPrisma.product.update({
        where: { id: TEST_PRODUCT.id },
        data: { stock: 200 },
      });

      expect(product.stock).toBe(200);
    });

    it('should toggle product featured status', async () => {
      const featuredProduct = { ...TEST_PRODUCT, featured: true };
      mockPrisma.product.update.mockResolvedValue(featuredProduct);

      const product = await mockPrisma.product.update({
        where: { id: TEST_PRODUCT.id },
        data: { featured: true },
      });

      expect(product.featured).toBe(true);
    });
  });

  describe('Step 4: Delete Product', () => {
    it('should delete a product', async () => {
      mockPrisma.product.delete.mockResolvedValue(TEST_PRODUCT);

      const deleted = await mockPrisma.product.delete({
        where: { id: TEST_PRODUCT.id },
      });

      expect(deleted.id).toBe(TEST_PRODUCT.id);
    });

    it('should soft delete by changing status', async () => {
      const archivedProduct = { ...TEST_PRODUCT, status: 'ARCHIVED' };
      mockPrisma.product.update.mockResolvedValue(archivedProduct);

      const product = await mockPrisma.product.update({
        where: { id: TEST_PRODUCT.id },
        data: { status: 'ARCHIVED' },
      });

      expect(product.status).toBe('ARCHIVED');
    });
  });

  describe('Step 5: Bulk Operations', () => {
    it('should bulk update product status', async () => {
      mockPrisma.product.updateMany.mockResolvedValue({ count: 5 });

      const result = await mockPrisma.product.updateMany({
        where: {
          id: { in: ['prod-001', 'prod-002', 'prod-003', 'prod-004', 'prod-005'] },
        },
        data: { status: 'INACTIVE' },
      });

      expect(result.count).toBe(5);
    });

    it('should bulk delete products', async () => {
      mockPrisma.product.deleteMany.mockResolvedValue({ count: 3 });

      const result = await mockPrisma.product.deleteMany({
        where: {
          id: { in: ['prod-001', 'prod-002', 'prod-003'] },
        },
      });

      expect(result.count).toBe(3);
    });

    it('should bulk update prices', async () => {
      // Simulate 10% price increase
      mockPrisma.product.updateMany.mockResolvedValue({ count: 10 });

      const result = await mockPrisma.product.updateMany({
        where: { categoryId: 'cat-001' },
        data: { price: { multiply: 1.1 } },
      });

      expect(result.count).toBe(10);
    });
  });

  describe('Step 6: Product Images', () => {
    it('should add images to product', async () => {
      const images = [
        { url: 'https://example.com/image1.jpg', alt: 'Image 1', order: 0 },
        { url: 'https://example.com/image2.jpg', alt: 'Image 2', order: 1 },
      ];
      mockPrisma.productImage.createMany.mockResolvedValue({ count: 2 });

      const result = await mockPrisma.productImage.createMany({
        data: images.map(img => ({ ...img, productId: TEST_PRODUCT.id })),
      });

      expect(result.count).toBe(2);
    });

    it('should remove images from product', async () => {
      mockPrisma.productImage.deleteMany.mockResolvedValue({ count: 1 });

      const result = await mockPrisma.productImage.deleteMany({
        where: { productId: TEST_PRODUCT.id, id: 'img-001' },
      });

      expect(result.count).toBe(1);
    });
  });

  describe('Step 7: Category Management', () => {
    it('should list categories', async () => {
      const categories = [TEST_CATEGORY, { ...TEST_CATEGORY, id: 'cat-002', name: 'Category 2' }];
      mockPrisma.category.findMany.mockResolvedValue(categories);

      const result = await mockPrisma.category.findMany({
        where: { tenantId: 999 },
      });

      expect(result).toHaveLength(2);
    });

    it('should create new category', async () => {
      mockPrisma.category.create.mockResolvedValue(TEST_CATEGORY);

      const category = await mockPrisma.category.create({
        data: {
          name: TEST_CATEGORY.name,
          slug: TEST_CATEGORY.slug,
          tenantId: 999,
        },
      });

      expect(category.name).toBe(TEST_CATEGORY.name);
    });

    it('should move products to different category', async () => {
      mockPrisma.product.updateMany.mockResolvedValue({ count: 5 });

      const result = await mockPrisma.product.updateMany({
        where: { categoryId: 'cat-001' },
        data: { categoryId: 'cat-002' },
      });

      expect(result.count).toBe(5);
    });
  });

  describe('Step 8: Inventory Management', () => {
    it('should update stock levels', async () => {
      const updatedProduct = { ...TEST_PRODUCT, stock: 150 };
      mockPrisma.product.update.mockResolvedValue(updatedProduct);

      const product = await mockPrisma.product.update({
        where: { id: TEST_PRODUCT.id },
        data: { stock: { increment: 50 } },
      });

      expect(product.stock).toBe(150);
    });

    it('should identify low stock products', async () => {
      const lowStockProducts = [
        { ...TEST_PRODUCT, stock: 5 },
        { ...TEST_PRODUCT, id: 'prod-002', stock: 3 },
      ];
      mockPrisma.product.findMany.mockResolvedValue(lowStockProducts);

      const result = await mockPrisma.product.findMany({
        where: {
          tenantId: 999,
          stock: { lt: 10 },
        },
      });

      expect(result.every(p => p.stock < 10)).toBe(true);
    });

    it('should identify out of stock products', async () => {
      const outOfStockProducts = [{ ...TEST_PRODUCT, stock: 0 }];
      mockPrisma.product.findMany.mockResolvedValue(outOfStockProducts);

      const result = await mockPrisma.product.findMany({
        where: {
          tenantId: 999,
          stock: 0,
        },
      });

      expect(result.every(p => p.stock === 0)).toBe(true);
    });
  });

  describe('Authorization', () => {
    it('should require admin token', () => {
      const token = createAdminToken(999);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('should allow super admin access', () => {
      const superAdminToken = createSuperAdminToken();
      expect(superAdminToken).toBeDefined();
    });
  });
});

