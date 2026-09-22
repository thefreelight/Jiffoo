import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, deleteAllTestUsers } from '../helpers/auth';
import { getTestPrisma } from '../helpers/db';

describe('Admin Inventory Endpoints', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let staffToken: string;
  let productId: string;
  let variantId: string;

  beforeAll(async () => {
    app = await createTestApp();
    const { token } = await createAdminWithToken();
    adminToken = token;
    const { token: staffAuthToken, user: staffUser } = await createAdminWithToken();
    staffToken = staffAuthToken;
    await getTestPrisma().adminMembership.create({
      data: {
        userId: staffUser.id,
        role: 'SUPPORT_AGENT',
        status: 'ACTIVE',
      },
    });

    const product = await getTestPrisma().product.create({
      data: {
        name: 'Inventory route test product',
        slug: `inventory-route-test-${Date.now()}`,
        variants: {
          create: { name: 'Default', stock: 2 },
        },
      },
      include: { variants: true },
    });
    productId = product.id;
    variantId = product.variants[0].id;
  });

  afterAll(async () => {
    await getTestPrisma().product.delete({ where: { id: productId } });
    await deleteAllTestUsers();
    await app.close();
  });

  it.each([
    ['GET', '/api/v1/admin/inventory', undefined],
    ['POST', '/api/v1/admin/inventory/set', { variantId: 'missing', quantity: 1 }],
    ['POST', '/api/v1/admin/inventory/adjustments', { variantId: 'missing', type: 'manual', quantity: 1 }],
  ])('%s %s returns 401 without a token', async (method, url, payload) => {
    const response = await app.inject({ method, url, payload });
    expect(response.statusCode).toBe(401);
  });

  it('GET /api/v1/admin/inventory succeeds for an admin', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/inventory',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(response.statusCode).toBe(200);
  });

  it('GET /api/v1/admin/inventory returns 403 for staff without inventory permission', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/inventory',
      headers: { authorization: `Bearer ${staffToken}` },
    });
    expect(response.statusCode).toBe(403);
  });

  it('POST /api/v1/admin/inventory/set succeeds for an admin', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/inventory/set',
      payload: { variantId, quantity: 7 },
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(response.statusCode).toBe(200);
  });

  it('POST /api/v1/admin/inventory/adjustments succeeds for an admin', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/inventory/adjustments',
      payload: { variantId, type: 'manual', quantity: 2 },
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(response.statusCode).toBe(201);
  });
});
