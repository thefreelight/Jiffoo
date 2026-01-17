/**
 * Install Endpoints Tests
 * 
 * Coverage:
 * - GET /api/install/status
 * - GET /api/install/check-database
 * - POST /api/install/complete
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import { validateResponse } from '../helpers/openapi';

describe('Install Endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/install/status', () => {
    it('should return installation status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/install/status',
      });

      expect(response.statusCode).toBe(200);
      
      const body = response.json();
      expect(body).toHaveProperty('isInstalled');
      expect(typeof body.isInstalled).toBe('boolean');
    });

    it('should match OpenAPI schema', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/install/status',
      });

      const validation = validateResponse('/api/install/status', 'GET', 200, response.json());
      expect(validation.valid).toBe(true);
    });

    it('should be accessible without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/install/status',
      });

      expect(response.statusCode).not.toBe(401);
    });
  });

  describe('GET /api/install/check-database', () => {
    it('should return database connection status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/install/check-database',
      });

      expect(response.statusCode).toBe(200);
      
      const body = response.json();
      expect(body).toHaveProperty('connected');
      expect(typeof body.connected).toBe('boolean');
    });

    it('should match OpenAPI schema', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/install/check-database',
      });

      const validation = validateResponse('/api/install/check-database', 'GET', 200, response.json());
      expect(validation.valid).toBe(true);
    });

    it('should be accessible without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/install/check-database',
      });

      expect(response.statusCode).not.toBe(401);
    });
  });

  describe('POST /api/install/complete', () => {
    it('should return 400 for missing siteName', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/install/complete',
        payload: {
          adminEmail: 'admin@example.com',
          adminPassword: 'Test123456!',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for missing adminEmail', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/install/complete',
        payload: {
          siteName: 'My Store',
          adminPassword: 'Test123456!',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for missing adminPassword', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/install/complete',
        payload: {
          siteName: 'My Store',
          adminEmail: 'admin@example.com',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for invalid email format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/install/complete',
        payload: {
          siteName: 'My Store',
          adminEmail: 'invalid-email',
          adminPassword: 'Test123456!',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for short password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/install/complete',
        payload: {
          siteName: 'My Store',
          adminEmail: 'admin@example.com',
          adminPassword: '123',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for empty siteName', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/install/complete',
        payload: {
          siteName: '',
          adminEmail: 'admin@example.com',
          adminPassword: 'Test123456!',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    // Note: We don't test successful installation because it would
    // modify the system state and potentially break other tests
    it('should handle installation attempt (may fail if already installed)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/install/complete',
        payload: {
          siteName: 'Test Store',
          siteDescription: 'A test store',
          adminEmail: 'install-test@example.com',
          adminPassword: 'Test123456!',
          adminUsername: 'testadmin',
        },
      });

      // May return 200 (success) or 400 (already installed)
      expect([200, 400]).toContain(response.statusCode);
    });
  });
});
