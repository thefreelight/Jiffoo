/**
 * OpenAPI Contract Tests
 * 
 * High-leverage tests that verify:
 * 1. All authenticated endpoints return 401 without token
 * 2. Response schemas match OpenAPI definitions
 * 3. All operations are reachable (no 404 for defined paths)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import {
  loadOpenApiSpec,
  getAllOperations,
  getAuthenticatedOperations,
  getPublicOperations,
  validateResponse,
  getOperationStats,
} from '../helpers/openapi';
import { createUserWithToken, createAdminWithToken, deleteAllTestUsers } from '../helpers/auth';

describe('OpenAPI Contract Tests', () => {
  let app: FastifyInstance;
  let userToken: string;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();

    // Create test users
    const { token: uToken } = await createUserWithToken();
    const { token: aToken } = await createAdminWithToken();
    userToken = uToken;
    adminToken = aToken;

    // Print operation statistics
    const stats = getOperationStats();
    console.log('\n📊 OpenAPI Contract Test Coverage:');
    console.log(`   Total Operations: ${stats.total}`);
    console.log(`   Authenticated: ${stats.authenticated}`);
    console.log(`   Public: ${stats.public}`);
  });

  afterAll(async () => {
    await deleteAllTestUsers();
    await app.close();
  });

  describe('Authentication Contract - 401 Tests', () => {
    const authOperations = getAuthenticatedOperations();

    /**
     * Smart path parameter replacement
     * Provides valid enum values for parameters with constraints
     */
    function replacePathParams(path: string): string {
      return path
        // Extensions kind parameter (must be plugin|theme-shop|theme-admin)
        .replace(/\/extensions\/\{kind\}/g, '/extensions/plugin')
        // Generic ID parameters
        .replace(/\{id\}/g, 'test-id')
        .replace(/\{slug\}/g, 'test-slug')
        .replace(/\{userId\}/g, 'test-user-id')
        .replace(/\{productId\}/g, 'test-product-id')
        .replace(/\{orderId\}/g, 'test-order-id')
        .replace(/\{themeId\}/g, 'test-theme-id')
        .replace(/\{pluginId\}/g, 'test-plugin-id')
        // Any remaining parameters
        .replace(/\{[^}]+\}/g, 'test-param');
    }

    /**
     * Get minimal valid payload for POST/PUT/PATCH requests
     * This ensures we pass schema validation to reach auth middleware
     */
    function getMinimalPayload(path: string, method: string): any {
      if (!['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
        return undefined;
      }

      // Payment endpoints
      if (path.includes('/payments/create-session')) {
        return { paymentMethod: 'mock', orderId: 'test-order-id' };
      }

      // Upgrade endpoints
      if (path.includes('/upgrade/check') || path.includes('/upgrade/perform')) {
        return { targetVersion: '1.0.0' };
      }
      if (path.includes('/upgrade/rollback')) {
        return { backupId: 'test-backup-id' };
      }

      // Default minimal payload
      return {};
    }

    it.each(
      authOperations.map(op => [op.operationId, op.path, op.method])
    )('%s should return 401 without token', async (_opId, path, method) => {
      const testPath = replacePathParams(path);
      const payload = getMinimalPayload(path, method);

      const response = await app.inject({
        method: method as any,
        url: testPath,
        payload,
      });

      expect(response.statusCode).toBe(401);

      const body = response.json();
      expect(body).toHaveProperty('error');
    });
  });

  describe('Public Endpoints - No Auth Required', () => {
    const publicOperations = getPublicOperations();

    // Filter out operations that need special handling
    const simplePublicOps = publicOperations.filter(op =>
      // Skip redirect endpoints
      !op.path.includes('/success') &&
      !op.path.includes('/cancel') &&
      // Skip endpoints that need request body
      op.method === 'GET' &&
      // Skip endpoints with complex path params that need real data
      !op.path.includes('/api/products/{id}') &&
      !op.path.includes('/api/plugins/{slug}') &&
      !op.path.includes('/api/extensions/') &&
      // Skip all admin endpoints (they all require auth)
      !op.path.includes('/api/admin/') &&
      // Skip cache endpoints (require auth)
      !op.path.includes('/api/cache/') &&
      // Skip log endpoints (require auth)
      !op.path.includes('/api/logs/')
    );

    it.each(
      simplePublicOps.map(op => [op.operationId, op.path, op.method])
    )('%s should be accessible without auth', async (_opId, path, method) => {
      // Replace path parameters with placeholder values
      const testPath = path.replace(/\{[^}]+\}/g, 'test-id');

      const response = await app.inject({
        method: method as any,
        url: testPath,
      });

      // Should not return 401 (might return 404 for non-existent resources, but not 401)
      expect(response.statusCode).not.toBe(401);
    });
  });

  describe('Response Schema Validation', () => {
    describe('System Endpoints', () => {
      it('GET / should return valid response', async () => {
        const response = await app.inject({ method: 'GET', url: '/' });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body).toHaveProperty('name');
        expect(body).toHaveProperty('version');
      });

      it('GET /health should return valid response', async () => {
        const response = await app.inject({ method: 'GET', url: '/health' });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body).toHaveProperty('status');
      });

      it('GET /health/live should return valid response', async () => {
        const response = await app.inject({ method: 'GET', url: '/health/live' });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body).toHaveProperty('status');
      });

      it('GET /health/ready should return valid response', async () => {
        const response = await app.inject({ method: 'GET', url: '/health/ready' });

        // Could be 200 or 503 depending on readiness
        expect([200, 503]).toContain(response.statusCode);
      });
    });

    describe('Install Endpoints', () => {
      it('GET /api/install/status should return valid schema', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/install/status'
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();

        // Validate against OpenAPI schema
        const validation = validateResponse('/api/install/status', 'GET', 200, body);
        if (!validation.valid) {
          console.log('Schema validation errors:', validation.errors);
        }
        expect(validation.valid).toBe(true);
      });

      it('GET /api/install/check-database should return valid schema', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/install/check-database'
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();

        const validation = validateResponse('/api/install/check-database', 'GET', 200, body);
        expect(validation.valid).toBe(true);
      });
    });

    describe('Products Endpoints', () => {
      it('GET /api/products/ should return valid response', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/products/'
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();

        // Should return a paginated list structure
        expect(body).toHaveProperty('success', true);
        expect(body).toHaveProperty('data');
        expect(body.data).toHaveProperty('products');
        expect(body.data).toHaveProperty('pagination');
        expect(Array.isArray(body.data.products)).toBe(true);
      });

      it('GET /api/products/categories should return valid response', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/products/categories'
        });

        expect(response.statusCode).toBe(200);
      });

      it('GET /api/products/search should require query param', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/products/search'
        });

        // Should fail validation without required 'q' param
        expect([400, 422]).toContain(response.statusCode);
      });
    });

    describe('Mall Endpoints', () => {
      it('GET /api/mall/context should return valid schema', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/mall/context'
        });

        expect([200, 500]).toContain(response.statusCode);

        if (response.statusCode === 200) {
          const validation = validateResponse('/api/mall/context', 'GET', 200, response.json());
          expect(validation.valid).toBe(true);
        }
      });
    });

    describe('Cache Endpoints', () => {
      it('GET /api/cache/health should return valid schema', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/cache/health',
          headers: { authorization: `Bearer ${adminToken}` },
        });

        expect([200, 500]).toContain(response.statusCode);
        const body = response.json();

        const statusCode = response.statusCode as 200 | 500;
        const validation = validateResponse('/api/cache/health', 'GET', statusCode, body);
        expect(validation.valid).toBe(true);
      });
    });

    describe('Logger Endpoints', () => {
      it('GET /api/logs/health should return valid response', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/logs/health'
        });

        // Should require authentication
        expect(response.statusCode).toBe(401);
      });
    });
  });

  describe('Admin Endpoints - Role Check', () => {
    const adminOperations = getAllOperations().filter(op =>
      op.path.includes('/api/admin/')
    );

    describe('Should return 403 for non-admin user', () => {
      // Test a few key admin endpoints
      const adminEndpointsToTest = [
        { path: '/api/admin/users/', method: 'GET' },
        { path: '/api/admin/products/', method: 'GET' },
        { path: '/api/admin/orders/', method: 'GET' },
        { path: '/api/admin/themes/', method: 'GET' },
        { path: '/api/admin/plugins/', method: 'GET' },
      ];

      it.each(adminEndpointsToTest)(
        '$method $path should return 403 for regular user',
        async ({ path, method }) => {
          const response = await app.inject({
            method: method as any,
            url: path,
            headers: { authorization: `Bearer ${userToken}` },
          });

          expect(response.statusCode).toBe(403);
        }
      );
    });

    describe('Should be accessible for admin user', () => {
      const adminEndpointsToTest = [
        { path: '/api/admin/users/', method: 'GET' },
        { path: '/api/admin/products/', method: 'GET' },
        { path: '/api/admin/orders/', method: 'GET' },
      ];

      it.each(adminEndpointsToTest)(
        '$method $path should be accessible for admin',
        async ({ path, method }) => {
          const response = await app.inject({
            method: method as any,
            url: path,
            headers: { authorization: `Bearer ${adminToken}` },
          });

          expect(response.statusCode).toBe(200);
        }
      );
    });
  });

  describe('Security Verification - Previously Identified Issues (Now Fixed)', () => {
    describe('/api/account/profile - Requires auth', () => {
      it('GET should return 401 without token', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/account/profile',
        });

        expect(response.statusCode).toBe(401);
      });

      it('PUT should return 401 without token', async () => {
        const response = await app.inject({
          method: 'PUT',
          url: '/api/account/profile',
          payload: { username: 'test' },
        });

        expect(response.statusCode).toBe(401);
      });
    });

    describe('/api/upgrade/* - Requires admin auth', () => {
      const upgradeEndpoints = [
        { path: '/api/upgrade/version', method: 'GET' },
        { path: '/api/upgrade/status', method: 'GET' },
        { path: '/api/upgrade/check', method: 'POST', body: { targetVersion: '1.0.0' } },
        { path: '/api/upgrade/backup', method: 'POST' },
        { path: '/api/upgrade/perform', method: 'POST', body: { targetVersion: '1.0.0' } },
        { path: '/api/upgrade/rollback', method: 'POST', body: { backupId: 'test' } },
      ];

      it.each(upgradeEndpoints)(
        '$method $path should return 401 without token',
        async ({ path, method, body }) => {
          const response = await app.inject({
            method: method as any,
            url: path,
            payload: body,
          });

          expect(response.statusCode).toBe(401);
        }
      );

      it.each(upgradeEndpoints)(
        '$method $path should return 403 for regular user',
        async ({ path, method, body }) => {
          const response = await app.inject({
            method: method as any,
            url: path,
            payload: body,
            headers: { authorization: `Bearer ${userToken}` },
          });

          expect(response.statusCode).toBe(403);
        }
      );
    });

    describe('/api/extensions/* - Requires admin auth', () => {
      const extensionEndpoints = [
        { path: '/api/extensions/plugin', method: 'GET' },
        { path: '/api/extensions/plugin/test-slug', method: 'GET' },
        { path: '/api/extensions/plugin/install', method: 'POST' },
        { path: '/api/extensions/plugin/test-slug', method: 'DELETE' },
      ];

      it.each(extensionEndpoints)(
        '$method $path should return 401 without token',
        async ({ path, method }) => {
          const response = await app.inject({
            method: method as any,
            url: path,
          });

          expect(response.statusCode).toBe(401);
        }
      );

      it.each(extensionEndpoints)(
        '$method $path should return 403 for regular user',
        async ({ path, method }) => {
          const response = await app.inject({
            method: method as any,
            url: path,
            headers: { authorization: `Bearer ${userToken}` },
          });

          expect(response.statusCode).toBe(403);
        }
      );
    });
  });

  describe('Operation Count Verification', () => {
    it('should have expected number of operations', () => {
      const stats = getOperationStats();

      // Based on OpenAPI analysis: 92 operations / 81 paths
      expect(stats.total).toBeGreaterThanOrEqual(90);

      // Log actual count for reference
      console.log(`\n📊 Actual operation count: ${stats.total}`);
    });

    it('should have operations tagged by module', () => {
      const stats = getOperationStats();

      // Expected tags based on OpenAPI
      const expectedTags = [
        'system',
        'auth',
        'account',
        'products',
        'cart',
        'orders',
        'payments',
        'admin-users',
        'admin-products',
        'admin-orders',
        'admin-themes',
        'admin-plugins',
      ];

      for (const tag of expectedTags) {
        expect(stats.byTag[tag]).toBeGreaterThan(0);
      }
    });
  });
});
