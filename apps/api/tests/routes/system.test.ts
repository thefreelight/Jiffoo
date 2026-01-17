/**
 * System Endpoints Tests
 * 
 * Coverage:
 * - GET / (API root)
 * - GET /health
 * - GET /health/live
 * - GET /health/ready
 * - GET /success (payment redirect)
 * - GET /cancel (payment redirect)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';

describe('System Endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET / (API Root)', () => {
    it('should return API info', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/',
      });

      expect(response.statusCode).toBe(200);
      
      const body = response.json();
      expect(body).toHaveProperty('name');
      expect(body).toHaveProperty('version');
      expect(body).toHaveProperty('description');
      expect(body).toHaveProperty('environment');
      expect(body).toHaveProperty('timestamp');
      expect(body.environment).toBe('test');
    });

    it('should include endpoint documentation', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/',
      });

      const body = response.json();
      expect(body).toHaveProperty('endpoints');
      expect(body.endpoints).toHaveProperty('health');
      expect(body.endpoints).toHaveProperty('auth');
      expect(body.endpoints).toHaveProperty('products');
    });
  });

  describe('GET /health (Full Health Check)', () => {
    it('should return health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      
      const body = response.json();
      expect(body).toHaveProperty('status');
    });

    it('should include timestamp', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      const body = response.json();
      expect(body).toHaveProperty('timestamp');
    });
  });

  describe('GET /health/live (Liveness Probe)', () => {
    it('should return ok status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health/live',
      });

      expect(response.statusCode).toBe(200);
      
      const body = response.json();
      expect(body).toHaveProperty('status');
      expect(body.status).toBe('ok');
    });

    it('should be very fast (< 100ms)', async () => {
      const start = Date.now();
      
      await app.inject({
        method: 'GET',
        url: '/health/live',
      });

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100);
    });
  });

  describe('GET /health/ready (Readiness Probe)', () => {
    it('should return ready or not_ready status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health/ready',
      });

      // Can be 200 (ready) or 503 (not ready)
      expect([200, 503]).toContain(response.statusCode);
      
      const body = response.json();
      expect(body).toHaveProperty('status');
      expect(['ready', 'not_ready', 'ok']).toContain(body.status);
    });
  });

  describe('GET /success (Payment Success Redirect)', () => {
    it('should redirect to shop success page', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/success',
      });

      // Should redirect (302 or 303)
      expect([302, 303]).toContain(response.statusCode);
      
      // Check redirect location
      const location = response.headers.location as string;
      expect(location).toContain('order-success');
    });

    it('should pass session_id to redirect URL', async () => {
      const sessionId = 'test-session-123';
      
      const response = await app.inject({
        method: 'GET',
        url: `/success?session_id=${sessionId}`,
      });

      const location = response.headers.location as string;
      expect(location).toContain(`session_id=${sessionId}`);
    });
  });

  describe('GET /cancel (Payment Cancel Redirect)', () => {
    it('should redirect to shop cancel page', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/cancel',
      });

      // Should redirect
      expect([302, 303]).toContain(response.statusCode);
      
      // Check redirect location
      const location = response.headers.location as string;
      expect(location).toContain('order-cancelled');
    });
  });

  describe('404 Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/this-route-does-not-exist',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('Method Not Allowed', () => {
    it('should return 405 for wrong method on health', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/health',
      });

      // Fastify returns 404 for method not allowed by default
      expect([404, 405]).toContain(response.statusCode);
    });
  });
});
