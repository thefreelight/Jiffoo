/**
 * Admin Health Monitoring Routes Tests
 *
 * Coverage:
 * - GET /api/admin/health/metrics
 * - GET /api/admin/health/summary
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import { createTestUser, signJwt, deleteAllTestUsers } from '../helpers/auth';

describe('Admin Health Monitoring Routes', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let adminUserId: string;

  beforeAll(async () => {
    app = await createTestApp();

    // Create admin user
    const adminUser = await createTestUser({
      email: 'admin@test.com',
      username: 'admin',
      role: 'ADMIN',
    });
    adminUserId = adminUser.id;
    adminToken = signJwt(adminUserId, adminUser.email);
  });

  afterAll(async () => {
    await deleteAllTestUsers();
    await app.close();
  });

  describe('GET /api/admin/health/metrics', () => {
    it('should return health metrics for admin', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/health/metrics',
        headers: {
          authorization: `Bearer ${adminToken}`
        }
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data.system).toBeDefined();
      expect(body.data.system.cpu).toBeDefined();
      expect(body.data.system.cpu.usage).toBeGreaterThanOrEqual(0);
      expect(body.data.system.memory).toBeDefined();
      expect(body.data.system.memory.usage).toBeGreaterThanOrEqual(0);
      expect(body.data.cache).toBeDefined();
      expect(body.data.database).toBeDefined();
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/health/metrics'
      });

      expect(response.statusCode).toBe(401);
    });

    it('should require admin role', async () => {
      // Create regular user
      const regularUser = await createTestUser({
        email: 'user@test.com',
        username: 'user',
        role: 'USER',
      });
      const userToken = signJwt(regularUser.id, regularUser.email);

      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/health/metrics',
        headers: {
          authorization: `Bearer ${userToken}`
        }
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('GET /api/admin/health/summary', () => {
    it('should return health summary', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/health/summary',
        headers: {
          authorization: `Bearer ${adminToken}`
        }
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data.status).toMatch(/healthy|degraded|unhealthy/);
      expect(body.data.alerts).toBeInstanceOf(Array);
      expect(body.data.stats).toBeDefined();
      expect(body.data.stats.cpuUsage).toBeGreaterThanOrEqual(0);
      expect(body.data.stats.memoryUsage).toBeGreaterThanOrEqual(0);
    });

    it('should accept custom alert thresholds', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/health/summary',
        headers: {
          authorization: `Bearer ${adminToken}`
        },
        query: {
          cpuThreshold: '90',
          memoryThreshold: '90',
          diskThreshold: '95'
        }
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/health/summary'
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
