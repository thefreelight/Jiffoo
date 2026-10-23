/**
 * Store Endpoints Tests
 * 
 * Coverage:
 * - GET /api/v1/store/context
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { systemSettingsService } from '@/core/settings/service';
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

  describe('GET /api/v1/store/context', () => {
    it.each([
      [null, ['US', 'CA', 'AU', 'CN', 'GB']],
      [['DE'], ['DE']],
      [[], []],
    ])('uses the configured checkout country value %j without replacing an explicit empty list', async (stored, expected) => {
      const get = vi.spyOn(systemSettingsService, 'getSetting').mockResolvedValue(stored as never);
      try {
        expect(await systemSettingsService.getCheckoutCountriesRequireStatePostal()).toEqual(expected);
        const response = await app.inject({ method: 'GET', url: '/api/v1/store/context' });
        expect(response.statusCode).toBe(200);
        expect(response.json().data.checkoutCountriesRequireStatePostal).toEqual(expected);
        expect(validateResponse('/api/v1/store/context', 'GET', 200, response.json()).valid).toBe(true);
      } finally { get.mockRestore(); }
    });
    it('exposes the configured checkout address requirements and includes them in the ETag', async () => {
      const setting = vi.spyOn(systemSettingsService, 'getCheckoutCountriesRequireStatePostal');
      try {
        setting.mockResolvedValue(['DE']);
        const first = await app.inject({ method: 'GET', url: '/api/v1/store/context' });
        expect(first.statusCode).toBe(200);
        expect(first.json().data.checkoutCountriesRequireStatePostal).toEqual(['DE']);
        expect(validateResponse('/api/v1/store/context', 'GET', 200, first.json()).valid).toBe(true);
        setting.mockResolvedValue(['JP', 'NZ']);
        const second = await app.inject({ method: 'GET', url: '/api/v1/store/context', headers: { 'if-none-match': first.headers.etag! } });
        expect(second.statusCode).toBe(200);
        expect(second.json().data.checkoutCountriesRequireStatePostal).toEqual(['JP', 'NZ']);
        expect(second.headers.etag).not.toBe(first.headers.etag);
      } finally { setting.mockRestore(); }
    });
    it('should return store context', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/store/context',
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
        url: '/api/v1/store/context',
      });

      if (response.statusCode === 200) {
        const validation = validateResponse('/api/v1/store/context', 'GET', 200, response.json());
        expect(validation.valid).toBe(true);
      }
    });

    it('should be accessible without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/store/context',
      });

      expect(response.statusCode).not.toBe(401);
    });

    it('should include store name when available', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/store/context',
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
        url: '/api/v1/store/context',
      });

      if (response.statusCode === 200) {
        const body = response.json();
        // defaultLocale and supportedLocales may be present
        if (body.data?.defaultLocale) {
          expect(typeof body.data.defaultLocale).toBe('string');
        }
        if (body.data?.supportedLocales) {
          expect(Array.isArray(body.data.supportedLocales)).toBe(true);
          expect(body.data.supportedLocales).toContain('zh-Hans');
        }
      }
    });

    it('should include currency information when available', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/store/context',
      });

      if (response.statusCode === 200) {
        const body = response.json();
        if (body.data?.currency) {
          expect(typeof body.data.currency).toBe('string');
        }
      }
    });
  });
});
