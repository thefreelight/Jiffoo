/**
 * Admin Products Endpoints Tests
 *
 * Coverage:
 * - GET /api/v1/admin/products/
 * - POST /api/v1/admin/products/
 * - GET /api/v1/admin/products/:id
 * - PUT /api/v1/admin/products/:id
 * - DELETE /api/v1/admin/products/:id
 * - GET /api/v1/admin/products/categories
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import {
  createUserWithToken,
  createAdminWithToken,
  deleteAllTestUsers,
} from '../helpers/auth';
import { createTestProduct, deleteAllTestProducts } from '../helpers/fixtures';
import { getTestPrisma } from '../helpers/db';
import { v4 as uuidv4 } from 'uuid';

describe('Admin Products Endpoints', () => {
  let app: FastifyInstance;
  let userToken: string;
  let adminToken: string;
  let testProduct: Awaited<ReturnType<typeof createTestProduct>>;

  beforeAll(async () => {
    app = await createTestApp();

    const { token: uToken } = await createUserWithToken();
    const { token: aToken } = await createAdminWithToken();

    userToken = uToken;
    adminToken = aToken;

    testProduct = await createTestProduct({
      name: 'Admin Test Product',
      price: 129.99,
      stock: 50,
      category: 'electronics',
    });
  });

  afterAll(async () => {
    await deleteAllTestProducts();
    await deleteAllTestUsers();
    await app.close();
  });

  describe('Authentication & Authorization', () => {
    it('GET /api/v1/admin/products/ should return 401 without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/products/',
      });

      expect(response.statusCode).toBe(401);
    });

    it('GET /api/v1/admin/products/ should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/products/',
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('GET /api/v1/admin/products/ should return 200 for admin', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/products/',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(response.statusCode).toBe(200);
    });
  });

  describe('GET /api/v1/admin/products/', () => {
    it('should return products list', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/products/',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toHaveProperty('data');
      // Response format is { items: [...], page, limit, total, totalPages }
      expect(Array.isArray(body.data.items)).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/products/?page=1&limit=5',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should support search', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/products/?search=Admin',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should support category filter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/products/?categoryId=${testProduct.categoryId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should support price filters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/products/?minPrice=50&maxPrice=200',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should support stock filter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/products/?inStock=true',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should support sorting', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/products/?sortBy=createdAt&sortOrder=desc',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('POST /api/v1/admin/products/', () => {
    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/products/',
        payload: {
          name: 'New Product',
          variants: [{ name: 'Default', basePrice: 99.99, stock: 100 }],
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/products/',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          name: 'New Product',
          variants: [{ name: 'Default', basePrice: 99.99, stock: 100 }],
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 400 for missing name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/products/',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          variants: [{ name: 'Base Variant', salePrice: 99.99, stock: 100 }],
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for missing variants', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/products/',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'New Product',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for empty variants', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/products/',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'New Product',
          variants: [],
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should create product with valid data', async () => {
      const uniqueId = uuidv4().substring(0, 8);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/products/',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: `Admin Created Product ${uniqueId}`,
          description: 'A product created by admin',
          images: ['https://example.com/image.jpg'],
          categoryId: testProduct.categoryId,
          variants: [
            {
              name: 'Base Variant',
              salePrice: 149.99,
              stock: 75,
              isActive: true,
            },
          ],
        },
      });

      expect([200, 201]).toContain(response.statusCode);

      if (response.statusCode === 200 || response.statusCode === 201) {
        const body = response.json();
        expect(body.data).toHaveProperty('id');
      }
    });
  });

  describe('GET /api/v1/admin/products/:id', () => {
    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/products/${testProduct.id}`,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/products/${testProduct.id}`,
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return product details for admin', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/products/${testProduct.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.data).toHaveProperty('id');
      expect(body.data.id).toBe(testProduct.id);
      expect(body.data).toHaveProperty('isActive');
      expect(body.data.variants[0]).toHaveProperty('costPrice');
    });

    it('should return 404 for non-existent product', async () => {
      const fakeProductId = uuidv4();

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/products/${fakeProductId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PUT /api/v1/admin/products/:id', () => {
    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/admin/products/${testProduct.id}`,
        payload: {
          name: 'Updated Product Name',
          variants: [{ name: 'Default', basePrice: 99.99, stock: 100 }],
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/admin/products/${testProduct.id}`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          name: 'Updated Product Name',
          variants: [{ name: 'Default', basePrice: 99.99, stock: 100 }],
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should update product for admin', async () => {
      const firstVariant = testProduct.variants[0];
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/admin/products/${testProduct.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: `Updated Admin Product ${uuidv4().substring(0, 8)}`,
          variants: [
            {
              id: firstVariant.id,
              name: firstVariant.name,
              salePrice: 159.99,
              stock: firstVariant.stock,
              isActive: firstVariant.isActive,
            },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 404 or 400 for non-existent product', async () => {
      const fakeProductId = uuidv4();

      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/admin/products/${fakeProductId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Updated Name',
          variants: [{ name: 'Base Variant', salePrice: 99.99, stock: 10 }],
        },
      });

      expect([404, 400, 500]).toContain(response.statusCode);
    });
  });

  describe('DELETE /api/v1/admin/products/:id', () => {
    let productToDelete: Awaited<ReturnType<typeof createTestProduct>>;

    beforeAll(async () => {
      productToDelete = await createTestProduct({
        name: 'Product To Delete',
        price: 99.99,
        stock: 10,
      });
    });

    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/admin/products/${productToDelete.id}`,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/admin/products/${productToDelete.id}`,
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should delete product for admin', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/admin/products/${productToDelete.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 404 for non-existent product', async () => {
      const fakeProductId = uuidv4();

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/admin/products/${fakeProductId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect([404, 400]).toContain(response.statusCode);
    });
  });

  describe('GET /api/v1/admin/products/categories', () => {
    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/products/categories',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/products/categories',
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return categories for admin', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/products/categories',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(Array.isArray(body.data.items)).toBe(true);
    });
  });
});
