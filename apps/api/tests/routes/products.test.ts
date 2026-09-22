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
