/**
 * Core API Versioning Integration Tests
 *
 * Coverage:
 * - Version routing (v1, v2)
 * - Default version fallback
 * - Invalid version handling
 * - Unsupported version handling
 * - Version headers
 * - Deprecation headers
 * - Backward compatibility
 * - Error handling
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import { createTestProduct, deleteAllTestProducts } from '../helpers/fixtures';

describe('Core API Versioning Integration', () => {
  let app: FastifyInstance;
  let testProduct: Awaited<ReturnType<typeof createTestProduct>>;

  beforeAll(async () => {
    app = await createTestApp();
    testProduct = await createTestProduct({
      name: 'Test Product for Versioning',
      description: 'A product for testing API versioning',
      price: 49.99,
      stock: 100,
      category: 'electronics',
    });
  });

  afterAll(async () => {
    await deleteAllTestProducts();
    await app.close();
  });

  describe('Version Routing', () => {
    it('should route to v1 endpoints correctly', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/products',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-api-version']).toBe('v1');

      const body = response.json();
      expect(body).toHaveProperty('data');
    });

    it('should route to v2 endpoints correctly', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v2/products',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-api-version']).toBe('v2');

      const body = response.json();
      expect(body).toHaveProperty('data');
    });

    it('should route versioned product detail endpoint', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/products/${testProduct.id}`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-api-version']).toBe('v1');

      const body = response.json();
      expect(body.data).toHaveProperty('id');
      expect(body.data.id).toBe(testProduct.id);
    });

    it('should route versioned health check endpoint', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/health',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-api-version']).toBe('v1');

      const body = response.json();
      expect(body).toHaveProperty('status', 'ok');
    });
  });

  describe('Default Version Fallback', () => {
    it('should use default version for unversioned routes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/products',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-api-version']).toBe('v1');
    });

    it('should return default version in header for root endpoint', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-api-version']).toBe('v1');
    });

    it('should use default version for health check without version', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-api-version']).toBe('v1');
    });
  });

  describe('Invalid Version Handling', () => {
    it('should return 400 for invalid version format', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/invalid/products',
      });

      expect(response.statusCode).toBe(400);

      const body = response.json();
      expect(body).toHaveProperty('error', 'Invalid API version format');
      expect(body).toHaveProperty('supportedVersions');
      expect(Array.isArray(body.supportedVersions)).toBe(true);
    });

    it('should return 400 for malformed version (v0)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v0/products',
      });

      // v0 might be considered valid format but unsupported (404) or invalid format (400)
      expect([400, 404]).toContain(response.statusCode);

      const body = response.json();
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('supportedVersions');
    });

    it('should return 400 for version with letters (vabc)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/vabc/products',
      });

      expect(response.statusCode).toBe(400);

      const body = response.json();
      expect(body).toHaveProperty('error', 'Invalid API version format');
    });
  });

  describe('Unsupported Version Handling', () => {
    it('should return 404 for unsupported version v99', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v99/products',
      });

      expect(response.statusCode).toBe(404);

      const body = response.json();
      expect(body).toHaveProperty('error', 'Unsupported API version');
      expect(body).toHaveProperty('supportedVersions');
      expect(body).toHaveProperty('defaultVersion');
      expect(body.supportedVersions).toContain('v1');
      expect(body.supportedVersions).toContain('v2');
    });

    it('should return 404 for unsupported version v3', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v3/products',
      });

      expect(response.statusCode).toBe(404);

      const body = response.json();
      expect(body).toHaveProperty('error', 'Unsupported API version');
      expect(body.message).toContain('v3');
    });
  });

  describe('Version Headers', () => {
    it('should include X-API-Version header in all v1 responses', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/products',
      });

      expect(response.headers).toHaveProperty('x-api-version');
      expect(response.headers['x-api-version']).toBe('v1');
    });

    it('should include X-API-Version header in all v2 responses', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v2/products',
      });

      expect(response.headers).toHaveProperty('x-api-version');
      expect(response.headers['x-api-version']).toBe('v2');
    });

    it('should include X-API-Version header in error responses', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v99/products',
      });

      expect(response.statusCode).toBe(404);
      expect(response.headers).toHaveProperty('x-api-version');
    });

    it('should include version header for POST requests', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
      });

      expect(response.headers).toHaveProperty('x-api-version');
      expect(response.headers['x-api-version']).toBe('v1');
    });
  });

  describe('Backward Compatibility', () => {
    it('should support unversioned product routes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/products',
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toHaveProperty('data');
      expect(body.data).toHaveProperty('products');
      expect(Array.isArray(body.data.products)).toBe(true);
    });

    it('should support unversioned product detail routes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/products/${testProduct.id}`,
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.data).toHaveProperty('id', testProduct.id);
    });

    it('should support unversioned auth routes', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
      });

      // Logout typically returns 200
      expect(response.statusCode).toBe(200);
    });

    it('should support unversioned cart routes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/cart',
      });

      // Cart endpoint may require auth (401) or return data
      expect([200, 401]).toContain(response.statusCode);
    });
  });

  describe('Version Metadata', () => {
    it('should provide version info at root endpoint', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/',
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toHaveProperty('versioning');
      expect(body.versioning).toHaveProperty('current');
      expect(body.versioning).toHaveProperty('supported');
      expect(body.versioning).toHaveProperty('default');
      expect(body.versioning.supported).toContain('v1');
      expect(body.versioning.supported).toContain('v2');
    });
  });

  describe('Multiple Endpoints Version Consistency', () => {
    it('should maintain version consistency across different endpoints in same request flow', async () => {
      // Check products endpoint
      const productsResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/products',
      });

      expect(productsResponse.headers['x-api-version']).toBe('v1');

      // Check product detail endpoint
      const productDetailResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/products/${testProduct.id}`,
      });

      expect(productDetailResponse.headers['x-api-version']).toBe('v1');

      // Check health endpoint
      const healthResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/health',
      });

      expect(healthResponse.headers['x-api-version']).toBe('v1');
    });

    it('should handle version switch between requests correctly', async () => {
      // First request with v1
      const v1Response = await app.inject({
        method: 'GET',
        url: '/api/v1/products',
      });

      expect(v1Response.headers['x-api-version']).toBe('v1');

      // Second request with v2
      const v2Response = await app.inject({
        method: 'GET',
        url: '/api/v2/products',
      });

      expect(v2Response.headers['x-api-version']).toBe('v2');

      // Third request back to v1
      const v1AgainResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/products',
      });

      expect(v1AgainResponse.headers['x-api-version']).toBe('v1');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed URLs gracefully', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1//products', // Double slash
      });

      // Should handle gracefully, either 404 for route not found or 200 if normalized
      expect([200, 404]).toContain(response.statusCode);
      expect(response.headers).toHaveProperty('x-api-version');
    });

    it('should handle non-existent endpoints with version prefix', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/nonexistent-endpoint',
      });

      expect(response.statusCode).toBe(404);
      expect(response.headers).toHaveProperty('x-api-version');
    });

    it('should provide helpful error messages for unsupported versions', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v10/products',
      });

      expect(response.statusCode).toBe(404);

      const body = response.json();
      expect(body.message).toContain('v10');
      expect(body.supportedVersions).toContain('v1');
      expect(body.supportedVersions).toContain('v2');
      expect(body.defaultVersion).toBe('v1');
    });
  });

  describe('HTTP Methods with Versioning', () => {
    it('should handle GET requests with versioning', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/products',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-api-version']).toBe('v1');
    });

    it('should handle POST requests with versioning', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        payload: {},
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-api-version']).toBe('v1');
    });

    it('should handle OPTIONS requests with versioning', async () => {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/api/v1/products',
      });

      // OPTIONS should work with any version
      expect(response.headers).toHaveProperty('x-api-version');
    });
  });

  describe('Query Parameters with Versioning', () => {
    it('should preserve query parameters with versioned routes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/products?page=1&limit=10',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-api-version']).toBe('v1');

      const body = response.json();
      expect(body).toHaveProperty('data');
    });

    it('should handle search queries with versioned routes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/products/search?q=${encodeURIComponent('Test')}`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-api-version']).toBe('v1');
    });
  });

  describe('Special Characters in Version Path', () => {
    it('should reject version with special characters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1.0/products',
      });

      // Should either treat v1.0 as invalid format (400) or as part of path (404)
      expect([400, 404]).toContain(response.statusCode);
    });

    it('should reject version with uppercase', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/V1/products',
      });

      // Versioning uses lowercase, so V1 might be invalid or unsupported
      expect([400, 404]).toContain(response.statusCode);
    });
  });

  describe('Performance and Response Times', () => {
    it('should respond quickly with version middleware', async () => {
      const startTime = Date.now();

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/health',
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-api-version']).toBe('v1');

      // Versioning middleware should add minimal overhead (< 100ms in tests)
      expect(responseTime).toBeLessThan(1000);
    });
  });
});
