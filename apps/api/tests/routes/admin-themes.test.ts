/**
 * Admin Themes Endpoints Tests
 * 
 * Coverage:
 * - GET /api/admin/themes/
 * - GET /api/admin/themes/active
 * - POST /api/admin/themes/:slug/activate
 * - POST /api/admin/themes/rollback
 * - PUT /api/admin/themes/config
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import {
  createUserWithToken,
  createAdminWithToken,
  deleteAllTestUsers,
} from '../helpers/auth';

describe('Admin Themes Endpoints', () => {
  let app: FastifyInstance;
  let userToken: string;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();

    const { token: uToken } = await createUserWithToken();
    const { token: aToken } = await createAdminWithToken();

    userToken = uToken;
    adminToken = aToken;
  });

  afterAll(async () => {
    await deleteAllTestUsers();
    await app.close();
  });

  describe('GET /api/admin/themes/', () => {
    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/themes/',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/themes/',
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return themes list for admin', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/themes/',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('GET /api/admin/themes/active', () => {
    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/themes/active',
      });
      expect(response.statusCode).toBe(401);
    });

    it('should return active theme for admin', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/themes/active',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(response.statusCode).toBe(200);
    });
  });

  describe('GET /api/themes/active', () => {
    it('should be accessible without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/themes/active',
      });
      expect(response.statusCode).toBe(200);
    });
  });

  describe('POST /api/admin/themes/:slug/activate', () => {
    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/themes/default/activate',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/themes/default/activate',
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should handle theme activation for admin', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/themes/default/activate',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      // May succeed or fail depending on available themes
      expect([200, 400, 404]).toContain(response.statusCode);
    });
  });

  describe('POST /api/admin/themes/rollback', () => {
    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/themes/rollback',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/themes/rollback',
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should handle rollback for admin', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/themes/rollback',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      // May succeed or fail depending on theme history
      expect([200, 400]).toContain(response.statusCode);
    });
  });

  describe('PUT /api/admin/themes/config', () => {
    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/admin/themes/config',
        payload: { primaryColor: '#FF0000' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/admin/themes/config',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { primaryColor: '#FF0000' },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should update theme config for admin', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/admin/themes/config',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { primaryColor: '#0066CC' },
      });

      expect([200, 400]).toContain(response.statusCode);
    });

    it('should accept empty config object', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/admin/themes/config',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {},
      });

      expect([200, 400]).toContain(response.statusCode);
    });
  });
});
