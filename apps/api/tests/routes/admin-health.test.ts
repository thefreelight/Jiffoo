import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import { createTestUser, deleteAllTestUsers, signJwt } from '../helpers/auth';

describe('Admin Health Summary Routes', () => {
  let app: FastifyInstance;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    const adminUser = await createTestUser({
      email: 'admin@test.com',
      username: 'admin',
      role: 'ADMIN',
    });
    adminToken = signJwt(adminUser.id, adminUser.email);
  });

  afterAll(async () => {
    await deleteAllTestUsers();
    await app.close();
  });

  it('returns component status for an admin', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/health/summary',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toMatch(/healthy|degraded|unhealthy/);
    expect(body.data.database.status).toMatch(/ok|error/);
    expect(body.data.redis.status).toMatch(/ok|error/);
    expect(body.data.pluginRuntime).toEqual({ status: 'ok', loaded: expect.any(Number) });
    expect(body.data.version).toEqual(expect.any(String));
    expect(body.data.uptime).toEqual(expect.any(Number));
  });

  it('requires authentication', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/health/summary',
    });

    expect(response.statusCode).toBe(401);
  });
});
