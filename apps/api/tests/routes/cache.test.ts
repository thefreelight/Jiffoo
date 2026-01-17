/**
 * Cache Endpoints Tests
 * 
 * Coverage:
 * - GET /api/cache/health
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import { validateResponse } from '../helpers/openapi';
import { createAdminWithToken, createUserWithToken, deleteAllTestUsers } from '../helpers/auth';

describe('Cache Endpoints', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    const { token: aToken } = await createAdminWithToken();
    const { token: uToken } = await createUserWithToken();
    adminToken = aToken;
    userToken = uToken;
  });

  afterAll(async () => {
    await deleteAllTestUsers();
    await app.close();
  });

  describe('GET /api/cache/health', () => {
    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/cache/health',
      });
      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/cache/health',
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(response.statusCode).toBe(403);
    });

    it('should return cache health status for admin', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/cache/health',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect([200, 500]).toContain(response.statusCode);

      const body = response.json();
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('connected');
    });

    it('should match OpenAPI schema on success', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/cache/health',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      const statusCode = response.statusCode as 200 | 500;
      const validation = validateResponse('/api/cache/health', 'GET', statusCode, response.json());
      expect(validation.valid).toBe(true);
    });

    it('should include ping status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/cache/health',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      const body = response.json();
      expect(body).toHaveProperty('ping');
    });

    it('should include error message on failure', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/cache/health',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      if (response.statusCode === 500) {
        const body = response.json();
        expect(body).toHaveProperty('error');
      }
    });
  });
});
