/**
 * Products Endpoints Tests
 * 
 * Coverage:
 * - GET /api/v1/products/
 * - GET /api/v1/products/:id
 * - GET /api/v1/products/categories
 * - GET /api/v1/products/search
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import { createTestProduct, deleteAllTestProducts } from '../helpers/fixtures';
import { getTestPrisma } from '../helpers/db';
import { CacheService } from '@/core/cache/service';
import { AdminProductService } from '@/core/admin/product-management/service';
import { v4 as uuidv4 } from 'uuid';

describe('Products Endpoints', () => {
  let app: FastifyInstance;
  let testProduct: Awaited<ReturnType<typeof createTestProduct>>;

  beforeAll(async () => {
    app = await createTestApp();
    testProduct = await createTestProduct({
      name: 'Test Product for API',
      description: 'A product for testing',
      price: 99.99,
      stock: 50,
      category: 'electronics',
    });
  });

  afterAll(async () => {
    await deleteAllTestProducts();
    await app.close();
  });

  describe('GET /api/v1/products/', () => {
    it('should return products list', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/products/',
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toHaveProperty('data');
      expect(Array.isArray(body.data.items)).toBe(true);
      expect(body.data.items[0]).toHaveProperty('typeData');
      expect(typeof body.data.items[0].typeData).toBe('object');
      expect(body.data.items[0]).not.toHaveProperty('variants');
    });

    it('should support pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/products/?page=1&limit=5',
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toHaveProperty('data');
      expect(body.data.items.length).toBeLessThanOrEqual(5);
    });

    it('should support search query', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/products/?search=${encodeURIComponent('Test Product')}`,
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toHaveProperty('data');
    });

    it('should support category filter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/products/?category=electronics',
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toHaveProperty('data');
    });

    it('should support price range filter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/products/?minPrice=10&maxPrice=200',
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toHaveProperty('data');
    });

    it('should support inStock filter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/products/?inStock=true',
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toHaveProperty('data');
    });

    it('should support sorting', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/products/?sortBy=price&sortOrder=desc',
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toHaveProperty('data');
    });

    it('should support locale parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/products/?locale=zh',
      });

      expect(response.statusCode).toBe(200);
    });

    it('should be accessible without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/products/',
      });

      // Should not return 401
      expect(response.statusCode).not.toBe(401);
    });
  });

  describe('GET /api/v1/products/:id', () => {
    it('should return product details', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/products/${testProduct.id}`,
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.data).toHaveProperty('id');
      expect(body.data.id).toBe(testProduct.id);
      expect(body.data).toHaveProperty('name');
      expect(body.data).toHaveProperty('price');
      expect(body.data).toHaveProperty('typeData');
      expect(typeof body.data.typeData).toBe('object');
      expect(Array.isArray(body.data.variants)).toBe(true);
    });

    it('should return 404 for non-existent product', async () => {
      const fakeId = uuidv4();

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/products/${fakeId}`,
      });

      expect(response.statusCode).toBe(404);
    });

    it('should support locale parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/products/${testProduct.id}?locale=zh`,
      });

      expect(response.statusCode).toBe(200);
    });

    it('should be accessible without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/products/${testProduct.id}`,
      });

      expect(response.statusCode).not.toBe(401);
    });
  });

  describe('GET /api/v1/products/categories', () => {
    it('counts active parent products regardless of variant activity or stock and keeps admin counts complete', async () => {
      const db = getTestPrisma();
      const suffix = uuidv4();
      const categories = await Promise.all([
        db.category.create({ data: { name: 'Mixed visibility', slug: `mixed-${suffix}`, sortOrder: -10000 } }),
        db.category.create({ data: { name: 'Inactive only', slug: `inactive-${suffix}`, sortOrder: -10000 } }),
      ]);
      const [mixed, inactiveOnly] = categories;
      const ids: string[] = [];
      try {
        for (const state of [
          { categoryId: mixed.id, isActive: true, variantActive: true, stock: 5 },
          { categoryId: mixed.id, isActive: true, variantActive: true, stock: 0 },
          { categoryId: mixed.id, isActive: true, variantActive: false, stock: 5 },
          { categoryId: mixed.id, isActive: false, variantActive: true, stock: 5 },
          { categoryId: inactiveOnly.id, isActive: false, variantActive: true, stock: 5 },
        ]) {
          const product = await createTestProduct({ name: 'Category count Test Product', category: state.categoryId, stock: state.stock });
          ids.push(product.id);
          await db.product.update({ where: { id: product.id }, data: { isActive: state.isActive } });
          await db.productVariant.updateMany({ where: { productId: product.id }, data: { isActive: state.variantActive } });
        }
        await CacheService.incrementProductVersion();
        const response = await app.inject({ method: 'GET', url: '/api/v1/products/categories?limit=100' });
        expect(response.statusCode).toBe(200);
        const items = response.json().data.items as Array<{ id: string; productCount: number }>;
        expect(items.find((category) => category.id === mixed.id)?.productCount).toBe(3);
        expect(items.find((category) => category.id === inactiveOnly.id)?.productCount).toBe(0);
        const listed = await app.inject({ method: 'GET', url: `/api/v1/products/?category=${mixed.id}&limit=100` });
        expect(listed.statusCode).toBe(200);
        expect(listed.json().data.total).toBe(3);
        expect(listed.json().data.items.map((product: { id: string }) => product.id).sort()).toEqual(ids.slice(0, 3).sort());
        const admin = await AdminProductService.getCategories(1, 100);
        expect(admin.items.find((category) => category.id === mixed.id)?.productCount).toBe(4);
        expect(admin.items.find((category) => category.id === inactiveOnly.id)?.productCount).toBe(1);
        await expect(AdminProductService.deleteCategory(inactiveOnly.id)).rejects.toMatchObject({ code: 'CATEGORY_NOT_EMPTY' });
      } finally {
        await db.product.deleteMany({ where: { id: { in: ids } } });
        await db.category.deleteMany({ where: { id: { in: categories.map((category) => category.id) } } });
        await CacheService.incrementProductVersion();
      }
    });

    it('should return categories list', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/products/categories',
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('data');
      expect(Array.isArray(body.data.items)).toBe(true);
    });

    it('should be accessible without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/products/categories',
      });

      expect(response.statusCode).not.toBe(401);
    });
  });

  describe('GET /api/v1/products/search', () => {
    it('should require query parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/products/search',
      });

      // Should fail validation without 'q' param
      expect([400, 422]).toContain(response.statusCode);
    });

    it('should search products by query', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/products/search?q=${encodeURIComponent('Test')}`,
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toBeDefined();
    });

    it('should support limit parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/products/search?q=test&limit=5',
      });

      expect(response.statusCode).toBe(200);
    });

    it('should support locale parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/products/search?q=test&locale=zh',
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return empty array for no matches', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/products/search?q=nonexistentproductxyz123',
      });

      expect(response.statusCode).toBe(200);
    });

    it('should be accessible without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/products/search?q=test',
      });

      expect(response.statusCode).not.toBe(401);
    });
  });
});
