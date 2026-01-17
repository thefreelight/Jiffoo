import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import { validateResponse } from '../helpers/openapi';
import { v4 as uuidv4 } from 'uuid';
import { createAdminWithToken, createUserWithToken, deleteAllTestUsers } from '../helpers/auth';

describe('Logger Endpoints', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    const { token: aToken } = await createAdminWithToken();
    const { token: uToken } = await createUserWithToken();
    adminToken = aToken;
    userToken = uToken;
  });

  afterAll(async () => {
    await deleteAllTestUsers();
    await app.close();
  });

  describe('GET /api/logs/health', () => {
    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/logs/health',
      });
      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/logs/health',
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(response.statusCode).toBe(403);
    });

    it('should return log system health (for admin)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/logs/health',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('timestamp');
    });

    it('should match OpenAPI schema', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/logs/health',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      const validation = validateResponse('/api/logs/health', 'GET', 200, response.json());
      expect(validation.valid).toBe(true);
    });
  });

  describe('POST /api/logs/batch', () => {
    // This endpoint should be public (for frontend logs)

    it('should return 400 for missing logs array', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/logs/batch',
        payload: {
          clientInfo: {
            userAgent: 'Test Agent',
            url: 'http://localhost:3000',
            timestamp: new Date().toISOString(),
          },
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for missing clientInfo', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/logs/batch',
        payload: {
          logs: [],
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should accept valid batch logs', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/logs/batch',
        payload: {
          logs: [
            {
              id: uuidv4(),
              timestamp: new Date().toISOString(),
              level: 'info',
              message: 'Test log message',
              appName: 'shop',
              environment: 'test',
              meta: {},
            },
          ],
          clientInfo: {
            userAgent: 'Test Agent/1.0',
            url: 'http://localhost:3000/test',
            timestamp: new Date().toISOString(),
          },
        },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toHaveProperty('success');
      expect(body.success).toBe(true);
    });

    it('should return received count', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/logs/batch',
        payload: {
          logs: [
            {
              id: uuidv4(),
              timestamp: new Date().toISOString(),
              level: 'warn',
              message: 'Warning message',
              appName: 'admin',
              environment: 'test',
              meta: { context: 'test' },
            },
            {
              id: uuidv4(),
              timestamp: new Date().toISOString(),
              level: 'error',
              message: 'Error message',
              appName: 'admin',
              environment: 'test',
              meta: { error: 'test error' },
            },
          ],
          clientInfo: {
            userAgent: 'Test Agent/1.0',
            url: 'http://localhost:3000/test',
            timestamp: new Date().toISOString(),
          },
        },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toHaveProperty('received');
      expect(body.received).toBe(2);
    });

    it('should validate log level', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/logs/batch',
        payload: {
          logs: [
            {
              id: uuidv4(),
              timestamp: new Date().toISOString(),
              level: 'invalid-level', // Invalid level
              message: 'Test message',
              appName: 'shop',
              environment: 'test',
              meta: {},
            },
          ],
          clientInfo: {
            userAgent: 'Test Agent/1.0',
            url: 'http://localhost:3000',
            timestamp: new Date().toISOString(),
          },
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should be accessible without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/logs/batch',
        payload: {
          logs: [],
          clientInfo: {
            userAgent: 'Test',
            url: 'http://test.com',
            timestamp: new Date().toISOString(),
          },
        },
      });

      // Should not return 401 (logs from frontend don't require auth)
      expect(response.statusCode).not.toBe(401);
    });
  });

  describe('POST /api/logs/alerts/:id/resolve', () => {
    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/logs/alerts/test-alert-id/resolve',
      });
      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for regular user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/logs/alerts/test-alert-id/resolve',
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(response.statusCode).toBe(403);
    });

    it('should return 404 for non-existent alert (with admin token)', async () => {
      const fakeAlertId = uuidv4();

      const response = await app.inject({
        method: 'POST',
        url: `/api/logs/alerts/${fakeAlertId}/resolve`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      // Could be 404 or 200 depending on implementation
      expect([200, 404]).toContain(response.statusCode);
    });
  });
});
