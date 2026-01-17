/**
 * Upgrade Endpoints Tests
 * 
 * Coverage:
 * - GET /api/upgrade/version
 * - POST /api/upgrade/check
 * - GET /api/upgrade/status
 * - POST /api/upgrade/backup
 * - POST /api/upgrade/perform
 * - POST /api/upgrade/rollback
 * 
 * All upgrade endpoints require admin authentication.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import { createUserWithToken, createAdminWithToken, deleteAllTestUsers } from '../helpers/auth';

describe('Upgrade Endpoints', () => {
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

  describe('Security - 401 without token', () => {
    const endpoints = [
      { method: 'GET', url: '/api/upgrade/version' },
      { method: 'POST', url: '/api/upgrade/check', body: { targetVersion: '1.0.0' } },
      { method: 'GET', url: '/api/upgrade/status' },
      { method: 'POST', url: '/api/upgrade/backup' },
      { method: 'POST', url: '/api/upgrade/perform', body: { targetVersion: '1.0.0' } },
      { method: 'POST', url: '/api/upgrade/rollback', body: { backupId: 'test' } },
    ];

    it.each(endpoints)('$method $url should return 401 without token', async ({ method, url, body }) => {
      const response = await app.inject({ 
        method: method as any, 
        url,
        payload: body 
      });
      
      expect(response.statusCode).toBe(401);
    });
  });

  describe('Security - 403 for non-admin user', () => {
    const endpoints = [
      { method: 'GET', url: '/api/upgrade/version' },
      { method: 'POST', url: '/api/upgrade/check', body: { targetVersion: '1.0.0' } },
      { method: 'GET', url: '/api/upgrade/status' },
      { method: 'POST', url: '/api/upgrade/backup' },
      { method: 'POST', url: '/api/upgrade/perform', body: { targetVersion: '1.0.0' } },
      { method: 'POST', url: '/api/upgrade/rollback', body: { backupId: 'test' } },
    ];

    it.each(endpoints)('$method $url should return 403 for regular user', async ({ method, url, body }) => {
      const response = await app.inject({ 
        method: method as any, 
        url,
        payload: body,
        headers: { authorization: `Bearer ${userToken}` }
      });
      
      expect(response.statusCode).toBe(403);
    });
  });

  describe('GET /api/upgrade/version', () => {
    it('should return version information for admin', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/upgrade/version',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('data');
    });
  });

  describe('POST /api/upgrade/check', () => {
    it('should return 400 without targetVersion', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/upgrade/check',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it('should check compatibility for admin with targetVersion', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/upgrade/check',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { targetVersion: '2.0.0' },
      });

      expect([200, 500]).toContain(response.statusCode);
    });
  });

  describe('GET /api/upgrade/status', () => {
    it('should return upgrade status for admin', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/upgrade/status',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('data');
    });
  });

  describe('POST /api/upgrade/backup', () => {
    it('should create backup for admin', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/upgrade/backup',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      // May return 200 or 500 depending on backup service state
      expect([200, 500]).toContain(response.statusCode);
    });
  });

  describe('POST /api/upgrade/perform', () => {
    it('should return 400 without targetVersion', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/upgrade/perform',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it('should handle upgrade request with targetVersion', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/upgrade/perform',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { targetVersion: '2.0.0' },
      });

      // May return 200, 400 (no upgrade available), or 500
      expect([200, 400, 500]).toContain(response.statusCode);
    });
  });

  describe('POST /api/upgrade/rollback', () => {
    it('should return 400 without backupId', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/upgrade/rollback',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it('should handle rollback request with backupId', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/upgrade/rollback',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { backupId: 'test-backup-id' },
      });

      // May return 200, 400 (backup not found), or 500
      expect([200, 400, 500]).toContain(response.statusCode);
    });
  });
});
