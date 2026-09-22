import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';

describe('Admin Route Authentication', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    '/api/v1/admin/users',
    '/api/v1/admin/staff',
    '/api/v1/admin/products',
    '/api/v1/admin/orders',
    '/api/v1/admin/inventory',
    '/api/v1/admin/settings',
    '/api/v1/admin/dashboard',
    '/api/v1/admin/health/summary',
    '/api/v1/admin/webhooks/subscriptions',
    '/api/v1/admin/api-tokens',
  ])('GET %s returns 401 without authentication', async (url) => {
    const response = await app.inject({ method: 'GET', url });
    expect(response.statusCode).toBe(401);
  });
});
