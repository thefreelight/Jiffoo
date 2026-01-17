/**
 * Public Plugins Endpoints Tests
 * 
 * Coverage:
 * - GET /api/plugins/
 * - GET /api/plugins/:slug
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';

describe('Public Plugins Endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/plugins/', () => {
    it('should return installed plugins list', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/plugins/',
      });

      expect(response.statusCode).toBe(200);
    });

    it('should be accessible without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/plugins/',
      });

      expect(response.statusCode).not.toBe(401);
    });

    it('should support category filter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/plugins/?category=payment',
      });

      expect(response.statusCode).toBe(200);
    });

    it('should support enabled filter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/plugins/?enabled=true',
      });

      expect(response.statusCode).toBe(200);
    });

    it('should support pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/plugins/?page=1&limit=10',
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('GET /api/plugins/:slug', () => {
    it('should return 404 for non-existent plugin', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/plugins/non-existent-plugin',
      });

      expect(response.statusCode).toBe(404);
    });

    it('should be accessible without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/plugins/some-plugin',
      });

      expect(response.statusCode).not.toBe(401);
    });
  });
});
