/**
 * Extensions Installer Endpoints Tests
 * 
 * Coverage:
 * - POST /api/extensions/:kind/install - Admin only
 * - DELETE /api/extensions/:kind/:slug - Admin only
 * - GET /api/extensions/:kind/:slug - Admin only
 * - GET /api/extensions/:kind - Admin only
 * 
 * All extension installer endpoints require admin authentication.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import { createUserWithToken, createAdminWithToken, deleteAllTestUsers } from '../helpers/auth';

describe('Extensions Installer Endpoints', () => {
  let app: FastifyInstance;
  let userToken: string;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp({ disableFileSystem: true });
    const { token: uToken } = await createUserWithToken();
    const { token: aToken } = await createAdminWithToken();
    userToken = uToken;
    adminToken = aToken;
  });

  afterAll(async () => {
    await deleteAllTestUsers();
    await app.close();
  });

  describe('Security - 401 without token', () => {
    const endpoints = [
      { method: 'POST', url: '/api/extensions/plugin/install' },
      { method: 'DELETE', url: '/api/extensions/plugin/test-slug' },
      { method: 'GET', url: '/api/extensions/plugin/test-slug' },
      { method: 'GET', url: '/api/extensions/plugin' },
    ];

    it.each(endpoints)('$method $url should return 401 without token', async ({ method, url }) => {
      const response = await app.inject({ method: method as any, url });
      expect(response.statusCode).toBe(401);
    });
  });

  describe('Security - 403 for non-admin user', () => {
    const endpoints = [
      { method: 'POST', url: '/api/extensions/plugin/install' },
      { method: 'DELETE', url: '/api/extensions/plugin/test-slug' },
      { method: 'GET', url: '/api/extensions/plugin/test-slug' },
      { method: 'GET', url: '/api/extensions/plugin' },
    ];

    it.each(endpoints)('$method $url should return 403 for regular user', async ({ method, url }) => {
      const response = await app.inject({
        method: method as any,
        url,
        headers: { authorization: `Bearer ${userToken}` }
      });
      expect(response.statusCode).toBe(403);
    });
  });

  describe('POST /api/extensions/:kind/install', () => {
    const kinds = ['theme-shop', 'theme-admin', 'plugin'];

    it.each(kinds)('should require file upload for %s (400 without file)', async (kind) => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/extensions/${kind}/install`,
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': 'multipart/form-data; boundary=---boundary'
        },
        payload: '---boundary--'
      });

      // Multipart upload required, so expect 400 without file
      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for invalid kind', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/extensions/invalid-kind/install',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('DELETE /api/extensions/:kind/:slug', () => {
    it('should return error for non-existent extension', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/extensions/plugin/non-existent-plugin',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      // May return 404 or 500 depending on implementation
      expect([404, 500]).toContain(response.statusCode);
    });
  });

  describe('GET /api/extensions/:kind/:slug', () => {
    it('should return 404 for non-existent extension', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/extensions/plugin/test-plugin',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/extensions/:kind', () => {
    const kinds = ['theme-shop', 'theme-admin', 'plugin'];

    it.each(kinds)('should list %s extensions for admin', async (kind) => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/extensions/${kind}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('data');
      expect(Array.isArray(body.data)).toBe(true);
    });
  });
});
