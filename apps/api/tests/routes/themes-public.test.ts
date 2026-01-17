/**
 * Public Themes Endpoints Tests
 * 
 * Coverage:
 * - GET /api/themes/active
 * - GET /api/themes/installed
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';

describe('Public Themes Endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/themes/active', () => {
    it('should return active theme', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/themes/active',
      });

      expect(response.statusCode).toBe(200);
    });

    it('should be accessible without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/themes/active',
      });

      expect(response.statusCode).not.toBe(401);
    });
  });

  describe('GET /api/themes/installed', () => {
    it('should return installed themes list', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/themes/installed',
      });

      expect(response.statusCode).toBe(200);
    });

    it('should be accessible without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/themes/installed',
      });

      expect(response.statusCode).not.toBe(401);
    });
  });
});
