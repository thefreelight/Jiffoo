import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, deleteAllTestUsers } from '../helpers/auth';
import { getTestPrisma } from '../helpers/db';

describe('Admin Inventory Endpoints', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let productId: string;
  let variantId: string;

  beforeAll(async () => {
    app = await createTestApp();
    const { token } = await createAdminWithToken();
    adminToken = token;

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
    ['GET', '/api/admin/inventory', undefined],
    ['POST', '/api/admin/inventory/set', { variantId: 'missing', quantity: 1 }],
    ['POST', '/api/admin/inventory/adjustments', { variantId: 'missing', type: 'manual', quantity: 1 }],
  ])('%s %s returns 401 without a token', async (method, url, payload) => {
    const response = await app.inject({ method, url, payload });
    expect(response.statusCode).toBe(401);
  });

  it('GET /api/admin/inventory succeeds for an admin', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/inventory',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(response.statusCode).toBe(200);
  });

  it('POST /api/admin/inventory/set succeeds for an admin', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/inventory/set',
      payload: { variantId, quantity: 7 },
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(response.statusCode).toBe(200);
  });

  it('POST /api/admin/inventory/adjustments succeeds for an admin', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/inventory/adjustments',
      payload: { variantId, type: 'manual', quantity: 2 },
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(response.statusCode).toBe(201);
  });
});
