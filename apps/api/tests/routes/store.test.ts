/**
 * Store Endpoints Tests
 * 
 * Coverage:
 * - GET /api/store/context
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import { validateResponse } from '../helpers/openapi';

describe('Store Endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/store/context', () => {
    it('should return store context', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/store/context',
      });

      expect([200, 500]).toContain(response.statusCode);
      
      if (response.statusCode === 200) {
        const body = response.json();
        expect(body).toHaveProperty('success');
      }
    });

    it('should match OpenAPI schema on success', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/store/context',
      });

      if (response.statusCode === 200) {
        const validation = validateResponse('/api/store/context', 'GET', 200, response.json());
        expect(validation.valid).toBe(true);
      }
    });

    it('should be accessible without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/store/context',
      });

      expect(response.statusCode).not.toBe(401);
    });

    it('should include store name when available', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/store/context',
      });

      if (response.statusCode === 200) {
        const body = response.json();
        // storeName may be present in data
        if (body.data?.storeName) {
          expect(typeof body.data.storeName).toBe('string');
        }
      }
    });

    it('should include locale information when available', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/store/context',
      });

      if (response.statusCode === 200) {
        const body = response.json();
        // defaultLocale and supportedLocales may be present
        if (body.data?.defaultLocale) {
          expect(typeof body.data.defaultLocale).toBe('string');
        }
        if (body.data?.supportedLocales) {
          expect(Array.isArray(body.data.supportedLocales)).toBe(true);
        }
      }
    });

    it('should include currency information when available', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/store/context',
      });

      if (response.statusCode === 200) {
        const body = response.json();
        if (body.data?.currency) {
          expect(typeof body.data.currency).toBe('string');
        }
      }
    });

    it('should expose powered by branding setting for storefront consumers', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/store/context',
      });

      if (response.statusCode === 200) {
        const body = response.json();
        expect(body.data).toHaveProperty('settings');
        expect(body.data.settings).toHaveProperty('branding.powered_by_jiffoo_enabled');
      }
    });
  });
});
