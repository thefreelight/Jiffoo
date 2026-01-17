/**
 * Admin Products Endpoints Tests
 * 
 * Coverage:
 * - GET /api/admin/products/
 * - POST /api/admin/products/
 * - GET /api/admin/products/:id
 * - PUT /api/admin/products/:id
 * - DELETE /api/admin/products/:id
 * - GET /api/admin/products/categories
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
    it('GET /api/admin/products/ should return 401 without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/products/',
      });

      expect(response.statusCode).toBe(401);
    });

    it('GET /api/admin/products/ should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/products/',
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('GET /api/admin/products/ should return 200 for admin', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/products/',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('GET /api/admin/products/', () => {
    it('should return products list', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/products/',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toHaveProperty('data');
      expect(Array.isArray(body.data.products)).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/products/?page=1&limit=5',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should support search', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/products/?search=Admin',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should support category filter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/products/?category=electronics',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should support price filters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/products/?minPrice=50&maxPrice=200',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should support stock filter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/products/?inStock=true',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should support sorting', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/products/?sortBy=price&sortOrder=desc',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('POST /api/admin/products/', () => {
    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/products/',
        payload: {
          name: 'New Product',
          price: 99.99,
          stock: 100,
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/products/',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          name: 'New Product',
          price: 99.99,
          stock: 100,
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 400 for missing name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/products/',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          price: 99.99,
          stock: 100,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for missing price', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/products/',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'New Product',
          stock: 100,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for missing stock', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/products/',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'New Product',
          price: 99.99,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should create product with valid data', async () => {
      const uniqueId = uuidv4().substring(0, 8);

      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/products/',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: `Admin Created Product ${uniqueId}`,
          description: 'A product created by admin',
          price: 149.99,
          stock: 75,
          category: 'test-category',
          images: ['https://example.com/image.jpg'],
        },
      });

      expect([200, 201]).toContain(response.statusCode);

      if (response.statusCode === 200 || response.statusCode === 201) {
        const body = response.json();
        expect(body.data).toHaveProperty('id');
      }
    });
  });

  describe('GET /api/admin/products/:id', () => {
    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/admin/products/${testProduct.id}`,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/admin/products/${testProduct.id}`,
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return product details for admin', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/admin/products/${testProduct.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.data).toHaveProperty('id');
      expect(body.data.id).toBe(testProduct.id);
    });

    it('should return 404 for non-existent product', async () => {
      const fakeProductId = uuidv4();

      const response = await app.inject({
        method: 'GET',
        url: `/api/admin/products/${fakeProductId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PUT /api/admin/products/:id', () => {
    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/admin/products/${testProduct.id}`,
        payload: { name: 'Updated Product Name' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/admin/products/${testProduct.id}`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'Updated Product Name' },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should update product for admin', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/admin/products/${testProduct.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: `Updated Admin Product ${uuidv4().substring(0, 8)}`,
          price: 159.99,
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 404 for non-existent product', async () => {
      const fakeProductId = uuidv4();

      const response = await app.inject({
        method: 'PUT',
        url: `/api/admin/products/${fakeProductId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Updated Name' },
      });

      expect([404, 400]).toContain(response.statusCode);
    });
  });

  describe('DELETE /api/admin/products/:id', () => {
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
        url: `/api/admin/products/${productToDelete.id}`,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/admin/products/${productToDelete.id}`,
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should delete product for admin', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/admin/products/${productToDelete.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 404 for non-existent product', async () => {
      const fakeProductId = uuidv4();

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/admin/products/${fakeProductId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect([404, 400]).toContain(response.statusCode);
    });
  });

  describe('GET /api/admin/products/categories', () => {
    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/products/categories',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/products/categories',
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return categories for admin', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/products/categories',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
    });
  });
});
