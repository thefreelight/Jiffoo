/**
 * Admin Plugins Endpoints Tests
 * 
 * Coverage:
 * - GET /api/admin/plugins/marketplace
 * - GET /api/admin/plugins/marketplace/search
 * - GET /api/admin/plugins/marketplace/:slug
 * - GET /api/admin/plugins/categories
 * - GET /api/admin/plugins/installed
 * - GET /api/admin/plugins/
 * - POST /api/admin/plugins/:slug/install
 * - GET /api/admin/plugins/:slug
 * - POST /api/admin/plugins/:slug/enable
 * - POST /api/admin/plugins/:slug/disable
 * - PUT /api/admin/plugins/:slug/config
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import {
  createUserWithToken,
  createAdminWithToken,
  deleteAllTestUsers,
} from '../helpers/auth';

describe('Admin Plugins Endpoints', () => {
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

  describe('Authentication & Authorization', () => {
    const endpoints = [
      { method: 'GET', url: '/api/admin/plugins/marketplace' },
      { method: 'GET', url: '/api/admin/plugins/marketplace/search' },
      { method: 'GET', url: '/api/admin/plugins/categories' },
      { method: 'GET', url: '/api/admin/plugins/installed' },
      { method: 'GET', url: '/api/admin/plugins/' },
    ];

    it.each(endpoints)('$method $url should return 401 without token', async ({ method, url }) => {
      const response = await app.inject({ method: method as any, url });
      expect(response.statusCode).toBe(401);
    });

    it.each(endpoints)('$method $url should return 403 for regular user', async ({ method, url }) => {
      const response = await app.inject({
        method: method as any,
        url,
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(response.statusCode).toBe(403);
    });
  });

  describe('GET /api/admin/plugins/marketplace', () => {
    it('should return marketplace plugins for admin', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/plugins/marketplace',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      // Allow 501 not implemented if marketplace is disabled/unavailable
      expect([200, 501]).toContain(response.statusCode);
    });
  });

  describe('GET /api/admin/plugins/marketplace/search', () => {
    it('should search marketplace plugins for admin', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/plugins/marketplace/search?q=payment',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      // Allow 501 not implemented
      expect([200, 501]).toContain(response.statusCode);
    });
  });

  describe('GET /api/admin/plugins/marketplace/:slug', () => {
    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/plugins/marketplace/test-plugin',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/plugins/marketplace/test-plugin',
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return plugin details or 404 for admin', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/plugins/marketplace/test-plugin',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect([200, 404, 501]).toContain(response.statusCode);
    });
  });

  describe('GET /api/admin/plugins/categories', () => {
    it('should return plugin categories for admin', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/plugins/categories',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('GET /api/admin/plugins/installed', () => {
    it('should return installed plugins for admin', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/plugins/installed',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('GET /api/admin/plugins/', () => {
    it('should return plugins list for admin', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/plugins/',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('POST /api/admin/plugins/:slug/install', () => {
    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/plugins/test-plugin/install',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/plugins/test-plugin/install',
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should handle plugin installation for admin', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/plugins/test-plugin/install',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      // May succeed or fail depending on marketplace availability
      expect([200, 400, 404]).toContain(response.statusCode);
    });
  });

  describe('GET /api/admin/plugins/:slug', () => {
    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/plugins/test-plugin',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/plugins/test-plugin',
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return plugin state or 404 for admin', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/plugins/test-plugin',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect([200, 404]).toContain(response.statusCode);
    });
  });

  describe('POST /api/admin/plugins/:slug/enable', () => {
    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/plugins/test-plugin/enable',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/plugins/test-plugin/enable',
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should handle plugin enable for admin', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/plugins/test-plugin/enable',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect([200, 400, 404]).toContain(response.statusCode);
    });
  });

  describe('POST /api/admin/plugins/:slug/disable', () => {
    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/plugins/test-plugin/disable',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/plugins/test-plugin/disable',
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should handle plugin disable for admin', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/plugins/test-plugin/disable',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect([200, 400, 404]).toContain(response.statusCode);
    });
  });

  describe('PUT /api/admin/plugins/:slug/config', () => {
    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/admin/plugins/test-plugin/config',
        payload: { enabled: true },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/admin/plugins/test-plugin/config',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { enabled: true },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should update plugin config for admin', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/admin/plugins/test-plugin/config',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { apiKey: 'test-key' },
      });

      expect([200, 400, 404]).toContain(response.statusCode);
    });
  });
});
