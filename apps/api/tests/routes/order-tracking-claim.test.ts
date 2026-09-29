import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@/config/database';
import { createTestApp } from '../helpers/create-test-app';
import { createUserWithToken, deleteAllTestUsers } from '../helpers/auth';
import { createTestOrder, deleteAllTestOrders } from '../helpers/fixtures';
import { loadOpenApiSpec, setOpenApiSpec, validateResponse } from '../helpers/openapi';

describe('Order purchase tracking claim', () => {
  let app: FastifyInstance;
  let customer: Awaited<ReturnType<typeof createUserWithToken>>;
  let order: Awaited<ReturnType<typeof createTestOrder>>;
  const route = '/api/v1/orders/{id}/tracking-claim';
  const claim = (token = customer.token) => app.inject({
    method: 'POST', url: `/api/v1/orders/${order.id}/tracking-claim`,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  const count = () => prisma.orderPurchaseClaim.count({ where: { orderId: order.id } });
  function result(response: Awaited<ReturnType<typeof claim>>, claimed: boolean) {
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual({ claimed });
    expect(validateResponse(route, 'POST', 200, response.json()).valid).toBe(true);
  }

  beforeAll(async () => {
    app = await createTestApp({ enableSwagger: true });
    setOpenApiSpec(app.swagger() as ReturnType<typeof loadOpenApiSpec> & {});
  });
  beforeEach(async () => {
    customer = await createUserWithToken();
    order = await createTestOrder({ userId: customer.user.id, total: 12 });
  });
  afterAll(async () => {
    await deleteAllTestOrders();
    await deleteAllTestUsers();
    await app.close();
  });

  it('A first claim returns true and persists exactly one row', async () => {
    expect(loadOpenApiSpec()?.paths[route]?.post).toBeDefined();
    result(await claim(), true);
    expect(await count()).toBe(1);
    expect((await prisma.orderPurchaseClaim.findUniqueOrThrow({ where: { orderId: order.id } })).claimedAt).toBeInstanceOf(Date);
  });

  it('B second claim returns false and retains exactly one row', async () => {
    result(await claim(), true);
    const before = await prisma.orderPurchaseClaim.findUniqueOrThrow({ where: { orderId: order.id } });
    result(await claim(), false);
    expect(await count()).toBe(1);
    expect(await prisma.orderPurchaseClaim.findUniqueOrThrow({ where: { orderId: order.id } })).toEqual(before);
  });

  it('C concurrent claims return one true and one false with exactly one row', async () => {
    const responses = await Promise.all([claim(), claim()]);
    expect(responses.map((response) => response.statusCode)).toEqual([200, 200]);
    expect(responses.map((response) => response.json().data.claimed).sort()).toEqual([false, true]);
    for (const response of responses) result(response, response.json().data.claimed);
    expect(await count()).toBe(1);
  });

  it('D other customer and unauthenticated claims return 404 and 401 without rows', async () => {
    const other = await createUserWithToken();
    const forbidden = await claim(other.token);
    expect(forbidden.statusCode).toBe(404);
    expect(forbidden.json().error.code).toBe('NOT_FOUND');
    const absent = await app.inject({
      method: 'POST', url: '/api/v1/orders/missing-order/tracking-claim',
      headers: { authorization: `Bearer ${customer.token}` },
    });
    expect(absent.statusCode).toBe(404);
    expect(absent.json().error.code).toBe('NOT_FOUND');
    expect((await claim('')).statusCode).toBe(401);
    expect(await count()).toBe(0);
  });

  it('E cancelled and refunded orders return 409 without consuming a claim', async () => {
    for (const status of ['CANCELLED', 'REFUNDED'] as const) {
      const terminal = await createTestOrder({ userId: customer.user.id, status, total: 12 });
      const response = await app.inject({
        method: 'POST', url: `/api/v1/orders/${terminal.id}/tracking-claim`,
        headers: { authorization: `Bearer ${customer.token}` },
      });
      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe('PURCHASE_TRACKING_UNAVAILABLE');
      expect(validateResponse(route, 'POST', 409, response.json()).valid).toBe(true);
      expect(await prisma.orderPurchaseClaim.count({ where: { orderId: terminal.id } })).toBe(0);
    }
    expect(await count()).toBe(0);
  });
});
