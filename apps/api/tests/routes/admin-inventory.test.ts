import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, createUserWithToken, deleteAllTestUsers } from '../helpers/auth';
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
    const { token: staffAuthToken } = await createUserWithToken();
    staffToken = staffAuthToken;

    const product = await getTestPrisma().product.create({
      data: {
        name: 'Inventory route test product',
        spuCode: `INVENTORY-${Date.now()}`,
        slug: `inventory-route-test-${Date.now()}`,
        variants: {
          create: { name: 'Default', stock: 2, skuCode: `INVENTORY-${Date.now()}-01` },
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

  it('GET /api/v1/admin/inventory returns 403 for a customer', async () => {
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

  it('POST /api/v1/admin/inventory/set guards the write with expectedStock and records the ledger row', async () => {
    const prisma = getTestPrisma();
    const stockBefore = (await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId }, select: { stock: true } })).stock;
    const rowsBefore = await prisma.inventoryAdjustment.count({ where: { variantId } });

    // The caller observed another level, so the write is refused and nothing changes.
    const conflict = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/inventory/set',
      payload: { variantId, quantity: stockBefore + 4, expectedStock: stockBefore + 1 },
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().error.code).toBe('CONFLICT');
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId }, select: { stock: true } })).stock).toBe(stockBefore);
    expect(await prisma.inventoryAdjustment.count({ where: { variantId } })).toBe(rowsBefore);

    // The caller observed the stored level, so the write lands and is ledgered.
    const applied = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/inventory/set',
      payload: { variantId, quantity: stockBefore + 4, expectedStock: stockBefore },
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(applied.statusCode).toBe(200);
    expect(applied.json().data).toEqual({ variantId, stock: stockBefore + 4 });
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId }, select: { stock: true } })).stock).toBe(stockBefore + 4);
    const rows = await prisma.inventoryAdjustment.findMany({ where: { variantId } });
    expect(rows).toHaveLength(rowsBefore + 1);
    expect(rows.filter(row => row.quantity === 4 && row.type === 'correction' && row.reason === 'admin_stock_set')).toHaveLength(1);
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
